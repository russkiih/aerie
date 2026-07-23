# AI Analyst Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the "AI analyst included in Pro — no key needed" promise: a Cloud Function that proxies analyst requests to Gemini on Aerie's key, quota-capped per subscriber, with cloud-free locked and BYOK kept as the Pro overflow and the self-host path.

**Architecture:** A fourth Cloud Function `analyst` verifies the caller's Google token (reusing `verifiedEmail`), checks Pro status, reserves a monthly quota credit in a Firestore transaction, then streams Gemini's SSE response back to the browser. The client picks a transport by tier: a stored BYOK key wins; else cloud-Pro uses the proxy; else cloud-free shows a locked upgrade prompt. Nothing but a two-field counter is persisted.

**Tech Stack:** Firebase Cloud Functions v2 (Node 20, global `fetch`), Firestore, Next.js static export, Gemini `streamGenerateContent` SSE, Playwright route-interception harness.

## Global Constraints

- **Model:** `gemini-3.6-flash`, pinned literally in the Function. Never auto-detected on the proxy path.
- **Quota:** 100 analyses per subscriber per calendar month. Constant `ANALYST_CAP = 100`.
- **Zero-retention:** the Function MUST NOT `console.log` any request body, payload, snapshot, or generated text. Log only error types, HTTP status, and token counts. Firestore writes touch ONLY `analystCalls` and `analystPeriod` on `subscriptions/{email}` — never the payload or the analysis.
- **Reserve-then-refund:** increment the counter in a transaction BEFORE calling Gemini; refund (decrement) only on a failure that happens before any token has streamed.
- **Node 20 has global `fetch`** — do not add a fetch dependency.
- **Secret name:** `GEMINI_API_KEY` via `defineSecret`.
- **Function base URL** on the client is the existing `FN` constant in `web/lib/tier.ts`: `https://us-central1-aerie-dashboard-app.cloudfunctions.net`.
- **BYOK transport is unchanged.** The existing `runAnalyst(apiKey, payload, onText)` multi-provider path in `web/lib/analyst.ts` is not modified; only *where it is offered* changes.

---

## File Structure

