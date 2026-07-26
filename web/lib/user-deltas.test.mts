// Standalone unit test for the user-delta baselines.
// Run: node web/lib/user-deltas.test.mts
//
// The whole point of this feature is behaviour across days and reloads, which
// is exactly what you cannot check by clicking around for five minutes. Time
// is injected (the `today` argument) so a multi-day sequence runs instantly.
import assert from "node:assert/strict";

// Minimal localStorage stand-in — the module only ever uses these three.
let backing: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in backing ? backing[k] : null),
  setItem: (k: string, v: string) => {
    backing[k] = String(v);
  },
  removeItem: (k: string) => {
    delete backing[k];
  },
};

const { recordUserCounts, localDay, clearUserBaselines } = await import(
  "./user-deltas.ts"
);

const reset = () => {
  backing = {};
};
const visit = (count: number | null, day: string) =>
  recordUserCounts([{ id: "p1", userCount: count }], day)["p1"];

// ── the confirmed trace ─────────────────────────────────────────────────────
reset();
assert.equal(visit(14, "2026-07-20"), undefined, "first sight is silent");
assert.equal(visit(16, "2026-07-21"), 2, "next day shows the delta");
assert.equal(visit(16, "2026-07-21"), 2, "a same-day reload must not eat it");
assert.equal(visit(18, "2026-07-21"), 4, "same-day growth accumulates");
assert.equal(visit(18, "2026-07-22"), undefined, "seen yesterday → clears");

// Skip two days: the delta is measured from what was last actually seen (18),
// not from the original baseline and not reset to the newest count.
reset();
visit(14, "2026-07-20");
visit(18, "2026-07-21");
assert.equal(visit(22, "2026-07-24"), 4, "gap days accumulate, not reset");

// Never visiting between two growth spurts still yields one combined badge.
reset();
visit(10, "2026-07-20");
assert.equal(visit(13, "2026-07-25"), 3);

// ── failure and edge cases ──────────────────────────────────────────────────

// A failed/absent user count must not touch the baseline. If it did, the next
// successful load would treat the entire user base as brand new.
reset();
visit(100, "2026-07-20");
assert.equal(visit(null, "2026-07-21"), undefined, "null is skipped");
assert.equal(visit(103, "2026-07-22"), 3, "baseline survived the failure");

// Deleted users: the count drops, so the baseline drops with it rather than
// leaving a high-water mark that swallows the next real signups.
reset();
visit(50, "2026-07-20");
visit(50, "2026-07-21");
assert.equal(visit(40, "2026-07-22"), undefined, "a drop shows no badge");
assert.equal(visit(42, "2026-07-23"), 2, "growth measured from the new floor");

// Corrupt or hand-edited storage must degrade to "first sight", not throw.
reset();
backing["aerie_user_baselines_v1"] = "{not json";
assert.equal(visit(7, "2026-07-20"), undefined);
assert.equal(visit(9, "2026-07-21"), 2);

reset();
backing["aerie_user_baselines_v1"] = JSON.stringify({ p1: { baseline: "x" } });
assert.equal(visit(7, "2026-07-20"), undefined, "invalid entry → re-baselined");

// Multiple projects are tracked independently.
reset();
recordUserCounts(
  [
    { id: "a", userCount: 5 },
    { id: "b", userCount: 100 },
  ],
  "2026-07-20"
);
const many = recordUserCounts(
  [
    { id: "a", userCount: 6 },
    { id: "b", userCount: 100 },
  ],
  "2026-07-21"
);
assert.deepEqual(many, { a: 1 }, "only the project that grew gets a badge");

// Stale projects are pruned so storage can't grow without bound.
reset();
visit(5, "2026-01-01");
recordUserCounts([{ id: "other", userCount: 1 }], "2026-07-20");
assert.ok(
  !("p1" in JSON.parse(backing["aerie_user_baselines_v1"])),
  "entry older than the prune window is dropped"
);

// A project absent from this load (not just null) keeps its baseline.
reset();
visit(30, "2026-07-20");
recordUserCounts([{ id: "other", userCount: 1 }], "2026-07-21");
assert.equal(visit(33, "2026-07-22"), 3, "absence is not a reset");

// localDay is local-calendar, zero-padded.
assert.equal(localDay(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
assert.equal(localDay(new Date(2026, 11, 31, 0, 1)), "2026-12-31");

// clearUserBaselines wipes everything.
reset();
visit(9, "2026-07-20");
clearUserBaselines();
assert.equal(visit(50, "2026-07-21"), undefined, "cleared → silent first sight");

console.log("user-deltas: all assertions passed");
