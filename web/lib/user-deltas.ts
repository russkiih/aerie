// "+N new users since you last looked" badges on the project cards.
//
// Storage is localStorage and only localStorage. Putting this in Firestore
// would sync it across devices, but it would also mean the hosted version
// stores a per-project growth history for every subscriber — which directly
// contradicts the promise the footer makes on every page ("stores nothing but
// your email and plan"). A per-browser baseline is the honest trade.
//
// The mechanic, confirmed against the intended behaviour:
//
//   Mon  14 users        no badge      (first sight — baseline set, nothing "new")
//   Tue  16 users   +2                 (a new day, so the delta is vs. Monday)
//   Tue  reload     +2                 (same day — a refresh must not eat it)
//   Tue  18 users   +4                 (still vs. Monday: it accumulates)
//   Wed  18 users        no badge      (you saw 18 yesterday, so it's the new baseline)
//
// and if you skip a few days, the deltas pile up rather than resetting:
//
//   ...Tue you last saw 18, no visits Wed/Thu, Fri shows 22  →  +4
//
// That last row is why one stored number isn't enough. `baseline` answers
// "what is the badge measured from", and `lastSeenCount` answers "what will
// the baseline become at the next day boundary" — the count as of your most
// recent look. Collapsing them into one field makes either the Tuesday reload
// clear the badge, or Wednesday keep showing a stale one.

const KEY = "aerie_user_baselines_v1";

// Entries for projects you no longer have access to would otherwise sit here
// forever. Anything untouched for this long is dropped on the next write.
const PRUNE_AFTER_DAYS = 90;

type Baseline = {
  /** Count the badge is measured from — what you last saw on an earlier day. */
  baseline: number;
  /** Count at your most recent visit. Becomes `baseline` at the next rollover. */
  lastSeenCount: number;
  /** Local calendar day (YYYY-MM-DD) of that most recent visit. */
  lastSeenDay: string;
};

type Store = Record<string, Baseline>;

/**
 * Local calendar day, not UTC. The user's sense of "tomorrow" is their own
 * midnight, so a 9pm UTC-5 visit and a 10pm one are the same day even though
 * they straddle the UTC boundary.
 */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

function read(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
}

function valid(e: unknown): e is Baseline {
  const b = e as Baseline;
  return (
    !!b &&
    typeof b === "object" &&
    Number.isFinite(b.baseline) &&
    Number.isFinite(b.lastSeenCount) &&
    typeof b.lastSeenDay === "string"
  );
}

/**
 * Fold this load's user counts into the stored baselines and return the badge
 * value per project. Writes to localStorage, so call it once per load rather
 * than during render.
 *
 * Projects whose count is null — auth not enabled, or the call failed — are
 * skipped entirely and keep whatever baseline they had. A transient API error
 * must not silently reset someone's baseline to zero and manufacture a huge
 * "+N" on the next successful load.
 *
 * Returns only positive deltas; a project with no change, or on its first
 * ever sighting, is absent from the map and renders no badge.
 */
export function recordUserCounts(
  projects: { id: string; userCount: number | null | undefined }[],
  today: string = localDay()
): Record<string, number> {
  const store = read();
  const deltas: Record<string, number> = {};

  for (const p of projects) {
    const count = p.userCount;
    if (!Number.isFinite(count as number) || (count as number) < 0) continue;
    const c = count as number;

    const prev = store[p.id];
    if (!valid(prev)) {
      // First time we've ever seen this project. Showing the whole existing
      // user count as "new" would be a lie, so the first sighting is silent.
      store[p.id] = { baseline: c, lastSeenCount: c, lastSeenDay: today };
      continue;
    }

    // A new calendar day: whatever you last saw is now the thing to measure
    // from. Within the same day the baseline is left alone, so a reload — or
    // a background tab reconnecting — can't consume the badge.
    const baseline =
      prev.lastSeenDay === today ? prev.baseline : prev.lastSeenCount;

    // Users can be deleted. A count below the baseline would otherwise leave a
    // stale high-water mark that turns the next few real signups into a
    // wrong (too small, or too large) delta, so drop the baseline to match.
    const anchored = Math.min(baseline, c);

    store[p.id] = {
      baseline: anchored,
      lastSeenCount: c,
      lastSeenDay: today,
    };

    const delta = c - anchored;
    if (delta > 0) deltas[p.id] = delta;
  }

  for (const [id, e] of Object.entries(store)) {
    if (!valid(e) || daysBetween(e.lastSeenDay, today) > PRUNE_AFTER_DAYS) {
      delete store[id];
    }
  }

  write(store);
  return deltas;
}

/** Test seam / "forget what I've seen" — not wired to UI today. */
export function clearUserBaselines() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
