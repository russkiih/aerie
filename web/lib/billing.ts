// Billing Watchdog — reads each project's billing plan (Cloud Billing API)
// and its billable usage meters (Cloud Monitoring API) live from the browser
// with the user's token, then estimates cost and flags week-over-week spikes.
// Nothing is stored and nothing is proxied — same rules as every other read.
//
// Google exposes no "actual spend" API without a BigQuery billing export, so
// the dollar figures here are ESTIMATES: usage × published Blaze list prices
// (common US regions) with the free-tier allowance subtracted. They exist to
// catch runaway usage early, not to replace the console's billing report.

import { gfetch, recordLiveError } from "./live";

export interface BillingInfo {
  // true → Blaze (pay-as-you-go); false → Spark (no billing attached).
  enabled: boolean;
  accountId: string | null;
}

export interface DriverPoint {
  date: string; // YYYYMMDD, matching the GA4 traffic date format
  value: number;
}

export interface CostDriver {
  key: string;
  label: string;
  bytes: boolean; // format value as data volume instead of a count
  gauge: boolean; // level meter (avg stored bytes) instead of a usage sum
  series: DriverPoint[]; // daily values over the window, oldest → newest
  total28d: number; // sum over 28d (delta meters) or average level (gauges)
  last7: number;
  prev7: number;
  estCost28d: number; // USD estimate after the free-tier allowance
  spike: boolean;
}

export interface ProjectBilling {
  info: BillingInfo | null;
  drivers: CostDriver[]; // only meters that returned data, active first
  estMonthly: number; // sum of driver estimates over the 28d window
  spikes: CostDriver[];
}

const DAYS = 28;
const GB = 1024 ** 3;

interface MeterSpec {
  key: string;
  label: string;
  metricType: string;
  gauge?: boolean;
  bytes?: boolean;
  // Free-tier allowance per month. Daily allowances (e.g. Firestore's 50k
  // reads/day) are approximated as ×30 against the 28-day usage total.
  freePerMonth: number;
  // USD per unit (read / invocation / byte / byte-month) beyond the allowance.
  pricePerUnit: number;
  // Minimum last-7d volume before a jump is worth flagging — keeps tiny
  // projects (30 reads → 300 reads) out of the warnings.
  spikeFloor: number;
}

// Blaze list prices, mid-2026, common US regions — estimates only.
const METERS: MeterSpec[] = [
  {
    key: "fsReads",
    label: "Firestore reads",
    metricType: "firestore.googleapis.com/document/read_count",
    freePerMonth: 1_500_000,
    pricePerUnit: 0.06 / 100_000,
    spikeFloor: 25_000,
  },
  {
    key: "fsWrites",
    label: "Firestore writes",
    metricType: "firestore.googleapis.com/document/write_count",
    freePerMonth: 600_000,
    pricePerUnit: 0.18 / 100_000,
    spikeFloor: 10_000,
  },
  {
    key: "fsDeletes",
    label: "Firestore deletes",
    metricType: "firestore.googleapis.com/document/delete_count",
    freePerMonth: 600_000,
    pricePerUnit: 0.02 / 100_000,
    spikeFloor: 10_000,
  },
  {
    key: "fnCalls",
    label: "Function invocations",
    metricType: "cloudfunctions.googleapis.com/function/execution_count",
    freePerMonth: 2_000_000,
    pricePerUnit: 0.4 / 1_000_000,
    spikeFloor: 25_000,
  },
  {
    key: "hostingEgress",
    label: "Hosting bandwidth",
    metricType: "firebasehosting.googleapis.com/network/sent_bytes_count",
    bytes: true,
    freePerMonth: 10.8 * GB, // 360 MB/day
    pricePerUnit: 0.15 / GB,
    spikeFloor: 250 * 1024 ** 2,
  },
  {
    key: "rtdbEgress",
    label: "Realtime DB egress",
    metricType: "firebasedatabase.googleapis.com/network/sent_bytes_count",
    bytes: true,
    freePerMonth: 10 * GB,
    pricePerUnit: 1 / GB,
    spikeFloor: 250 * 1024 ** 2,
  },
  {
    key: "storageBytes",
    label: "Cloud Storage stored",
    metricType: "storage.googleapis.com/storage/total_bytes",
    gauge: true,
    bytes: true,
    freePerMonth: 5 * GB,
    pricePerUnit: 0.026 / GB, // per GB-month
    spikeFloor: 1 * GB,
  },
];