- `functions/quota.js` — **new.** Pure, dependency-free quota arithmetic (`reserveQuota`). Unit-tested by a node assert script. Extracted so the month-reset + cap logic is testable without the emulator.
- `functions/quota.test.mjs` — **new.** Standalone node assert script (repo's "scripts that assert" pattern; no framework).
- `functions/index.js` — **modify.** Add the `GEMINI_API_KEY` secret and the `analyst` `onRequest` export. Reuses `cors`, `verifiedEmail`, `subDoc`, `isPro`, `db`.
- `web/lib/analyst.ts` — **modify.** Add `runAnalystViaCloud(googleToken, payload, onText)` and a `QuotaExhaustedError` class. Reuses the existing `readSse` helper. BYOK path untouched.
- `web/components/LiveApp.tsx` — **modify.** `DetailModal` analyst panel: resolution order (BYOK → cloud-Pro proxy → cloud-free locked), quota-exhausted overflow reveals the key field. `pro` and `onUpgrade` are already props — no plumbing.
- `scripts/verify-live.mjs` — **modify.** Mock the `analyst` SSE endpoint; stop unconditionally injecting a BYOK key; assert the three new states.
- `web/components/LiveApp.tsx` (copy) + `README.md` — **modify.** Truthfulness pass: the "included — no key needed" line is now real; keep it, but the free-tier card copy stops implying free BYOK.

---

## Task 1: Pure quota helper + unit test

**Files:**
- Create: `functions/quota.js`
- Test: `functions/quota.test.mjs`

**Interfaces:**
- Produces: `reserveQuota(doc, currentPeriod, cap)` → `{ allowed: boolean, calls: number, period: string }`. `doc` is the Firestore document data (or `null`), `currentPeriod` is a `"YYYY-MM"` string, `cap` is a number. Returns the counter state to WRITE (caller commits it) and whether the call is allowed. On a new period the count resets to 1 (the reservation itself). When already at cap, `allowed:false` and the count is unchanged.

- [ ] **Step 1: Write the failing test**

Create `functions/quota.test.mjs`:

```js
// Standalone unit test for the pure quota helper. Run: node functions/quota.test.mjs
import assert from "node:assert/strict";
import { reserveQuota } from "./quota.js";

const CAP = 100;

// First-ever call: no doc → reserve #1 for this period.
assert.deepEqual(reserveQuota(null, "2026-07", CAP), {
  allowed: true,
  calls: 1,
  period: "2026-07",
});

// Same period, under cap → increment.
assert.deepEqual(
  reserveQuota({ analystCalls: 12, analystPeriod: "2026-07" }, "2026-07", CAP),
  { allowed: true, calls: 13, period: "2026-07" }
);

// New month → counter resets to 1, period rolls forward.
assert.deepEqual(
  reserveQuota({ analystCalls: 100, analystPeriod: "2026-06" }, "2026-07", CAP),
  { allowed: true, calls: 1, period: "2026-07" }
);

// At cap in the current period → denied, count unchanged.
assert.deepEqual(
  reserveQuota({ analystCalls: 100, analystPeriod: "2026-07" }, "2026-07", CAP),
  { allowed: false, calls: 100, period: "2026-07" }
);

// Missing fields on an existing subscription doc → treat as zero this period.
assert.deepEqual(reserveQuota({ status: "active" }, "2026-07", CAP), {
  allowed: true,
  calls: 1,
  period: "2026-07",
});

console.log("OK  quota helper");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node functions/quota.test.mjs`
Expected: FAIL — `Cannot find module './quota.js'` (or `reserveQuota is not a function`).

- [ ] **Step 3: Write minimal implementation**

Create `functions/quota.js`:

```js
// Pure quota arithmetic for the AI-analyst proxy. No Firebase, no I/O — the
// caller reads the doc, calls this, and commits the returned counter state.
//
// The monthly reset is implicit: if the stored period is not the current
// month, the counter is treated as zero before this reservation. That is why
// there is no cron job — the first call of a new month rolls the period.
function reserveQuota(doc, currentPeriod, cap) {
  const samePeriod = doc && doc.analystPeriod === currentPeriod;
  const priorCalls = samePeriod ? Number(doc.analystCalls) || 0 : 0;
  if (priorCalls >= cap) {
    return { allowed: false, calls: priorCalls, period: currentPeriod };
  }
  return { allowed: true, calls: priorCalls + 1, period: currentPeriod };
}

module.exports = { reserveQuota };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node functions/quota.test.mjs`
Expected: `OK  quota helper`

- [ ] **Step 5: Commit**

```bash
git add functions/quota.js functions/quota.test.mjs
git commit -m "Add pure quota helper for the analyst proxy"
```

---

## Task 2: The `analyst` Cloud Function

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: `reserveQuota` from `./quota.js`; existing `cors`, `verifiedEmail`, `subDoc`, `isPro`, `db`, `admin`, `defineSecret`, `onRequest`.
- Produces: HTTPS endpoint `POST /analyst` accepting `{ googleToken, payload }`. On success streams `text/event-stream` with `data: {"text":"..."}` lines and a final `data: [DONE]`. Errors return JSON `{ error }` with status 401 / 403 / 429 / 502.

- [ ] **Step 1: Add the secret and the system prompt constant**

In `functions/index.js`, add after the existing `STRIPE_WEBHOOK_SECRET` definition:

```js
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
```

And after the `PRICES` / `TRIAL_DAYS` block, add:

```js
// The included analyst is pinned to one model on one key we own — no runtime
// model discovery (that is only correct for BYOK, where each key exposes a
// different model set). See docs/superpowers/specs/2026-07-21-ai-analyst-proxy-design.md.
const ANALYST_MODEL = "gemini-3.6-flash";
const ANALYST_CAP = 100;

// Kept in sync with the BYOK system prompt in web/lib/analyst.ts. The proxy
// holds it server-side so the browser only sends the metrics snapshot.
const ANALYST_SYSTEM = `You are Aerie's growth analyst. Aerie is a dashboard that shows a developer live metrics for their Firebase projects. You receive a JSON snapshot of one project's real numbers: users, Firestore documents and collections, GA4 traffic (daily active users for the selected window plus the previous window for comparison), traffic sources (top pages, referral sources, countries, devices, operating systems, events), sign-in methods, signups by month, and enabled Firebase services.

Write a short, concrete analysis for the developer who owns this app:

Insights
- 3 to 5 bullets, ranked by importance. Each grounded in specific numbers from the snapshot (cite them). Call out what is working, what looks like a problem, and anything that looks like bot/crawler noise rather than real users.

Actions
- 2 to 3 bullets. Specific next moves this developer should make, derived from the insights.

Rules: plain text only — exactly the two section headers above, bullets starting with "- ". No preamble, no closing paragraph, no markdown syntax beyond the bullets. Keep every bullet to 1-2 sentences. If a section of the snapshot is null or empty, don't speculate about it.`;
```

Add the `reserveQuota` import at the top with the other requires:

```js
const { reserveQuota } = require("./quota.js");
```

- [ ] **Step 2: Write the `analyst` export**

Add after the existing `exports.checkout` block in `functions/index.js`:

```js
// ── analyst ───────────────────────────────────────────────────────────────
// The Cloud Pro analyst. Verifies the caller, enforces a monthly quota, then
// relays Gemini's SSE stream to the browser. ZERO RETENTION: the payload and
// the generated text pass through memory and are never logged or stored. The
// only Firestore write touches the two counter fields — see quota.js.
exports.analyst = onRequest(
  { secrets: [STRIPE_SECRET_KEY, GEMINI_API_KEY], cors: false },
  async (req, res) => {
    if (cors(req, res)) return;
    // A YYYY-MM stamp; used both for the quota period and the reset check.
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}`;

    let email;
    try {
      const body = req.body || {};
      email = await verifiedEmail(body.googleToken);
      var payload = body.payload; // eslint-disable-line no-var
      if (!payload || typeof payload !== "object")
        throw new Error("missing payload");
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

    // Call Gemini. If this fails before any token streams, refund the credit.
    let gRes;
    try {
      gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${ANALYST_MODEL}:streamGenerateContent?alt=sse`,
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
          }),
        }
      );
    } catch (e) {
      await refund(ref, period);
      console.error("analyst fetch failed", String(e.message || e));
      res.status(502).json({ error: "analyst unavailable" });
      return;
    }

    if (!gRes.ok || !gRes.body) {
      await refund(ref, period);
      console.error("analyst upstream", gRes.status);
      res.status(502).json({ error: "analyst unavailable" });
      return;
    }

    // Relay the stream. Once headers are sent we cannot change the status, and
    // the credit is NOT refunded past this point (Gemini has begun billing).
    res.set("Content-Type", "text/event-stream");
    res.set("Cache-Control", "no-cache");
    res.set("Connection", "keep-alive");

    const reader = gRes.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let usage = null;
    try {
      for (;;) {
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
          } catch {
            // malformed chunk — skip, never log the chunk
          }
        }
      }
      res.write("data: [DONE]\n\n");
    } catch (e) {
      console.error("analyst relay", String(e.message || e));
    } finally {
      // Token counts only — safe to log, no payload, no text.
      if (usage)
        console.log(
          "analyst usage",
          usage.promptTokenCount,
          usage.candidatesTokenCount
        );
      res.end();
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
```

- [ ] **Step 3: Add the CORS origin note (no code change if already covered)**

Verify `ALLOWED_ORIGINS` in `functions/index.js` already contains the live app origin (`https://aerie-dashboard-app.web.app`) — it does. No change needed; the shared `cors()` helper covers the new endpoint.

- [ ] **Step 4: Set the secret value**

Run (interactive — you paste the Gemini key when prompted):

```bash
cd functions && npx firebase-tools functions:secrets:set GEMINI_API_KEY
```

Expected: prompt "Enter a value for GEMINI_API_KEY", then "Created a new secret version".

> If you are an agent without the key, STOP and ask the owner to run this line. The deploy in Task 6 fails without it.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "Add the analyst Cloud Function: Gemini proxy with monthly quota"
```

---

## Task 3: Client cloud transport

**Files:**
- Modify: `web/lib/analyst.ts`

**Interfaces:**
- Consumes: the existing module-private `readSse(res, pick, onText)` helper.
- Produces:
  - `class QuotaExhaustedError extends Error` — thrown when the proxy returns 429.
  - `runAnalystViaCloud(googleToken: string, payload: object, onText: (delta: string) => void): Promise<string>` — POSTs to `${FN}/analyst`, streams the relay, returns the full text. Throws `QuotaExhaustedError` on 429, a plain `Error` with a friendly message otherwise.

- [ ] **Step 1: Add the cloud constants and error type**

At the top of `web/lib/analyst.ts`, below the existing imports, add:

```ts
// The billing Functions base — same host the tier/checkout calls use.
const FN = "https://us-central1-aerie-dashboard-app.cloudfunctions.net";

// Thrown when the caller has spent their monthly included analyses. The UI
// catches this specifically to reveal the bring-your-own-key overflow.
export class QuotaExhaustedError extends Error {
  constructor() {
    super("monthly-limit");
    this.name = "QuotaExhaustedError";
  }
}
```

- [ ] **Step 2: Add the cloud transport function**

At the end of `web/lib/analyst.ts`, add:

```ts
// Cloud Pro analyst: the browser sends its verified Google token plus the same
// metrics snapshot the BYOK path builds, and the Function relays Gemini's
// stream. The provider key never touches the browser here.
export async function runAnalystViaCloud(
  googleToken: string,
  payload: object,
  onText: (delta: string) => void
): Promise<string> {
  const res = await fetch(`${FN}/analyst`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googleToken, payload }),
  });
  if (res.status === 429) throw new QuotaExhaustedError();
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    const raw = String(d.error || "");
    throw new Error(
      /token|audience|email/i.test(raw)
        ? "Session expired — reconnect your Google account and try again."
        : res.status === 403
        ? "The included AI analyst is a Cloud Pro feature."
        : "The analyst is unavailable right now — try again shortly."
    );
  }
  // Relay frames are { text } objects, terminated by [DONE].
  return readSse(res, (j) => j.text || "", onText);
}
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add web/lib/analyst.ts
git commit -m "Add the cloud analyst transport with quota-exhausted signalling"
```

---

## Task 4: LiveApp analyst panel — tier-aware routing

**Files:**
- Modify: `web/components/LiveApp.tsx`

**Interfaces:**
- Consumes: `runAnalystViaCloud`, `QuotaExhaustedError` from `@/lib/analyst`; existing `pro` and `onUpgrade` props on `DetailModal`; `IS_CLOUD` from `@/lib/tier`.

- [ ] **Step 1: Extend the analyst imports**

In the `from "@/lib/analyst"` import block (around line 56), add `runAnalystViaCloud` and `QuotaExhaustedError`:

```ts
import {
  getAnalystKey,
  setAnalystKey,
  clearAnalystKey,
  runAnalyst,
  runAnalystViaCloud,
  QuotaExhaustedError,
  analystErrorMessage,
  detectProvider,
  providerLabel,
} from "@/lib/analyst";
```

Add `IS_CLOUD` to the existing `from "@/lib/tier"` import block if not already present.

- [ ] **Step 2: Add the quota-overflow state**

Inside `DetailModal`, next to the existing `const [aiKey, setAiKey] = useState<string | null>(null);` (line ~1406), add:

```ts
  const [quotaHit, setQuotaHit] = useState(false);
