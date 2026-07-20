// Live reader — calls Google's REST APIs directly from the browser using the
// signed-in user's OAuth access token. Nothing is proxied through a server and
// nothing is stored: the token lives only in memory for the session.
//
// Data-plane APIs (Firestore, Identity Toolkit, Analytics) are called with a
// quota project header (X-Goog-User-Project) pointing at the app's own project,
// which has those APIs enabled — required for user-credential browser calls.
//
// Every failure is recorded in `liveErrors` (with status + message) so the UI
// can surface exactly what went wrong instead of silently showing "—".

export const QUOTA_PROJECT = "aerie-dashboard-app";

export interface LiveError {
  api: string;
  project: string;
  detail: string;
}
export const liveErrors: LiveError[] = [];
export function resetLiveErrors() {
  liveErrors.length = 0;
}
// Drop a single project's recorded errors (its own id or "id/collection"
// sub-keys) so a per-project retry starts from a clean slate.
export function clearProjectErrors(projectId: string) {
  for (let i = liveErrors.length - 1; i >= 0; i--) {
    const p = liveErrors[i].project;
    if (p === projectId || p.startsWith(`${projectId}/`)) liveErrors.splice(i, 1);
  }
}
function record(api: string, project: string, e: any) {
  liveErrors.push({ api, project, detail: String(e?.message || e).slice(0, 300) });
}

export interface LiveApp {
  id: string;
  name: string;
  platform: "web" | "ios" | "android";
  namespace: string | null;
}

export interface TrafficPoint {
  date: string;
  activeUsers: number;
  newUsers: number;
  events: number;
  views: number;
}

export interface TrafficTotals {
  activeUsers: number;
  newUsers: number;
  events: number;
  views: number;
}

// How many days of daily traffic we pull per property. One continuous,
// zero-filled series ending on GA4's latest date; the UI slices it to the
// selected range (e.g. last 28) and derives the previous-period comparison by
// slicing the window immediately before it. 180 days covers a 90-day view plus
// its 90-day comparison.
export const TRAFFIC_DAYS = 180;

export interface LiveTraffic {
  propertyId: string;
  // Totals over the last 28 days — used by the account overview stat cards.
  totals: TrafficTotals;
  // Up to TRAFFIC_DAYS daily points, oldest→newest, ending at GA4's latest
  // returned date, zero-filled for days with no data.
  series: TrafficPoint[];
}

// YYYYMMDD in UTC — matches GA4's `date` dimension format.
export function ymd(d: Date) {
  return (
    `${d.getUTCFullYear()}` +
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(d.getUTCDate()).padStart(2, "0")}`
  );
}

// Parse a YYYYMMDD key into a UTC Date.
function parseYmd(s: string): Date {
  return new Date(
    Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
  );
}

// The `n` calendar dates ending at `anchor` (a YYYYMMDD key), oldest first.
// Anchoring to GA4's own latest returned date — rather than the browser's
// UTC "today" — avoids a timezone mismatch that would otherwise render the
// newest day as a phantom zero at the right edge of the chart.
export function nDatesEndingAt(anchor: string, n: number): string[] {
  const end = parseYmd(anchor);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(
      ymd(
        new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i)
        )
      )
    );
  }
  return out;
}

const ZERO_POINT = (date: string): TrafficPoint => ({
  date,
  activeUsers: 0,
  newUsers: 0,
  events: 0,
  views: 0,
});

function sumTotals(series: TrafficPoint[]): TrafficTotals {
  return series.reduce<TrafficTotals>(
    (t, p) => ({
      activeUsers: t.activeUsers + p.activeUsers,
      newUsers: t.newUsers + p.newUsers,
      events: t.events + p.events,
      views: t.views + p.views,
    }),
    { activeUsers: 0, newUsers: 0, events: 0, views: 0 }
  );
}

export interface LiveProject {
  id: string;
  number: string;
  name: string;
  state: string;
  apps: LiveApp[];
  platforms: { web: number; ios: number; android: number };
  userCount: number | null;
  firestore: {
    configured: boolean;
    totalDocuments: number;
    collections: { name: string; count: number | null }[];
  } | null;
  traffic: LiveTraffic | null;
}

async function gfetch<T>(
  url: string,
  token: string,
  init?: RequestInit & { quota?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (init?.quota) headers["X-Goog-User-Project"] = QUOTA_PROJECT;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e: any) {
    // fetch() only throws on network/CORS failures — no HTTP status available
    throw new Error(`network/CORS blocked: ${e?.message || e}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try {
      msg = JSON.parse(body)?.error?.message || body;
    } catch {}
    throw new Error(`${res.status} ${msg}`.slice(0, 300));
  }
  return res.json() as Promise<T>;
}

