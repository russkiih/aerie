// Stripe billing backend for the hosted Aerie cloud build.
//
// This is the ONLY server-side component in Aerie, and it exists because
// Stripe cannot run recurring subscriptions without a webhook endpoint. It
// deliberately never touches a user's Firebase estate: the only thing stored
// is <verified email → subscription status>. Project data keeps flowing
// browser → Google, exactly as before.
//
// Self-hosted builds never call any of this (IS_CLOUD is false, so lib/tier.ts
// reports "pro" without a network round-trip).
//
// Identity comes from the Google OAuth access token the dashboard already
// holds. We hand it to Google's tokeninfo endpoint, which returns the verified
// email AND the token's audience — the audience check matters, because a token
// minted for some *other* OAuth client would otherwise be accepted here.

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { reserveQuota } = require("./quota.js");

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

admin.initializeApp();
const db = admin.firestore();

// Public, non-secret identifiers (they already ship in the web bundle).
const GOOGLE_CLIENT_ID =
  "122164526376-12ng726h8ff7t3qcgppc03hicara154s.apps.googleusercontent.com";
const APP_URL = "https://aerie-dashboard-app.web.app";
const PRICES = {
  annual: "price_1TvTQkDU82Y7dwOsX0xLohWW", // $108/yr — "$9/mo billed yearly"
  monthly: "price_1TvTQoDU82Y7dwOs0mUUBVcD", // $19/mo
};
const TRIAL_DAYS = 7; // annual only — see the checkout handler

// The included analyst runs on one key we own — no runtime model discovery
// (that is only correct for BYOK, where each key exposes a different model
// set). See docs/superpowers/specs/2026-07-21-ai-analyst-proxy-design.md.
//
// Ordered fallback chain. Google retires Gemini model IDs regularly, and a
// single pinned ID means the paid feature goes fully dark the day that
// happens. Each entry is tried in order until one responds; all are Flash
// tier, so the spend ceiling holds whichever one serves.
const ANALYST_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
];
const ANALYST_CAP = 100;

// Each fallback attempt gets its own deadline. Without one, a hung model
// (connected but never responding) eats the whole function budget, the
// platform kills the invocation before the next model is tried, and the
// reserved credit is never refunded.
const ANALYST_ATTEMPT_TIMEOUT_MS = 20000;

// The real UI snapshot is a few KB. This is not a tuning knob — it is the
// ceiling that makes the monthly cap bound SPEND and not merely call count.
const ANALYST_MAX_PAYLOAD_BYTES = 64 * 1024;

// Kept in sync with the BYOK system prompt in web/lib/analyst.ts. The proxy
// holds it server-side so the browser only sends the metrics snapshot.
const ANALYST_SYSTEM = `You are Aerie's growth analyst. Aerie is a dashboard that shows a developer live metrics for their Firebase projects. You receive a JSON snapshot of one project's real numbers: users, Firestore documents and collections, GA4 traffic (daily active users for the selected window plus the previous window for comparison), traffic sources (top pages, referral sources, countries, devices, operating systems, events), sign-in methods, signups by month, and enabled Firebase services.

Write a short, concrete analysis for the developer who owns this app:

Insights
- 3 to 5 bullets, ranked by importance. Each grounded in specific numbers from the snapshot (cite them). Call out what is working, what looks like a problem, and anything that looks like bot/crawler noise rather than real users.

Actions
- 2 to 3 bullets. Specific next moves this developer should make, derived from the insights (e.g. which page type to double down on, which acquisition channel to invest in, which sign-in method to promote, what to instrument next).

Rules: plain text only — exactly the two section headers above, bullets starting with "- ". No preamble, no closing paragraph, no markdown syntax beyond the bullets. Keep every bullet to 1-2 sentences. If a section of the snapshot is null or empty, don't speculate about it.`;

const ALLOWED_ORIGINS = [
  APP_URL,
  "https://aerie-dashboard-app.firebaseapp.com",
  "http://localhost:3000",
  "http://localhost:4174",
];

function cors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin))
    res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