```

- [ ] **Step 3: Route `analyze()` by transport**

Replace the `try { await runAnalyst(...) } catch (e) { setAiError(...) }` block in `analyze()` (lines ~1455-1461) with:

```ts
    try {
      if (aiKey) {
        // BYOK — self-host, or a Pro user who pasted their own key.
        await runAnalyst(aiKey, payload, (d) => setAiText((s) => s + d));
      } else {
        // Cloud Pro included analyst, on our key.
        await runAnalystViaCloud(token!, payload, (d) =>
          setAiText((s) => s + d)
        );
      }
    } catch (e) {
      if (e instanceof QuotaExhaustedError) {
        setQuotaHit(true);
        setAiError(
          "You've used your 100 included analyses this month. Add your own API key to keep going."
        );
      } else {
        setAiError(analystErrorMessage(e));
      }
    } finally {
      setAiBusy(false);
    }
```

Also change the guard at the top of `analyze()` (line ~1418) from `if (!aiKey || aiBusy) return;` to:

```ts
    if (aiBusy) return;
    if (!aiKey && !token) return;
```

- [ ] **Step 4: Render three panel states**

Replace the panel body `{!aiKey ? ( ...BYOK prompt... ) : ( ...streaming... )}` (lines ~1771-1838) with a three-way branch. The new structure:

```tsx
          {/* Cloud-free: locked. No key field — the analyst is the upgrade driver. */}
          {IS_CLOUD && !pro && !aiKey ? (
            <div className="mt-3">
              <p className="text-[12px] leading-relaxed text-muted">
                The AI analyst reads this project&apos;s real numbers and returns
                concrete insights and next moves. It&apos;s included with{" "}
                <span className="text-ink">Cloud Pro</span>.
              </p>
              <button
                onClick={onUpgrade}
                className="mt-3 rounded-[9px] bg-accent px-4 py-2 text-[12px] font-semibold text-paper transition-opacity hover:opacity-90"
              >
                Upgrade to Pro
              </button>
            </div>
          ) : !aiKey && !(IS_CLOUD && pro) ? (
            /* Self-host (or any build) with no key: the existing BYOK prompt. */
            <div className="mt-3">
              <p className="text-[12px] leading-relaxed text-muted">
                Get concrete insights and next moves from this project&apos;s
                numbers. Paste an <span className="text-ink">Anthropic</span>,{" "}
                <span className="text-ink">OpenAI</span>,{" "}
                <span className="text-ink">Gemini</span>,{" "}
                <span className="text-ink">xAI</span> or{" "}
                <span className="text-ink">Groq</span> API key — the provider is
                detected automatically, the key stays in your browser, and calls
                go straight to that provider, billed to your key. Nothing
                touches Aerie&apos;s servers.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-ant-… · sk-… · AIza… · xai-… · gsk_…"
                  type="password"
                  className="min-w-0 flex-1 rounded-[9px] border border-line bg-panel px-3 py-2 font-mono text-[12px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => {
                    const k = keyInput.trim();
                    if (!k) return;
                    if (!detectProvider(k)) {
                      setAiError(
                        "Unrecognized key format — expected an Anthropic (sk-ant-), OpenAI (sk-), Gemini (AIza… or AQ.…), xAI (xai-) or Groq (gsk_) key."
                      );
                      return;
                    }
                    setAiError("");
                    setAnalystKey(k);
                    setAiKey(k);
                    setKeyInput("");
                  }}
                  className="shrink-0 rounded-[9px] bg-accent px-4 py-2 text-[12px] font-semibold text-paper transition-opacity hover:opacity-90"
                >
                  Save key
                </button>
              </div>
              {aiError && <p className="mt-2 text-[12px] text-warn">{aiError}</p>}
            </div>
          ) : (
            /* Cloud Pro (included, our key) OR any build with a BYOK key set. */
            <div className="mt-3">
              {aiText && (
                <p className="mb-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">
                  {aiText}
                </p>
              )}
              {aiError && <p className="mb-3 text-[12px] text-warn">{aiError}</p>}
              {/* Quota overflow: reveal the BYOK key field so Pro users can continue. */}
              {quotaHit && !aiKey && (
                <div className="mb-3 flex gap-2">
                  <input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="sk-ant-… · sk-… · AIza… · xai-… · gsk_…"
                    type="password"
                    className="min-w-0 flex-1 rounded-[9px] border border-line bg-panel px-3 py-2 font-mono text-[12px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const k = keyInput.trim();
                      if (!k || !detectProvider(k)) return;
                      setAnalystKey(k);
                      setAiKey(k);
                      setKeyInput("");
                      setQuotaHit(false);
                      setAiError("");
                    }}
                    className="shrink-0 rounded-[9px] bg-accent px-4 py-2 text-[12px] font-semibold text-paper transition-opacity hover:opacity-90"
                  >
                    Use my key
                  </button>
                </div>
              )}
              <button
                onClick={analyze}
                disabled={aiBusy}
                className="rounded-[9px] bg-accent px-4 py-2 text-[12px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {aiBusy
                  ? "Analyzing…"
                  : aiText
                  ? "Analyze again"
                  : "Analyze this project"}
              </button>
            </div>
          )}