const platformOf = (p: string): LiveApp["platform"] =>
  (({ WEB: "web", IOS: "ios", ANDROID: "android" } as const)[p] || "web");

export async function fetchProjects(token: string) {
  const data = await gfetch<{ results?: any[] }>(
    "https://firebase.googleapis.com/v1beta1/projects?pageSize=100",
    token
  );
  return (data.results || []).filter(
    (p) => p.state === "ACTIVE" && p.projectId !== QUOTA_PROJECT
  );
}

export async function fetchApps(token: string, projectId: string) {
  try {
    const data = await gfetch<{ apps?: any[] }>(
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}:searchApps?pageSize=100`,
      token
    );
    return (data.apps || []).map((a) => ({
      id: a.appId,
      name: a.displayName || a.appId,
      platform: platformOf(a.platform),
      namespace: a.namespace || null,
    })) as LiveApp[];
  } catch (e) {
    record("apps", projectId, e);
    return [];
  }
}

// User count only — returnUserInfo:false returns just a number, no PII.
export async function fetchUserCount(token: string, projectId: string) {
  try {
    const data = await gfetch<{ recordsCount?: string }>(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`,
      token,
      { method: "POST", body: JSON.stringify({ returnUserInfo: false }), quota: true }
    );
    return Number(data.recordsCount ?? 0);
  } catch (e) {
    record("auth", projectId, e);
    return null;
  }
}

// Lazy, on-demand breakdown for a single project's detail view. Pulls user
// records to compute signups-by-month + sign-in-method mix, aggregates them in
// memory, and returns ONLY the aggregates — nothing is stored. Capped at one
// page (500) so large projects never pull the whole table into the browser.
export interface AuthBreakdown {
  total: number;
  capped: boolean;
  verified: number;
  providers: Record<string, number>;
  signupsByMonth: { month: string; count: number }[];
  // Daily signup counts keyed as YYYYMMDD (same format as GA4 traffic dates)
  // so the modal chart can plot signups on the same 7/28/90d axis as traffic.
  signupsByDay: { date: string; count: number }[];
}

export async function fetchAuthBreakdown(
  token: string,
  projectId: string
): Promise<AuthBreakdown | null> {
  try {
    const data = await gfetch<{ userInfo?: any[]; recordsCount?: string }>(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`,
      token,
      {
        method: "POST",
        quota: true,
        body: JSON.stringify({ returnUserInfo: true, limit: "500" }),
      }
    );
    const users = data.userInfo || [];
    const total = Number(data.recordsCount ?? users.length);
    const providers: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let verified = 0;
    for (const u of users) {
      const provs = new Set<string>(
        (u.providerUserInfo || [])
          .map((p: any) => p.providerId)
          .filter(Boolean)
      );
      if (provs.size === 0 && u.passwordHash) provs.add("password");
      provs.forEach((p) => (providers[p] = (providers[p] || 0) + 1));
      if (u.emailVerified) verified++;
      const d = new Date(Number(u.createdAt));
      if (!isNaN(d.getTime())) {
        const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        byMonth[m] = (byMonth[m] || 0) + 1;
        const day = ymd(d);
        byDay[day] = (byDay[day] || 0) + 1;
      }
    }
    return {
      total,
      capped: total > users.length,
      verified,
      providers,
      signupsByMonth: Object.keys(byMonth)
        .sort()
        .map((month) => ({ month, count: byMonth[month] })),
      signupsByDay: Object.keys(byDay)
        .sort()
        .map((date) => ({ date, count: byDay[date] })),
    };
  } catch (e) {
    record("auth-breakdown", projectId, e);
    return null;
  }
}

export async function fetchFirestore(token: string, projectId: string) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  let collectionIds: string[] = [];
  try {
    const data = await gfetch<{ collectionIds?: string[] }>(
      `${base}:listCollectionIds`,
      token,
      { method: "POST", body: JSON.stringify({ pageSize: 100 }), quota: true }
    );
    collectionIds = data.collectionIds || [];
  } catch (e) {
    record("firestore", projectId, e);
    return null;
  }

  const collections: { name: string; count: number | null }[] = [];
  let total = 0;
  await Promise.all(
    collectionIds.map(async (cid) => {
      try {
        const res = await gfetch<any[]>(`${base}:runAggregationQuery`, token, {
          method: "POST",
          quota: true,
          body: JSON.stringify({
            structuredAggregationQuery: {
              aggregations: [{ count: {}, alias: "c" }],
              structuredQuery: { from: [{ collectionId: cid }] },
            },
          }),
        });
        const n = Number(res?.[0]?.result?.aggregateFields?.c?.integerValue ?? 0);
        collections.push({ name: cid, count: n });
        total += n;
      } catch (e) {
        record("firestore", `${projectId}/${cid}`, e);
        collections.push({ name: cid, count: null });
      }
    })
  );
  collections.sort((a, b) => (b.count || 0) - (a.count || 0));
  return { configured: true, totalDocuments: total, collections };
}

export async function fetchAnalyticsProperty(token: string, projectId: string) {
  try {
    const data = await gfetch<{ analyticsProperty?: { id?: string } }>(
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}/analyticsDetails`,
      token
    );
    return data.analyticsProperty?.id || null;
  } catch (e: any) {
    // 404 just means this project has no Analytics linked — not an error.
    if (!String(e?.message || "").startsWith("404")) {
      record("analytics-link", projectId, e);
    }
    return null;
  }
}

