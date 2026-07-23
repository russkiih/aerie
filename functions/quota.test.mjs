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

// A negative counter must not grant free calls (clamped to zero).
assert.deepEqual(
  reserveQuota({ analystCalls: -5, analystPeriod: "2026-07" }, "2026-07", CAP),
  { allowed: true, calls: 1, period: "2026-07" }
);

console.log("OK  quota helper");