```

- [ ] **Step 5: Typecheck and build**

Run: `cd web && npx tsc --noEmit && NEXT_PUBLIC_AERIE_CLOUD=1 npx next build`
Expected: `tsc` exits 0; build ends with `✓ Generating static pages` and the route table.

> If the build fails with `EBUSY: … rmdir 'web/out'`, a stray `http-server` is holding the directory. Kill it: `powershell "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'http-server' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"` then re-run.

- [ ] **Step 6: Commit**

```bash
git add web/components/LiveApp.tsx
git commit -m "Route the analyst panel by tier: locked free, proxy Pro, BYOK overflow"
```

---

## Task 5: Verify harness — mock the proxy and assert the three states

**Files:**
- Modify: `scripts/verify-live.mjs`

**Interfaces:**
- Consumes: the existing `ctx.route`, `MOCK_TIER`, and localStorage-injection patterns.

- [ ] **Step 1: Add a mocked analyst SSE endpoint and controls**

After the existing `cloudfunctions.net/(tier|checkout)` route block (ends ~line 314), add:

```js
// Analyst proxy. MOCK_ANALYST controls the outcome so the suite can exercise
// the included stream and the quota wall without a real Gemini call.
let MOCK_ANALYST = "ok"; // "ok" | "quota"
let analystProxyHits = 0;
await ctx.route(/cloudfunctions\.net\/analyst/, async (route) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (route.request().method() === "OPTIONS")
    return route.fulfill({ status: 204, headers: cors });
  analystProxyHits++;
  if (MOCK_ANALYST === "quota") {
    return route.fulfill({
      status: 429,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({ error: "monthly analyst limit reached" }),
    });
  }
  return route.fulfill({
    status: 200,
    headers: { ...cors, "Cache-Control": "no-cache" },
    contentType: "text/event-stream",
    body:
      'data: {"text":"Insights\\n- Mocked proxy insight."}\n\n' +
      "data: [DONE]\n\n",
  });
});
```

- [ ] **Step 2: Stop unconditionally injecting a BYOK key**

Find the localStorage init (around line 348) that sets `aerie_anthropic_key_v1`. Remove that single line so the default run has NO key — the analyst state now follows the tier. (The token injection on the same block stays.)

Delete:

```js
  localStorage.setItem("aerie_anthropic_key_v1", "AQ.Ab8-mock-key");
