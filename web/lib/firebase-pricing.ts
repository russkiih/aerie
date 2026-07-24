// Firebase / Google Cloud pricing constants — the single source of truth for
// every free tool under /tools.
//
// VERIFIED 2026-07-24 against Google's own documentation:
//   - Free (Spark) quotas ......... https://firebase.google.com/pricing
//   - Firestore nam5 rates ........ https://firebase.google.com/docs/firestore/billing-example
//   - Firestore us-central1 ....... https://cloud.google.com/firestore/pricing
//
// Two rules for anyone editing this file:
//
// 1. NEVER put a rate here that you have not read off one of those pages
//    today. A calculator that quotes a wrong price is worse than no
//    calculator — it is confidently wrong, and people budget against it.
// 2. When you update a rate, move VERIFIED_ON. Every tool renders that date,
//    so a stale file is visible to the reader rather than silently rotting.

export const VERIFIED_ON = "2026-07-24";
export const PRICING_SOURCE = "https://firebase.google.com/pricing";

/** Firestore is ~2x more expensive multi-region than single-region. Most
 *  people never notice they picked nam5 at project-creation time. */
export type FirestoreRegion = "nam5" | "us-central1";

export const FIRESTORE = {
  nam5: {
    label: "Multi-region (nam5 / eur3)",
    readsPer100k: 0.06,
    writesPer100k: 0.18,
    deletesPer100k: 0.02,
    storagePerGiBMonth: 0.18,
  },
  "us-central1": {
    label: "Single region (us-central1)",
    readsPer100k: 0.03,
    writesPer100k: 0.09,
    deletesPer100k: 0.01,
    // Google publishes single-region storage at half the multi-region rate,
    // consistent with the per-operation ratio.
    storagePerGiBMonth: 0.09,
  },
} as const satisfies Record<FirestoreRegion, Record<string, unknown>>;

/** Network egress, charged the same across Firestore and Functions. */
export const EGRESS_PER_GIB = 0.12;

/** Free quotas on the Spark plan. Firestore's are per DAY; the rest monthly. */
export const FREE_TIER = {
  firestore: {
    readsPerDay: 50_000,
    writesPerDay: 20_000,
    deletesPerDay: 20_000,
    storedGiB: 1,
    egressGiBPerMonth: 10,
  },
  realtimeDb: {
    storedGB: 1,
    downloadedGBPerMonth: 10,
    simultaneousConnections: 100,
  },
  storage: {
    storedGB: 5,
    downloadedGBPerMonth: 100,
    uploadOpsPerMonth: 5_000,
    downloadOpsPerMonth: 50_000,
  },
  hosting: {
    storedGB: 10,
    transferMBPerDay: 360,
  },
  auth: {
    monthlyActiveUsers: 50_000,
  },
  functions: {
    // Cloud Functions require Blaze — there is no Spark allowance at all.
    availableOnSpark: false,
    invocationsPerMonth: 2_000_000,
    gbSecondsPerMonth: 400_000,
    cpuSecondsPerMonth: 200_000,
    egressGiBPerMonth: 5,
  },
} as const;

/** Blaze (pay-as-you-go) rates charged only past the free allowance above. */
export const BLAZE = {
  realtimeDb: {
    storagePerGB: 5.0,
    downloadPerGB: 1.0,
  },
  hosting: {
    storagePerGB: 0.026,
    transferPerGB: 0.15,
  },
  functions: {
    perMillionInvocations: 0.4,
    egressPerGB: 0.12,
  },
} as const;

/** Currency formatting shared by the tools. Sub-cent results are common at
 *  low volume, so don't round them away to a misleading "$0.00". */
export function usd(n: number): string {
  if (n === 0) return "$0.00";
  if (n > 0 && n < 0.01) return "<$0.01";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}