// Verify a Google OAuth access token and return its verified email. Throws on
// anything suspicious: bad token, unverified email, or a token issued to a
// different OAuth client than ours.
async function verifiedEmail(accessToken) {
  if (!accessToken || typeof accessToken !== "string")
    throw new Error("missing token");
  const r = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(
      accessToken
    )}`
  );
  if (!r.ok) throw new Error("invalid token");
  const info = await r.json();
  if (info.aud !== GOOGLE_CLIENT_ID) throw new Error("wrong audience");
  if (!info.email || info.email_verified !== "true")
    throw new Error("unverified email");
  return String(info.email).toLowerCase();
}

// One document per paying identity, keyed by verified email. Written only by
// this backend; Firestore rules deny all client access (see firestore.rules).
const subDoc = (email) => db.collection("subscriptions").doc(email);

const isPro = (status) => status === "active" || status === "trialing";

// ── tier ────────────────────────────────────────────────────────────────────
// The dashboard's read path. Returns the caller's current entitlement.
exports.tier = onRequest(
  { secrets: [STRIPE_SECRET_KEY], cors: false },
  async (req, res) => {
    if (cors(req, res)) return;
    try {
      const email = await verifiedEmail((req.body || {}).googleToken);
      const snap = await subDoc(email).get();
      const d = snap.exists ? snap.data() : null;
      res.json({
        tier: d && isPro(d.status) ? "pro" : "free",
        status: d ? d.status : null,
        plan: d ? d.plan || null : null,
        currentPeriodEnd: d ? d.currentPeriodEnd || null : null,
      });
    } catch (e) {
      // Fail closed: an unverifiable caller is simply not a subscriber.
      res.status(401).json({ tier: "free", error: String(e.message || e) });
    }
  }
);

// ── checkout ────────────────────────────────────────────────────────────────
// Creates a Stripe Checkout Session for the verified caller and returns its URL.
exports.checkout = onRequest(
  { secrets: [STRIPE_SECRET_KEY], cors: false },
  async (req, res) => {
    if (cors(req, res)) return;
    try {
      const body = req.body || {};
      const plan = body.plan === "monthly" ? "monthly" : "annual";
      const email = await verifiedEmail(body.googleToken);
      const stripe = new Stripe(STRIPE_SECRET_KEY.value());

      // Reuse the customer for this email so repeat checkouts don't fan out
      // into duplicate Stripe customers.
      const found = await stripe.customers.list({ email, limit: 1 });
      const customer =
        found.data[0] || (await stripe.customers.create({ email }));

      // The trial is an annual-plan incentive only. Monthly bills from day
      // one — a free week on a month-to-month plan gives away a quarter of
      // the first billing period for a subscription that can leave anyway.
      const subscriptionData = { metadata: { email, plan } };
      if (plan === "annual") subscriptionData.trial_period_days = TRIAL_DAYS;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        client_reference_id: email,
        line_items: [{ price: PRICES[plan], quantity: 1 }],
        subscription_data: subscriptionData,
        success_url: `${APP_URL}/?upgraded=1`,
        cancel_url: `${APP_URL}/?upgrade_cancelled=1`,
        allow_promotion_codes: true,
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(400).json({ error: String(e.message || e) });
    }
  }
);

// ── analyst ───────────────────────────────────────────────────────────────
// The Cloud Pro analyst. Verifies the caller, enforces a monthly quota, then
// relays Gemini's SSE stream to the browser. ZERO RETENTION: the payload and
// the generated text pass through memory and are never logged or stored. The
// only Firestore write touches the two counter fields — see quota.js.
exports.analyst = onRequest(
  {
    secrets: [GEMINI_API_KEY],
    cors: false,
    // The default 60s can kill a slow thinking-model stream mid-flight, which
    // spends a credit and shows the user nothing; maxInstances bounds
    // concurrent invocation cost.
    timeoutSeconds: 120,
    maxInstances: 20,
  },
  async (req, res) => {
    if (cors(req, res)) return;
    // A YYYY-MM stamp; used both for the quota period and the reset check.
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}`;

    let email, payload;
    try {
      const body = req.body || {};
      email = await verifiedEmail(body.googleToken);
      payload = body.payload;
      if (!payload || typeof payload !== "object")
        throw new Error("missing payload");
      const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
      if (payloadBytes > ANALYST_MAX_PAYLOAD_BYTES) {
        // Byte count only — never the payload itself.
        console.log("analyst payload too large", payloadBytes);
        res.status(413).json({ error: "payload too large" });
        return;
      }
    } catch (e) {
      // Do not log the body — only the reason.
      res.status(401).json({ error: String(e.message || e) });
      return;
    }

    // Entitlement + quota reservation in one transaction. Reserve BEFORE
    // calling Gemini so concurrent requests cannot slip past the cap.
    const ref = subDoc(email);
    let reserved;
    try {
      reserved = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const d = snap.exists ? snap.data() : null;
        if (!d || !isPro(d.status)) {
          return { pro: false };
        }
        const q = reserveQuota(d, period, ANALYST_CAP);
        if (!q.allowed) return { pro: true, allowed: false };
        tx.set(
          ref,
          { analystCalls: q.calls, analystPeriod: q.period },
          { merge: true }
        );
        return { pro: true, allowed: true };
      });
    } catch (e) {
      console.error("analyst tx failed", String(e.message || e));
      res.status(502).json({ error: "analyst unavailable" });
      return;
    }

    if (!reserved.pro) {
      res.status(403).json({ error: "Cloud Pro required" });
      return;
    }
    if (!reserved.allowed) {
      res.status(429).json({ error: "monthly analyst limit reached" });
      return;
    }

    // Call Gemini, trying each model in ANALYST_MODELS in order until one
    // responds. A thrown fetch (network) or a non-OK response both count as
    // "this model did not work for us" and move on to the next. The credit
    // is refunded exactly once, and only if the entire chain fails — never
    // per-attempt, which would multiply-decrement the counter. This all
    // happens before any headers are sent, so switching models mid-loop is
    // still safe.
    let gRes = null;
    let servedModel = null;
    for (const model of ANALYST_MODELS) {
      let attempt;
      // Bounds only time-to-response-headers for THIS attempt. Cleared in
      // every branch below — including the winning one, before the relay
      // starts — so it can never fire against the SSE body read.
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), ANALYST_ATTEMPT_TIMEOUT_MS);
      try {
        attempt = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": GEMINI_API_KEY.value(),
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: ANALYST_SYSTEM }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: `Project snapshot:\n${JSON.stringify(payload)}` },
                  ],
                },
              ],
              generationConfig: {
                // maxOutputTokens caps thinking + visible output COMBINED, so
                // leave headroom above what the answer alone needs (~400
                // tokens for 8 short bullets). thinkingLevel is the Gemini 3
                // control; the legacy thinkingBudget is rejected alongside it
                // with a 400, so only ever send the one that matches this
                // model's generation.
                maxOutputTokens: 4096,
                thinkingConfig: model.startsWith("gemini-3")
                  ? { thinkingLevel: "low" }
                  : { thinkingBudget: 512 },
              },
            }),
            signal: ctl.signal,
          }
        );
      } catch (e) {
        // Includes the timeout abort surfacing as an AbortError — treated
        // exactly like any other failed attempt: log and try the next model.
        // Model ID and error message are ours, not user content — safe to log.
        console.error("analyst model fallback", model, String(e.message || e));
        clearTimeout(timer);
        continue;
      }

      if (!attempt.ok || !attempt.body) {
        console.error("analyst model fallback", model, attempt.status);
        clearTimeout(timer);
        continue;
      }

      // Success: disarm the deadline now. The relay below reads the body
      // over a potentially long stream, and ctl.signal must not still be
      // able to fire against it.
      clearTimeout(timer);
      gRes = attempt;
      servedModel = model;
      break;
    }

    if (!gRes) {
      await refund(ref, period);
      console.error("analyst upstream exhausted all fallback models");
      res.status(502).json({ error: "analyst unavailable" });
      return;
    }

    // Relay the stream. Once headers are sent we cannot change the status, and
    // the credit is NOT refunded past this point (Gemini has begun billing).
    res.set("Content-Type", "text/event-stream");
    res.set("Cache-Control", "no-cache");
    res.set("Connection", "keep-alive");

    const reader = gRes.body.getReader();

    // A closed tab must stop the upstream pull — otherwise we keep paying
    // Gemini for tokens nobody will receive.
    // Node emits 'close' on the RESPONSE when the client goes away. (req's
    // 'close' fires when the body finishes parsing — long before we get here —
    // so listening there silently never fires.)
    let clientGone = false;
    res.on("close", () => {
      clientGone = true;
      reader.cancel().catch(() => {});
    });

    const dec = new TextDecoder();
    let buf = "";
    let usage = null;
    let finish = null;
    try {
      for (;;) {
        if (clientGone) break;
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const data = s.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            const text = (j.candidates?.[0]?.content?.parts || [])
              .map((p) => p.text || "")
              .join("");
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
            if (j.usageMetadata) usage = j.usageMetadata;
            if (j.candidates?.[0]?.finishReason)
              finish = j.candidates[0].finishReason;
          } catch {
            // malformed chunk — skip, never log the chunk
          }
        }
      }
      if (finish && finish !== "STOP")
        res.write(
          `data: ${JSON.stringify({
            text: "\n\n[Analysis was cut short — try a narrower date range.]",
          })}\n\n`
        );
      res.write("data: [DONE]\n\n");
    } catch (e) {
      console.error("analyst relay", String(e.message || e));
    } finally {
      // Token counts + a bare finish-reason enum only — safe to log, no
      // payload, no text.
      if (usage)
        console.log(
          "analyst usage",
          servedModel,
          usage.promptTokenCount,
          usage.candidatesTokenCount,
          usage.thoughtsTokenCount,
          usage.totalTokenCount,
          finish
        );
      try {
        res.end();
      } catch {
        // client already gone — nothing to flush
      }
    }

    async function refund(docRef, per) {
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(docRef);
          const d = snap.exists ? snap.data() : null;
          if (d && d.analystPeriod === per && Number(d.analystCalls) > 0) {
            tx.set(
              docRef,
              { analystCalls: Number(d.analystCalls) - 1 },
              { merge: true }
            );
          }
        });
      } catch (e) {
        console.error("analyst refund failed", String(e.message || e));
      }
    }
  }
);