```

- [ ] **Step 3: Add the free-tier locked assertion**

The suite opens the modal while `MOCK_TIER = "free"` (default) early on. After the modal is open on free tier, add:

```js
console.log(
  (await page.getByText("included with").count()) > 0 &&
    (await page.getByRole("button", { name: "Upgrade to Pro" }).count()) > 0
    ? "OK  analyst locked on free tier"
    : "MISSING analyst free-tier lock"
);
```

- [ ] **Step 4: Add the Pro included-stream assertion**

After `MOCK_TIER = "pro"; await page.reload();` and the modal is reopened on Pro, add:

```js
MOCK_ANALYST = "ok";
const beforeHits = analystProxyHits;
await page.getByRole("button", { name: /Analyze this project/ }).click();
await page.waitForSelector("text=Mocked proxy insight", { timeout: 10000 });
console.log(
  analystProxyHits > beforeHits
    ? "OK  Pro analyst streams via the proxy"
    : "MISSING proxy stream"
);
```

- [ ] **Step 5: Add the quota-overflow assertion**

Immediately after Step 4's block:

```js
MOCK_ANALYST = "quota";
await page.getByRole("button", { name: /Analyze again/ }).click();
await page.waitForSelector("text=100 included analyses", { timeout: 10000 });
console.log(
  (await page.getByRole("button", { name: "Use my key" }).count()) > 0
    ? "OK  quota wall reveals BYOK overflow"
    : "MISSING quota overflow key field"
);
```

- [ ] **Step 6: Run the harness against a local Pro build**

```bash
cd web && rm -rf out && NEXT_PUBLIC_AERIE_CLOUD=1 npx next build
cd web/out && (npx --yes http-server -p 4176 --silent &) ; sleep 4
cd /d/CODE/aerie && TARGET_URL=http://localhost:4176 node scripts/verify-live.mjs 2>&1 | grep -iE "analyst|proxy|quota|DONE|MISSING"
```

Expected lines include:
```
OK  analyst locked on free tier
OK  Pro analyst streams via the proxy
OK  quota wall reveals BYOK overflow
DONE
```
No `MISSING` lines. Then kill the server:
```bash
powershell "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'http-server' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
```

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-live.mjs
git commit -m "Cover the analyst proxy: locked free, Pro stream, quota overflow"
```