// GET with a quota-project fallback, same idea as the GA4 reads: try one
// quota source, fall back to the other. `quotaFirst` picks the order.
//
// Monitoring passes false. timeSeries.list is a paid-tier method and rejects
// any request whose *quota* project has no billing account attached — the
// hosted quota project runs on Spark, so leading with the quota header there
// costs a guaranteed 403 before the retry. Going direct first turns two
// requests per meter back into one (7 meters × every project on a scan).
async function gget<T>(
  token: string,
  url: string,
  quotaFirst = true
): Promise<T> {
  try {
    return await gfetch<T>(url, token, { quota: quotaFirst });
  } catch {
    return await gfetch<T>(url, token, { quota: !quotaFirst });
  }
}

export async function fetchBillingInfo(
  token: string,
  projectId: string
): Promise<BillingInfo | null> {
  try {
    const data = await gget<{
      billingEnabled?: boolean;
      billingAccountName?: string;
    }>(token, `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`);
    return {
      enabled: Boolean(data.billingEnabled),
      accountId: data.billingAccountName
        ? data.billingAccountName.split("/").pop() || null
        : null,
    };
  } catch (e) {
    recordLiveError("billing", projectId, e);
    return null;
  }
}

// One Monitoring read per meter: 28 days, aligned to daily buckets, reduced
// to a single series. Returns null when the meter errored (recorded), and a
// zeroed driver when the project simply has no usage on it.
async function fetchMeter(
  token: string,
  projectId: string,
  spec: MeterSpec
): Promise<CostDriver | null> {
  const end = new Date();
  const start = new Date(end.getTime() - DAYS * 86_400_000);
  const params = new URLSearchParams({
    filter: `metric.type = "${spec.metricType}"`,
    "interval.startTime": start.toISOString(),
    "interval.endTime": end.toISOString(),
    "aggregation.alignmentPeriod": "86400s",
    "aggregation.perSeriesAligner": spec.gauge ? "ALIGN_MEAN" : "ALIGN_SUM",
    "aggregation.crossSeriesReducer": "REDUCE_SUM",
  });
  let data: { timeSeries?: any[] };
  try {
    data = await gget(
      token,
      `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`,
      false
    );
  } catch (e) {
    recordLiveError("usage", `${projectId}/${spec.key}`, e);
    return null;
  }

  // Bucket every returned point by its day; sum across series just in case
  // the reducer left more than one.
  const byDate = new Map<string, number>();
  for (const ts of data.timeSeries || []) {
    for (const p of ts.points || []) {
      const t = p.interval?.endTime || "";
      const date = t.slice(0, 10).replace(/-/g, "");
      if (date.length !== 8) continue;
      const v = Number(p.value?.int64Value ?? p.value?.doubleValue ?? 0);
      byDate.set(date, (byDate.get(date) || 0) + v);
    }
  }
  const series: DriverPoint[] = Array.from(byDate.keys())
    .sort()
    .map((date) => ({ date, value: byDate.get(date) || 0 }));

  const sum = (pts: DriverPoint[]) => pts.reduce((a, p) => a + p.value, 0);
  const avg = (pts: DriverPoint[]) => (pts.length ? sum(pts) / pts.length : 0);
  const window = (n: number, offset: number) =>
    series.slice(series.length - offset - n, series.length - offset);
  const agg = spec.gauge ? avg : sum;
  const total28d = agg(series);
  const last7 = agg(window(7, 0));
  const prev7 = agg(window(7, 7));
  const estCost28d =
    Math.max(0, total28d - spec.freePerMonth) * spec.pricePerUnit;
  // Gauges creep, delta meters spike — a stored-bytes doubling is as alarming
  // as a 2.5× jump in reads.
  const ratio = spec.gauge ? 2 : 2.5;
  const spike = last7 >= spec.spikeFloor && last7 >= ratio * Math.max(prev7, 1);

  return {
    key: spec.key,
    label: spec.label,
    bytes: Boolean(spec.bytes),
    gauge: Boolean(spec.gauge),
    series,
    total28d,
    last7,
    prev7,
    estCost28d,
    spike,
  };
}

export async function fetchProjectBilling(
  token: string,
  projectId: string
): Promise<ProjectBilling> {
  const [info, ...meters] = await Promise.all([
    fetchBillingInfo(token, projectId),
    ...METERS.map((m) => fetchMeter(token, projectId, m)),
  ]);
  const drivers = meters
    .filter((d): d is CostDriver => d !== null && d.total28d > 0)
    .sort((a, b) => b.estCost28d - a.estCost28d || b.total28d - a.total28d);
  return {
    info,
    drivers,
    estMonthly: drivers.reduce((s, d) => s + d.estCost28d, 0),
    spikes: drivers.filter((d) => d.spike),
  };
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function fmtUsd(n: number): string {
  if (n <= 0) return "$0";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

// Week-over-week multiplier for the spike label ("×4.2 vs prior week").
export function spikeRatio(d: CostDriver): number {
  return d.last7 / Math.max(d.prev7, 1);
}