// ── stripeWebhook ───────────────────────────────────────────────────────────
// Stripe's callback. Signature-verified against the raw body, then mirrored
// into Firestore as the single source of truth for entitlement.
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], cors: false },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (e) {
      // A signature failure means the payload isn't from Stripe — never act.
      res.status(400).send(`signature: ${e.message}`);
      return;
    }

    try {
      const o = event.data.object;
      if (event.type === "checkout.session.completed") {
        // The session itself carries no status; read the subscription it made.
        const sub = await stripe.subscriptions.retrieve(o.subscription);
        await write(o.client_reference_id || o.customer_email, sub);
      } else if (event.type.startsWith("customer.subscription.")) {
        // metadata.email is set at creation; fall back to the customer record
        // for subscriptions created outside our checkout (e.g. in the
        // dashboard by hand).
        let email = (o.metadata && o.metadata.email) || null;
        if (!email) {
          const c = await stripe.customers.retrieve(o.customer);
          email = c && !c.deleted ? c.email : null;
        }
        await write(email, o);
      }
      res.json({ received: true });
    } catch (e) {
      // 500 so Stripe retries — a dropped event would strand a paying user.
      console.error("webhook handler failed", event.type, e);
      res.status(500).send("handler error");
    }

    async function write(email, sub) {
      if (!email) {
        console.error("no email for subscription", sub && sub.id);
        return;
      }
      const item = sub.items && sub.items.data && sub.items.data[0];
      const plan =
        item && item.price && item.price.id === PRICES.monthly
          ? "monthly"
          : "annual";
      // Recent API versions moved the period boundary off the subscription and
      // onto each item; keep reading both so this survives either shape.
      const periodEnd =
        sub.current_period_end || (item && item.current_period_end) || null;
      await subDoc(String(email).toLowerCase()).set(
        {
          status: sub.status,
          plan,
          subscriptionId: sub.id,
          customerId: String(sub.customer),
          currentPeriodEnd: periodEnd,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
);