---

## Task 6: Copy truthfulness + deploy

**Files:**
- Modify: `web/components/LiveApp.tsx` (pricing-card copy, line ~2174/2186)
- Modify: `README.md` (if it claims free BYOK anywhere)

**Interfaces:** none — copy only.

- [ ] **Step 1: Fix the free-card AI line**

In `web/components/LiveApp.tsx`, the Cloud Free `PriceCard` items list contains `"AI analyst with your own key"` (line ~2186). Change it to reflect that cloud-free no longer includes BYOK analyst:

```tsx
              "AI analyst on Pro",
```

Leave the **self-host** card's `"AI analyst with your own key"` (line ~2174) unchanged — that is still true.

Leave the Pro card's `"AI analyst included — no key needed"` (line ~2201) unchanged — this task makes it true.

- [ ] **Step 2: Scan README for a now-false claim**

Run: `grep -n "your own key\|BYOK\|analyst" README.md`
If any line says the *cloud free* tier includes a BYOK analyst, reword it to "AI analyst on Pro". If README only mentions self-host BYOK and Pro-included, no change.

- [ ] **Step 3: Typecheck and build**

Run: `cd web && npx tsc --noEmit && NEXT_PUBLIC_AERIE_CLOUD=1 npx next build`
Expected: exit 0; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/components/LiveApp.tsx README.md
git commit -m "Make the pricing copy match the locked-free analyst"
```

- [ ] **Step 5: Deploy the function, then push for hosting**

```bash
cd functions && npx firebase-tools deploy --only functions:analyst --non-interactive 2>&1 | tail -5
```
Expected: `functions[analyst(us-central1)] Successful create/update operation.`

Then push to deploy hosting:
```bash
cd /d/CODE/aerie && git push origin main
```
Expected: GitHub Actions "Deploy to Firebase Hosting" run starts.

- [ ] **Step 6: Smoke-test the live endpoint**

```bash
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST \
  "https://us-central1-aerie-dashboard-app.cloudfunctions.net/analyst" \
  -H "Content-Type: application/json" \
  -H "Origin: https://aerie-dashboard-app.web.app" \
  -d '{"googleToken":"bogus","payload":{}}'
