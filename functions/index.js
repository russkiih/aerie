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

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

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
const TRIAL_DAYS = 7;

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

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        client_reference_id: email,
        line_items: [{ price: PRICES[plan], quantity: 1 }],
        subscription_data: {
          trial_period_days: TRIAL_DAYS,
          metadata: { email, plan },
        },
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
