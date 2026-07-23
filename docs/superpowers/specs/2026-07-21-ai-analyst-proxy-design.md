# AI Analyst Proxy — Design

**Date:** 2026-07-21
**Status:** Approved for planning
**Touches:** `functions/index.js`, `web/lib/analyst.ts`, `web/components/LiveApp.tsx`, `scripts/verify-live.mjs`

## Problem

`MONETIZATION.md` and the landing page both promise Cloud Pro includes an
"AI analyst included — no key needed". Today the analyst is bring-your-own-key
everywhere: the key lives in `localStorage` and the browser calls the provider
directly. Nothing about Pro currently delivers on that promise.

Making it real means Aerie has to supply the key, and a key cannot ship in a
browser bundle. So the calls must route through the billing Functions — which
means Aerie's server sees the analyst payload in flight. That is the first time
any user project data crosses Aerie's infrastructure, and it is in tension with
the promise written into `functions/index.js`:

> It deliberately never touches a user's Firebase estate: the only thing stored
> is `<verified email → subscription status>`. Project data keeps flowing
> browser → Google, exactly as before.

This design keeps that promise as close to intact as a proxy allows: the data
passes through memory and is never stored.

## Scope of what actually crosses the wire

The analyst payload is already **aggregated metrics, not raw records**: user
counts, Firestore document and collection counts, GA4 daily actives, top page
paths, referrer sources, countries, devices, operating systems, event names,
sign-in methods, signups by month, enabled services.

No end-user PII, no Firestore document contents, no credentials. The sensitive
edge is page paths and referrer domains, which can reveal unreleased product
surface. That is the exposure being accepted.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Proxy posture | Zero-retention passthrough | Forwards the same snapshot the browser already builds; persists nothing but a usage counter. Keeps the privacy pitch materially intact and is the least code. |
| Free-tier access | Analyst locked → upgrade prompt | The analyst is the headline upgrade driver, so it is not given away on cloud free. BYOK on cloud exists only on Pro (as overflow). |
| Spend control | Monthly quota + Pro-only BYOK overflow | The BYOK path already exists and becomes the overflow valve for Pro at no build cost. |
| Provider | Google Gemini | Owner already holds a Gemini key; ~4× cheaper than Opus-tier for this workload. |
| Model | `gemini-3.6-flash`, pinned | Newest Flash tier; cheaper output than 3.5 Flash. Pinned rather than auto-detected — see below. |
| Included quota | 100 analyses / month | ~$2.70 worst-case against $9 revenue. High enough that normal use never sees it; low enough to wall off a scripted caller. |
| Transport | SSE streaming through the Function | Preserves the token-by-token render BYOK users already get. |

### Cost basis (verified 2026-07-21)

Gemini 3.6 Flash: $1.50 / 1M input, $7.50 / 1M output.
Estimated payload ~5–10k input, ~2k output → **~$0.027 per analysis**.

**This estimate is not yet trusted.** Gemini 3.x does extended thinking and
thinking tokens bill as output, so real cost may land above $0.027. See
Calibration below — the 100/month cap is provisional until measured.

## Architecture

```
Self-host            → BYOK (any provider), browser → provider directly
Cloud Free           → analyst LOCKED, upgrade prompt (no BYOK on cloud free)
Cloud Pro            → browser → analyst Function → Gemini 3.6 Flash
Cloud Pro + own key  → BYOK, bypasses the proxy, quota untouched
```

Two deliberate rows:

- **Cloud Free is locked.** The analyst is the headline reason to upgrade, so it
  is not given away on the free cloud tier — the panel shows an upgrade prompt
  instead of a key field. (Self-host keeps BYOK forever; that is the
  open-source promise, and self-host never touches the billing backend.)
- **Cloud Pro + own key keeps the direct browser path.** Their key, their bill,
  no counter touched — and it is the same input that becomes the overflow when
  the monthly quota is exhausted. BYOK on cloud therefore exists *only* on Pro,
  as the overflow valve.

A fourth Cloud Function, `analyst`, joins `tier`, `checkout`, and
`stripeWebhook`. It reuses the existing `verifiedEmail()` helper, the shared
`cors()` helper, and the same fail-closed posture.

### Why the proxy pins its model

`analyst.ts` resolves the Gemini model at runtime via `ListModels`, picking by
preference. That is correct for BYOK — every user's key exposes a different
model set, and Google retires model IDs for new keys often.

The proxy controls its own key, so discovery buys nothing and costs a round-trip
per analysis plus the risk of silently drifting onto a pricier model as Google's
catalog shifts. The proxy pins `gemini-3.6-flash`. The auto-detect path stays
untouched for BYOK.

## Components

### `functions/index.js` — new `analyst` export

- Secret: `GEMINI_API_KEY` via `defineSecret`, alongside the two Stripe secrets.
- Verifies the caller with the existing `verifiedEmail()`.
- Reads `subscriptions/{email}`; rejects unless `isPro(status)`.
- Reserves quota in a transaction (below), then calls Gemini with
  `?alt=sse` and relays the stream to the browser.
- On a hard Gemini failure, refunds the reservation.

### `web/lib/analyst.ts` — new cloud path

- Add a `runAnalystViaCloud(googleToken, payload, onText)` alongside the existing
  `runAnalyst(apiKey, ...)`.