export async function fetchTraffic(
  token: string,
  propertyId: string,
  projectId: string
): Promise<LiveTraffic | null> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  // Pull TRAFFIC_DAYS of daily data in one report. GA4 omits days with no data,
  // so we re-index the rows onto a complete daily calendar below (missing days
  // → zeros). The UI slices this single series to the selected range and
  // derives the previous-period comparison from the window just before it.
  const body = JSON.stringify({
    dateRanges: [{ startDate: `${TRAFFIC_DAYS - 1}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "eventCount" },
      { name: "screenPageViews" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: TRAFFIC_DAYS + 10,
  });
  const run = (quota: boolean) =>
    gfetch<{ rows?: any[] }>(url, token, { method: "POST", quota, body });
  try {
    let report: { rows?: any[] };
    try {
      report = await run(true); // quota → aerie-dashboard-app
    } catch (e1) {
      report = await run(false); // fallback → GA4 property's own project
    }
    const byDate = new Map<string, TrafficPoint>();
    for (const r of report.rows || []) {
      const date = r.dimensionValues?.[0]?.value || "";
      if (!date) continue;
      byDate.set(date, {
        date,
        activeUsers: Number(r.metricValues?.[0]?.value || 0),
        newUsers: Number(r.metricValues?.[1]?.value || 0),
        events: Number(r.metricValues?.[2]?.value || 0),
        views: Number(r.metricValues?.[3]?.value || 0),
      });
    }
    // Build one continuous daily calendar, anchored to the latest date GA
    // actually returned (property timezone) so the window ends on a real day.
    const latest = Array.from(byDate.keys()).sort().pop();
    if (!latest) {
      // Analytics linked but no traffic in the window. Return an EMPTY series —
      // never placeholder date keys, which would pollute the account-wide
      // aggregation (they'd sort past real YYYYMMDD dates and hijack the
      // "last N days" slice, showing a flat zero chart).
      return {
        propertyId,
        totals: { activeUsers: 0, newUsers: 0, events: 0, views: 0 },
        series: [],
      };
    }
    const series = nDatesEndingAt(latest, TRAFFIC_DAYS).map(
      (d) => byDate.get(d) || ZERO_POINT(d)
    );
    return {
      propertyId,
      totals: sumTotals(series.slice(-28)),
      series,
    };
  } catch (e) {
    record("traffic", projectId, e);
    return null;
  }
}

// Vercel-style traffic source breakdowns for the detail modal — top pages,
// session sources, countries, device categories and operating systems, each
// ranked by active users over the selected window. One batchRunReports call
// (GA4 allows up to 5 reports per batch) so the modal costs a single request.
export interface DimRow {
  label: string;
  value: number;
}
export interface TrafficBreakdown {
  pages: DimRow[];
  sources: DimRow[];
  countries: DimRow[];
  devices: DimRow[];
  os: DimRow[];
  // Top GA4 events by eventCount — fetched as a separate report since the
  // batch is already at the 5-reports-per-call API maximum.
  events: DimRow[];
}

const BREAKDOWN_DIMS = [
  "pagePath",
  "sessionSource",
  "country",
  "deviceCategory",
  "operatingSystem",
] as const;

// POST an Analytics Data API request with the standard quota-project →
// property's-own-project fallback used by every GA4 read in this file.
async function gaPost<T>(token: string, url: string, body: string): Promise<T> {
  try {
    return await gfetch<T>(url, token, { method: "POST", quota: true, body });
  } catch {
    return await gfetch<T>(url, token, { method: "POST", quota: false, body });
  }
}

function reportRows(report: any): DimRow[] {
  return (report?.rows || [])
    .map((r: any) => ({
      label: r.dimensionValues?.[0]?.value || "(not set)",
      value: Number(r.metricValues?.[0]?.value || 0),
    }))
    .filter((d: DimRow) => d.value > 0);
}

export async function fetchTrafficBreakdown(
  token: string,
  propertyId: string,
  projectId: string,
  days: number
): Promise<TrafficBreakdown | null> {
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}`;
  const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: "today" }];
  const batchBody = JSON.stringify({
    requests: BREAKDOWN_DIMS.map((dim) => ({
      dateRanges,
      dimensions: [{ name: dim }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 8,
    })),
  });
  const eventsBody = JSON.stringify({
    dateRanges,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 8,
  });
  // The dimension batch and the events report fail independently — losing one
  // shouldn't blank the other.
  const [batch, events] = await Promise.all([
    gaPost<{ reports?: any[] }>(token, `${base}:batchRunReports`, batchBody).catch(
      (e) => {
        record("traffic-breakdown", projectId, e);
        return null;
      }
    ),
    gaPost<any>(token, `${base}:runReport`, eventsBody).catch((e) => {
      record("traffic-events", projectId, e);
      return null;
    }),
  ]);
  if (!batch && !events) return null;
  return {
    pages: reportRows(batch?.reports?.[0]),
    sources: reportRows(batch?.reports?.[1]),
    countries: reportRows(batch?.reports?.[2]),
    devices: reportRows(batch?.reports?.[3]),
    os: reportRows(batch?.reports?.[4]),
    events: reportRows(events),
  };
}

// Users active right now (GA4 realtime — active in the last 30 minutes).
// Returns null when the property has no realtime access / errors.
export async function fetchRealtimeUsers(
  token: string,
  propertyId: string,
  projectId: string
): Promise<number | null> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`;
  const body = JSON.stringify({ metrics: [{ name: "activeUsers" }] });
  try {
    const data = await gaPost<{ rows?: any[] }>(token, url, body);
    // No dimensions → at most one row; no rows at all means zero users online.
    return Number(data.rows?.[0]?.metricValues?.[0]?.value || 0);
  } catch (e) {
    record("realtime", projectId, e);
    return null;
  }
}

// Additional per-project services, fetched lazily on the detail view so the
// overview stays fast. Each entry is null when the API is disabled / errored
// (recorded in liveErrors, demoted by the UI's quiet-diagnostics filter) and
// a { count, names } object when the read succeeds — including count 0.
export interface ServiceList {
  count: number;
  names: string[];
}
export interface ProjectServices {
  functions: ServiceList | null;
  buckets: ServiceList | null;
  hosting: ServiceList | null;
  rtdb: ServiceList | null;
}

const shortName = (n: string) => (n || "").split("/").pop() || n;

// Generic "list resources → names" reader for the estate-coverage endpoints.
async function fetchNames(
  token: string,
  api: string,
  projectId: string,
  url: string,
  pick: (data: any) => any[],
  nameOf: (item: any) => string
): Promise<ServiceList | null> {
  try {
    const data = await gfetch<any>(url, token, { quota: true });
    const names = (pick(data) || []).map(nameOf).filter(Boolean);
    return { count: names.length, names };
  } catch (e) {
    record(api, projectId, e);
    return null;
  }
}

export async function fetchProjectServices(
  token: string,
  projectId: string
): Promise<ProjectServices> {
  const [functions, buckets, hosting, rtdb] = await Promise.all([
    fetchNames(
      token,
      "functions",
      projectId,
      `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/-/functions?pageSize=100`,
      (d) => d.functions,
      (f) => shortName(f.name)
    ),
    fetchNames(
      token,
      "storage",
      projectId,
      `https://storage.googleapis.com/storage/v1/b?project=${projectId}&maxResults=100`,
      (d) => d.items,
      (b) => b.name
    ),
    fetchNames(
      token,
      "hosting",
      projectId,
      `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites`,
      (d) => d.sites,
      (s) => s.siteId || shortName(s.name)
    ),
    fetchNames(
      token,
      "rtdb",
      projectId,
      `https://firebasedatabase.googleapis.com/v1beta/projects/${projectId}/locations/-/instances`,
      (d) => d.instances,
      (i) => shortName(i.name)
    ),
  ]);
  return { functions, buckets, hosting, rtdb };
}

export async function loadProject(token: string, p: any): Promise<LiveProject> {
  const [apps, userCount, firestore, propertyId] = await Promise.all([
    fetchApps(token, p.projectId),
    fetchUserCount(token, p.projectId),
    fetchFirestore(token, p.projectId),
    fetchAnalyticsProperty(token, p.projectId),
  ]);
  const traffic = propertyId
    ? await fetchTraffic(token, propertyId, p.projectId)
    : null;
  return {
    id: p.projectId,
    number: p.projectNumber,
    name: p.displayName || p.projectId,
    state: p.state,
    apps,
    platforms: {
      web: apps.filter((a) => a.platform === "web").length,
      ios: apps.filter((a) => a.platform === "ios").length,
      android: apps.filter((a) => a.platform === "android").length,
    },
    userCount,
    firestore,
    traffic,
  };
}
