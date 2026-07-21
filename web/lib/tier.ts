// Cloud-tier gating.
//
// Gating applies ONLY to the hosted cloud build (NEXT_PUBLIC_AERIE_CLOUD=1,
// set by the deploy workflow). Self-hosted builds — anyone who clones this
// repo — get everything unlocked, always: that is the open-source promise,
// and they never call the billing backend at all.
//
// Entitlement comes from the billing Functions (see /functions), keyed by the
// verified email behind the Google token the dashboard already holds. It is
// deliberately NOT read from localStorage any more: a value the browser owns
// is a value the browser can edit.
//
// Worth being honest about the limit, though — this raises the bar, it is not
// a lock. Everything Aerie renders is computed in the browser from the user's
// own Google APIs, so a determined person can always patch the client. Real
// enforcement would require the server to fetch your data, which is exactly
// the architecture this project refuses.

export const IS_CLOUD = process.env.NEXT_PUBLIC_AERIE_CLOUD === "1";

export const FREE_PROJECT_LIMIT = 3;
// The only traffic window on the free cloud tier.
export const FREE_RANGE = 28;

export type Tier = "free" | "pro";
export type Plan = "annual" | "monthly";

const FN = "https://us-central1-aerie-dashboard-app.cloudfunctions.net";

// Starting tier before the backend answers. Self-hosted is unconditionally
// pro; cloud starts free so a slow network can never flash paid features.
export function initialTier(): Tier {
  return IS_CLOUD ? "free" : "pro";
}

// Ask the backend what this token's owner is entitled to. Fails closed.
export async function fetchTier(googleToken: string): Promise<Tier> {
  if (!IS_CLOUD) return "pro";
  try {
    const r = await fetch(`${FN}/tier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleToken }),
    });
    const d = await r.json();
    return d && d.tier === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

// Hand off to Stripe Checkout. Resolves only on failure — on success the
// browser has already navigated away.
export async function startCheckout(
  googleToken: string,
  plan: Plan
): Promise<never | void> {
  const r = await fetch(`${FN}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googleToken, plan }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.url) {
    // The backend's token errors are accurate but unhelpful to a user — the
    // usual cause is simply the cached Google token ageing out after an hour.
    const raw = String(d.error || "");
    throw new Error(
      /token|audience|email/i.test(raw)
        ? "Session expired — reconnect your Google account and try again."
        : raw || "Could not start checkout"
    );
  }
  window.location.href = d.url;
}
