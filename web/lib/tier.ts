// Cloud-tier gating.
//
// Gating applies ONLY to the hosted cloud build (NEXT_PUBLIC_AERIE_CLOUD=1,
// set by the deploy workflow). Self-hosted builds — anyone who clones this
// repo — get everything unlocked, always: that is the open-source promise.
//
// During early access there is no billing: "upgrading" just flips a local
// flag, free. When Stripe lands, activatePro() is replaced by checkout.

export const IS_CLOUD = process.env.NEXT_PUBLIC_AERIE_CLOUD === "1";

export const FREE_PROJECT_LIMIT = 3;
// The only traffic window on the free cloud tier.
export const FREE_RANGE = 28;

const KEY = "aerie_tier_v1";

export type Tier = "free" | "pro";

export function getTier(): Tier {
  if (!IS_CLOUD) return "pro"; // self-hosted: no caps, ever
  try {
    return localStorage.getItem(KEY) === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

export function activatePro() {
  try {
    localStorage.setItem(KEY, "pro");
  } catch {}
}