```
Expected: `status=401` (bad token, fails closed — proves the endpoint is live and rejecting unverified callers). A `200` or `403` here would mean the auth guard is wrong.

- [ ] **Step 7: Confirm the deployed bundle carries the change**

```bash
# after the Actions run completes (gh run watch), fetch the live page chunk
cd /tmp && curl -s "https://aerie-dashboard-app.web.app/" -o i.html
C=$(grep -oE '/_next/static/chunks/app/page-[a-z0-9]+\.js' i.html | head -1)
curl -s "https://aerie-dashboard-app.web.app$C" | grep -c "Upgrade to Pro"
```
Expected: `1` (the locked-free copy shipped).

---

## Self-Review

**Spec coverage:**
- Zero-retention passthrough → Task 2 (no-log rules in comments + code).
- Free locked / Pro proxy / BYOK overflow → Task 4 (three-way panel), Task 5 (three assertions).
- Provider = Gemini, pinned model → Task 2 (`ANALYST_MODEL`), Global Constraints.
- 100/month quota, reserve-then-refund, implicit reset → Task 1 (pure helper + tests), Task 2 (transaction + refund).
- SSE streaming → Task 2 (relay), Task 3 (`readSse` reuse).
- Firestore two-field write, no rules change → Task 2 (`{ merge: true }` on the two fields only).
- Error mapping by status → Task 3 (`runAnalystViaCloud`), Task 2 (401/403/429/502).
- Calibration token logging (counts only) → Task 2 (`console.log("analyst usage", ...)`).
- Copy truthfulness → Task 6.

**Placeholder scan:** none — every code step shows complete code; every command shows expected output.

**Type consistency:** `runAnalystViaCloud(googleToken, payload, onText)` and `QuotaExhaustedError` are defined in Task 3 and consumed with the same names in Task 4. `reserveQuota(doc, currentPeriod, cap)` defined in Task 1, consumed in Task 2. `analystCalls` / `analystPeriod` field names identical across Tasks 1, 2, and the spec.

**Known human-gated steps:** Task 2 Step 4 (set the secret) and Task 6 Step 5 (deploy) need the owner's Gemini key and Firebase auth — flagged inline.