- Reuses the existing `readSse` helper rather than adding a second transport.
- Selection logic lives at the call site, not inside the analyst module. The
  resolution order:
  1. A stored BYOK key always wins (self-host, or a Pro user who pasted one).
  2. Else cloud Pro → the proxy.
  3. Else cloud Free → **locked**, upgrade prompt (no key field).
  4. Self-host with no key → the existing "add a key" prompt (unchanged).

### `web/components/LiveApp.tsx`

- Analyst panel routes per the resolution order above.
- **Cloud Free** shows a locked state — the AI panel presents "Upgrade to Pro
  for the AI analyst", not a key input. This is the design change from the
  previous BYOK-on-free behavior.
- Quota-exhausted (Pro) renders the add-your-key overflow: the message plus the
  existing key input directly beneath it.

### Firestore

Two new fields on the **existing** `subscriptions/{email}` document. No new
collection, and no `firestore.rules` change — that collection already denies all
client access and is written only by the backend via the admin SDK.

```js
{
  status: "active",
  plan: "annual",
  // ...existing fields...
  analystCalls: 12,        // count within the current period
  analystPeriod: "2026-07" // YYYY-MM stamp
}
```

## Quota accounting

**Implicit monthly reset.** `analystPeriod` stores a `YYYY-MM` stamp. On read, if
the stored period does not equal the current month, the counter is treated as
zero and rewritten with the new period. No cron job, no scheduled function, no
reset infrastructure.

**Reserve-then-refund, inside a Firestore transaction, before calling Gemini:**

1. Read the doc in a transaction.
2. If `analystPeriod !== currentMonth`, reset `analystCalls` to 0.
3. If `analystCalls >= 100`, abort with the quota-exhausted response.
4. Increment `analystCalls` and commit.
5. Call Gemini.
6. On a hard failure before any tokens stream, decrement in a second transaction.

Counting *after* success would let concurrent requests slip past the cap.
Reserving first fails closed on spend, which is the correct side to err on when
the bill lands on the owner's card. The refund makes a failed call not cost the
user a credit.

A failure *mid-stream* (after tokens have already been delivered) is not
refunded — the tokens were billed by Google, and the user received partial value.

## Zero-retention rules

These are enforcement details, not aspirations. The natural debugging instinct
violates every one of them, so they belong in the code as comments:

- **Never `console.log` a request body, a payload, or generated text.** Cloud
  Logging is retention. Log error types and token counts only.
- **Firestore writes touch only `analystCalls` and `analystPeriod`.** Never the
  snapshot, never the analysis.
- **No response caching.** Each call is forwarded and forgotten.
- Errors log the Gemini error type and HTTP status, never the request that
  produced them.

## Error handling

Mirrors the mapping shape introduced for checkout in commit `41285d6` — accurate
internally, actionable externally.

| Condition | HTTP | User sees |
|---|---|---|
| Missing / expired / wrong-audience token | 401 | "Session expired — reconnect your Google account and try again." |
| Verified but not Pro | 403 | "The included AI analyst is a Cloud Pro feature." |
| Quota exhausted | 429 | "You've used your 100 included analyses this month. Add your own API key to keep going." — rendered directly above the key input. |
| Gemini error or timeout | 502 | "The analyst is unavailable right now — try again shortly." |

The client maps these by status code, not by string matching on the message.

## Testing

`scripts/verify-live.mjs` gains a mocked `analyst` endpoint following the
existing `MOCK_TIER` / `MOCK_CHECKOUT_FAILS` pattern:

1. **Pro, no BYOK key** → analysis streams and renders, no key prompt shown.
2. **Pro, quota exhausted (429)** → add-your-key overflow message appears and
   the key input is visible beneath it.
3. **Pro, BYOK key set** → the mocked proxy endpoint is never called
   (asserted by request interception), confirming BYOK bypasses the quota.
4. **Cloud Free** → analyst panel shows the "Upgrade to Pro" locked state; no
   key input, and the proxy endpoint is never called.
5. **Self-host build** → existing BYOK prompt, unchanged.

Cases 3, 4, and 5 are the regression guards: case 4 proves Free can't reach the
analyst at all, and 3/5 prove the proxy did not accidentally become the path for
users who should never touch it.

## Calibration

The 100/month cap is provisional. Ship with the Function logging
`usageMetadata.promptTokenCount` and `usageMetadata.candidatesTokenCount` per
call — **counts only, never payloads**, which stays consistent with the
zero-retention rules above.

After roughly a week of real usage, compute actual cost per analysis and set the
final cap. If thinking tokens push cost materially above the $0.027 estimate,
the levers in order of preference are: configure Gemini's thinking behavior for
this bounded task, lower the cap, or move to Gemini 2.5 Flash (~$0.007 per
analysis, ~4× cheaper again).

## Out of scope

- Changing the BYOK *transport*. The multi-provider `runAnalyst(apiKey, ...)`
  path stays untouched; only *where it is offered* changes (removed from cloud
  free, kept on self-host and as the Pro overflow).
- Storing generated analyses for history, trends, or the weekly digest. That is
  a separate decision with a different privacy posture; if it happens, it gets
  its own spec.
- Any change to how project data reaches the browser. Aerie still reads Google
  APIs client-side; the proxy only forwards the derived snapshot.
