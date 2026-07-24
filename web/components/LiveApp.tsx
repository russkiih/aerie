"use client";

import { useEffect, useMemo, useState } from "react";
import {
  requestToken,
  isConfigured,
  getStoredToken,
  clearToken,
  getUserInfo,
  type UserInfo,
} from "@/lib/oauth";
import {
  fetchProjects,
  loadProject,
  fetchAuthBreakdown,
  fetchProjectServices,
  fetchTrafficBreakdown,
  fetchRealtimeUsers,
  ymd,
  nDatesEndingAt,
  liveErrors,
  resetLiveErrors,
  clearProjectErrors,
  type LiveError,
  type LiveProject,
  type AuthBreakdown,
  type ProjectServices,
  type TrafficBreakdown,
  type DimRow,
} from "@/lib/live";
import {
  Logo,
  Card,
  Stat,
  TileStat,
  SectionLabel,
  PlatformBadge,
} from "@/components/ui";
import {
  TimeSeriesChart,
  Sparkline,
  SeriesSummary,
  Chips,
  compact,
} from "@/components/charts";
import { buildSnapshot, buildCsv, downloadFile } from "@/lib/export";
import {
  fetchProjectBilling,
  fmtBytes,
  fmtUsd,
  spikeRatio,
  type ProjectBilling,
  type CostDriver,
} from "@/lib/billing";
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
import {
  IS_CLOUD,
  FREE_PROJECT_LIMIT,
  FREE_SORT,
  FREE_RANGE,
  initialTier,
  fetchTier,
  startCheckout,
  type Tier,
  type Plan,
} from "@/lib/tier";

type Phase = "landing" | "loading" | "ready" | "error";

const consoleUrl = (projectId: string) =>
  `https://console.firebase.google.com/project/${projectId}/overview`;

// Shared control styles from the redesign — a recessed segmented rail with a
// raised active tab, and quiet bordered header buttons.
const tabRail =
  "flex items-center gap-[3px] rounded-[11px] border border-line bg-inset p-[3px]";
const tabBtn = (active: boolean) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition-all ${
    active ? "bg-[#332d26] text-ink shadow-tab" : "text-faint hover:text-muted"
  }`;
const headerBtn =
  "rounded-[10px] border border-line bg-panel px-[13px] py-2 text-xs font-medium text-muted transition-colors hover:border-[#4a4239] hover:bg-[#282420] hover:text-ink disabled:opacity-40";

// Traffic date-range window (days). The chart shows the last `range` days and
// compares against the `range` days immediately before them.
type TrafficRange = 7 | 28 | 90;
const RANGES: TrafficRange[] = [7, 28, 90];

// Slice a continuous daily series into the current window and the preceding
// window of equal length (for the comparison line). Slicing by count is robust
// to any gaps in the aggregated series.
function sliceRange<T>(series: T[], range: number) {
  return {
    current: series.slice(-range),
    compare: series.slice(-2 * range, -range),
  };
}

// Export the loaded estate as JSON or CSV — a small click-away dropdown.
function ExportMenu({ projects }: { projects: LiveProject[] }) {
  const [open, setOpen] = useState(false);
  const disabled = projects.length === 0;

  function run(kind: "json" | "csv") {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    if (kind === "json") {
      downloadFile(
        `aerie-estate-${date}.json`,
        "application/json",
        JSON.stringify(buildSnapshot(projects, now.toISOString()), null, 2)
      );
    } else {
      downloadFile(`aerie-estate-${date}.csv`, "text/csv", buildCsv(projects));
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className={headerBtn}
      >
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-[10px] border border-line bg-panel2 shadow-lg">
            {(["json", "csv"] as const).map((k) => (
              <button
                key={k}
                onClick={() => run(k)}
                className="block w-full px-3 py-1.5 text-left text-[11px] font-medium text-muted hover:bg-[#332d26] hover:text-ink"
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Copy-to-clipboard affordance with a brief "Copied" confirmation.
function CopyButton({
  text,
  label = "Copy ID",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className={`font-mono text-[11px] font-medium text-faint hover:text-ink ${className}`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

// Placeholder project grid shown during the initial load, before any project
// has finished streaming in.
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="h-full p-4">
          <div className="skeleton h-4 w-2/3 rounded" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded" />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
            <div className="skeleton h-8 rounded" />
            <div className="skeleton h-8 rounded" />
            <div className="skeleton h-8 rounded" />
          </div>
          <div className="skeleton mt-3 h-8 rounded" />
        </Card>
      ))}
    </div>
  );
}

// Segmented control shared by the range toggles (account chart + detail modal).
// On the free cloud tier only the 28d window is live; the others open the
// upgrade prompt instead of switching.
function RangeToggle({
  value,
  onChange,
  pro = true,
  onLocked,
}: {
  value: TrafficRange;
  onChange: (r: TrafficRange) => void;
  pro?: boolean;
  onLocked?: () => void;
}) {
  return (
    <div className={tabRail}>
      {RANGES.map((r) => {
        const locked = !pro && r !== FREE_RANGE;
        return (
          <button
            key={r}
            onClick={() => (locked ? onLocked?.() : onChange(r))}
            title={locked ? "Cloud Pro" : undefined}
            className={`${tabBtn(value === r)}${locked ? " opacity-50" : ""}`}
          >
            {r}d
          </button>
        );
      })}
    </div>
  );
}

// Upgrade prompt: recaps Pro and hands off to Stripe Checkout. Both plans get
// the 7-day trial the landing page advertises — annual only, applied
// server-side in the checkout session and never trusted from here.
function UpgradeModal({
  onClose,
  onCheckout,
  error,
}: {
  onClose: () => void;
  onCheckout: (plan: Plan) => void;
  error?: string;
}) {
  const [busy, setBusy] = useState<Plan | null>(null);
  // Checkout only ever resolves by navigating away, so the only way back into
  // this component is a failure. Without this the button would sit on
  // "Opening checkout…" forever and the user could never retry.
  useEffect(() => {
    if (error) setBusy(null);
  }, [error]);
  const go = (plan: Plan) => {
    setBusy(plan);
    onCheckout(plan);
  };
  return (
    <div
      className="overlay-in fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(12,10,9,.66)] p-[18px] backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div
        className="modal-in w-full max-w-md rounded-[20px] border border-line3 p-7 shadow-pop"
        style={{ background: "linear-gradient(180deg,#232019,#1c1916)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold uppercase tracking-[.08em] text-muted">
            Cloud Pro
          </span>
          <span className="rounded-full bg-ok/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.06em] text-ok">
            7-day trial on annual
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-[-.03em] text-ink">
            $9
          </span>
          <span className="text-[12px] font-medium text-faint">
            /mo billed yearly, after a 7-day free trial · or $19 monthly,
            billed today
          </span>
        </div>
        <ul className="mt-5 space-y-2.5 text-[13px] text-muted">
          {[
            "Unlimited projects",
            "7 / 28 / 90-day traffic windows",
            "Billing watchdog — cost estimates & spike alerts",
            "AI analyst included when billing launches",
            "Alerts & weekly digest (coming)",
          ].map((it) => (
            <li key={it} className="flex items-start gap-2.5">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {it}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => go("annual")}
            disabled={busy !== null}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy === "annual"
              ? "Opening checkout…"
              : "Start 7-day trial — $9/mo billed yearly"}
          </button>
          <button
            onClick={() => go("monthly")}
            disabled={busy !== null}
            className="w-full rounded-xl border border-line3 px-4 py-2.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
          >
            {busy === "monthly"
              ? "Opening checkout…"
              : "Or $19 month-to-month — billed today"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-center text-[11.5px] text-warn">{error}</p>
        )}
        <p className="mt-3 text-center text-[11px] text-fainter">
          Prefer full control?{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-faint hover:text-ink"
          >
            Self-host free forever ↗
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LiveApp() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [projects, setProjects] = useState<LiveProject[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [diag, setDiag] = useState<LiveError[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [metric, setMetric] = useState<"activeUsers" | "newUsers" | "events">(
    "activeUsers"
  );
  const [range, setRange] = useState<TrafficRange>(28);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"users" | "docs" | "traffic" | "name">(
    "users"
  );
  const [user, setUser] = useState<UserInfo | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [tier, setTier] = useState<Tier>(initialTier());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const pro = tier === "pro";

  // Entitlement follows the signed-in identity, so it is re-checked whenever
  // the token changes — including the return trip from Stripe Checkout, which
  // lands back here with a fresh page load. Self-hosted builds short-circuit
  // to "pro" inside fetchTier without a network call.
  useEffect(() => {
    if (!token) {
      setTier(initialTier());
      return;
    }
    let alive = true;
    fetchTier(token).then((t) => {
      if (alive) setTier(t);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  async function beginCheckout(plan: Plan) {
    setUpgradeError("");
    // A missing token used to return silently, which looked identical to a
    // hung request. Say so instead — it is a real, recoverable state (the
    // cached token expires after an hour).
    if (!token) {
      setUpgradeError("Session expired — reconnect your Google account first.");
      return;
    }
    try {
      await startCheckout(token, plan);
    } catch (e: any) {
      setUpgradeError(String((e && e.message) || e));
    }
  }

  // Auto-reconnect on load if a valid token is still cached — no re-login.
  useEffect(() => {
    if (getStoredToken()) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function disconnect() {
    clearToken(token || undefined);
    setToken(null);
    setUser(null);
    setProjects([]);
    setDiag([]);
    setPhase("landing");
  }

  async function connect() {
    try {
      setError("");
      setDiag([]);
      resetLiveErrors();
      setPhase("loading");
      const token = await requestToken();
      setToken(token);
      getUserInfo(token).then(setUser);
      const raw = await fetchProjects(token);
      setProgress({ done: 0, total: raw.length });
      const loaded: LiveProject[] = [];
      await Promise.all(
        raw.map(async (p) => {
          const lp = await loadProject(token, p);
          loaded.push(lp);
          setProgress((s) => ({ ...s, done: s.done + 1 }));
          setProjects(
            [...loaded].sort((a, b) => (b.userCount || 0) - (a.userCount || 0))
          );
        })
      );
      setDiag([...liveErrors]);
      setPhase("ready");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setPhase("error");
    }
  }

  // Re-fetch a single project (after a transient failure) without reloading the
  // whole estate. Clears that project's prior errors first so the diagnostics
  // reflect only what's still failing.
  async function reloadProject(id: string) {
    const lp = projects.find((p) => p.id === id);
    if (!token || !lp || retrying.has(id)) return;
    setRetrying((s) => new Set(s).add(id));
    clearProjectErrors(id);
    try {
      const updated = await loadProject(token, {
        projectId: lp.id,
        projectNumber: lp.number,
        displayName: lp.name,
        state: lp.state,
      });
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } finally {
      setDiag([...liveErrors]);
      setRetrying((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  const totals = useMemo(() => {
    const totalUsers = projects.reduce((s, p) => s + (p.userCount || 0), 0);
    const totalApps = projects.reduce((s, p) => s + p.apps.length, 0);
    const totalDocs = projects.reduce(
      (s, p) => s + (p.firestore?.totalDocuments || 0),
      0
    );
    const activeUsers = projects.reduce(
      (s, p) => s + (p.traffic?.totals.activeUsers || 0),
      0
    );
    const events = projects.reduce(
      (s, p) => s + (p.traffic?.totals.events || 0),
      0
    );
    // account-wide daily series per metric, summed across every project's GA4
    // data — one continuous series the UI slices to the selected range.
    const acc = {
      activeUsers: {} as Record<string, number>,
      newUsers: {} as Record<string, number>,
      events: {} as Record<string, number>,
    };
    for (const p of projects) {
      for (const pt of p.traffic?.series || []) {
        acc.activeUsers[pt.date] = (acc.activeUsers[pt.date] || 0) + pt.activeUsers;
        acc.newUsers[pt.date] = (acc.newUsers[pt.date] || 0) + pt.newUsers;
        acc.events[pt.date] = (acc.events[pt.date] || 0) + pt.events;
      }
    }
    const toSeries = (m: Record<string, number>) =>
      Object.keys(m)
        .sort()
        .map((date) => ({ date, value: m[date] }));
    const trafficByMetric = {
      activeUsers: toSeries(acc.activeUsers),
      newUsers: toSeries(acc.newUsers),
      events: toSeries(acc.events),
    };
    const newUsers = projects.reduce(
      (s, p) => s + (p.traffic?.totals.newUsers || 0),
      0
    );
    return {
      totalUsers,
      totalApps,
      totalDocs,
      activeUsers,
      newUsers,
      events,
      trafficByMetric,
    };
  }, [projects]);

  // On the free cloud tier the unlocked projects are pinned by the default
  // ranking (most users first) before any search or sort runs, so changing the
  // sort can't rotate a different trio through the three free slots.
  const [freeProjects, lockedProjects] = useMemo(() => {
    if (pro) return [projects, [] as LiveProject[]];
    const ranked = [...projects].sort(
      (a, b) => (b.userCount || 0) - (a.userCount || 0)
    );
    return [
      ranked.slice(0, FREE_PROJECT_LIMIT),
      ranked.slice(FREE_PROJECT_LIMIT),
    ];
  }, [projects, pro]);

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? freeProjects.filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
        )
      : freeProjects;
    const scored = [...filtered];
    scored.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "docs")
        return (b.firestore?.totalDocuments || 0) - (a.firestore?.totalDocuments || 0);
      if (sort === "traffic")
        return (b.traffic?.totals.activeUsers || 0) - (a.traffic?.totals.activeUsers || 0);
      return (b.userCount || 0) - (a.userCount || 0);
    });
    return scored;
  }, [freeProjects, query, sort]);

  if (phase === "landing" || phase === "error") {
    return (
      <Landing
        onConnect={connect}
        error={phase === "error" ? error : ""}
        configured={isConfigured()}
      />
    );
  }

  const sel = projects.find((p) => p.id === selected) || null;
  // Free cloud tier shows the top FREE_PROJECT_LIMIT projects; the rest are
  // summarized in a locked card that opens the upgrade prompt.
  const shownProjects = visibleProjects;
  const lockedCount = lockedProjects.length;
  const { current: activeSeries, compare: compareSeries } = sliceRange(
    totals.trafficByMetric[metric],
    range
  );
  // Headline for the traffic card: avg/day for user metrics (readable at a
  // glance), raw total for events — with a delta vs the previous window.
  const metricLabels = {
    activeUsers: "Active users",
    newUsers: "New users",
    events: "Events",
  } as const;
  const curSum = activeSeries.reduce((a, d) => a + d.value, 0);
  const prevSum = compareSeries.reduce((a, d) => a + d.value, 0);
  const perDay = metric === "events" ? "" : "/day";
  const headline =
    metric === "events" ? curSum : Math.round(curSum / Math.max(1, range));
  const prevHeadline =
    metric === "events" ? prevSum : Math.round(prevSum / Math.max(1, range));
  const deltaPct = prevSum > 0 ? ((curSum - prevSum) / prevSum) * 100 : null;
  const hasTraffic = Object.values(totals.trafficByMetric).some((s) =>
    s.some((d) => d.value > 0)
  );
  const trafficError =
    diag.find((e) => e.api === "traffic")?.detail ||
    diag.find((e) => e.api === "analytics-link")?.detail ||
    "";
  // A project that simply doesn't use Firestore/Auth returns "not enabled" /
  // CONFIGURATION_NOT_FOUND — that's expected, not a failure. Keep it out of the
  // scary diagnostics box; just tally it as a quiet footnote.
  const realDiag = diag.filter((e) => !isExpectedError(e));
  const expectedCount = diag.length - realDiag.length;
  // Projects with a genuine (non-expected) failure — surfaced with a per-card retry.
  const errorProjects = new Set(realDiag.map((e) => e.project.split("/")[0]));

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-y-3 border-b border-line pb-5">
        <div className="flex items-center gap-[13px]">
          <Logo />
          <div className="leading-none">
            <div className="text-[17px] font-semibold tracking-[-.015em] text-ink">
              Aerie
            </div>
            <div className="mt-[3px] font-mono text-[10.5px] font-medium tracking-[.03em] text-faint">
              live · your Firebase estate
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-[9px]">
          {phase === "loading" && (
            <span className="mr-1 text-[11px] text-faint">
              loading {progress.done}/{progress.total}…
            </span>
          )}
          {user?.email && (
            <span className="hidden items-center gap-2 rounded-full border border-line bg-panel py-[5px] pl-1.5 pr-[11px] text-[11.5px] font-medium text-muted sm:inline-flex">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt=""
                  className="h-[22px] w-[22px] rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  className="grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-bold text-[#241c18]"
                  style={{
                    background: "linear-gradient(135deg,#d97757,#b45a3a)",
                  }}
                >
                  {(user.email[0] || "?").toUpperCase()}
                </span>
              )}
              {user.email}
            </span>
          )}
          {IS_CLOUD && !pro && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="rounded-[10px] border border-accent/40 bg-accent/10 px-[13px] py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              Free plan · Upgrade
            </button>
          )}
          <ExportMenu projects={projects} />
          <button
            onClick={() => connect()}
            disabled={phase === "loading"}
            className={headerBtn}
          >
            Refresh
          </button>
          <button onClick={disconnect} className={headerBtn}>
            Disconnect
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Projects" value={projects.length} sub="connected" accent />
        <Stat
          label="Users"
          value={totals.totalUsers.toLocaleString()}
          sub="across estate"
          accent
        />
        <Stat
          label="Active"
          value={compact(totals.activeUsers)}
          sub="last 28 days"
        />
        <Stat label="Events" value={compact(totals.events)} sub="last 28 days" />
        <Stat label="Apps" value={totals.totalApps} sub="web · iOS · Android" />
        <Stat label="Documents" value={compact(totals.totalDocs)} sub="Firestore" />
      </div>

      {/* account-wide traffic */}
      <div className="mt-[14px]">
        <Card className="rounded-[20px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
                {metricLabels[metric]} · {range}d
              </div>
              <div className="mt-2.5 flex items-baseline gap-[11px]">
                <div className="text-4xl font-semibold leading-none tracking-[-.03em] tabular-nums text-ink">
                  {compact(headline)}
                  {perDay}
                </div>
                {deltaPct !== null ? (
                  <span
                    className={`inline-flex items-center rounded-full px-[9px] py-[3px] text-xs font-semibold tabular-nums ${
                      deltaPct >= 0 ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
                    }`}
                  >
                    {deltaPct >= 0 ? "▲ " : "▼ "}
                    {Math.abs(deltaPct).toFixed(1)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-panel2 px-[9px] py-[3px] text-xs font-semibold text-[#8a8177]">
                    —
                  </span>
                )}
              </div>
              <div className="mt-[7px] text-xs font-medium text-faint">
                vs {compact(prevHeadline)}
                {perDay} in the previous {range}d
              </div>
            </div>
            <div className="flex flex-col items-end gap-[9px]">
              <RangeToggle
                value={range}
                onChange={setRange}
                pro={pro}
                onLocked={() => setShowUpgrade(true)}
              />
              <div className={tabRail}>
                {(
                  [
                    ["activeUsers", "Active"],
                    ["newUsers", "New users"],
                    ["events", "Events"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMetric(key)}
                    className={tabBtn(metric === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {hasTraffic ? (
            <>
              <div className="mt-5">
                <TimeSeriesChart
                  data={activeSeries}
                  compare={compareSeries}
                  compareLabel={`Prev ${range}d`}
                  height={196}
                  legend={false}
                />
              </div>
              <div className="mt-3.5 flex items-center gap-[18px] text-[11px] font-medium text-faint">
                <span className="inline-flex items-center gap-[7px]">
                  <span className="h-[2.5px] w-4 rounded-sm bg-accent" />
                  Current
                </span>
                {compareSeries.some((d) => d.value > 0) && (
                  <span className="inline-flex items-center gap-[7px]">
                    <span className="h-0 w-4 border-t-2 border-dashed border-[#8a8177]" />
                    Previous {range}d
                  </span>
                )}
                <span className="ml-auto font-mono text-[10.5px] tracking-[.03em]">
                  GA4
                </span>
              </div>
            </>
          ) : phase === "loading" ? (
            <p className="py-4 text-[12.5px] text-faint">Loading traffic…</p>
          ) : trafficError ? (
            <div className="py-3">
              <p className="text-[12.5px] text-warn">Traffic couldn&apos;t load:</p>
              <p className="mt-1 break-words font-mono text-[11px] text-muted">
                {trafficError}
              </p>
            </div>
          ) : (
            <p className="py-4 text-[12.5px] text-faint">
              No GA4 traffic in the last {range} days (these projects have no
              Analytics linked, or no recent activity).
            </p>
          )}
        </Card>
      </div>

      {/* estate-wide billing watchdog — on-demand scan, nothing stored */}
      {phase === "ready" && token && (
        <WatchdogCard
          projects={projects}
          token={token}
          pro={pro}
          onOpen={(id) => setSelected(id)}
          onLocked={() => setShowUpgrade(true)}
        />
      )}

      <div className="mb-4 mt-[30px] flex flex-wrap items-center gap-[11px]">
        <div className="relative min-w-[220px] flex-1">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2"
          >
            <circle cx="11" cy="11" r="7" stroke="#7d7469" strokeWidth="1.8" />
            <path
              d="M20 20l-4-4"
              stroke="#7d7469"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded-xl border border-line bg-panel py-[11px] pl-9 pr-[13px] text-[13px] font-medium text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        <div className={tabRail}>
          {(
            [
              ["users", "Users"],
              ["docs", "Docs"],
              ["traffic", "Traffic"],
              ["name", "A–Z"],
            ] as const
          ).map(([key, label]) => {
            // Free tier keeps the one ordering its three unlocked projects are
            // chosen by; the rest open the upgrade prompt, like the ranges.
            const locked = !pro && key !== FREE_SORT;
            return (
              <button
                key={key}
                onClick={() => (locked ? setShowUpgrade(true) : setSort(key))}
                title={locked ? "Cloud Pro" : undefined}
                className={`${tabBtn(sort === key)}${locked ? " opacity-50" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {phase === "loading" && projects.length === 0 ? (
        <SkeletonGrid />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownProjects.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(p.id);
                  }
                }}
                className="group block cursor-pointer rounded-xl2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-dim/60"
              >
                <Card className="flex h-full flex-col gap-3.5 p-[19px] transition-[transform,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(.2,.7,.3,1)] group-hover:-translate-y-[3px] group-hover:border-[#544a40] group-hover:shadow-card-hover">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold tracking-[-.01em] text-ink">
                        {p.name}
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-faint">
                        {p.id}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-[5px]">
                      {p.platforms.web > 0 && <PlatformBadge platform="web" />}
                      {p.platforms.ios > 0 && <PlatformBadge platform="ios" />}
                      {p.platforms.android > 0 && (
                        <PlatformBadge platform="android" />
                      )}
                    </div>
                  </div>
                  {errorProjects.has(p.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reloadProject(p.id);
                      }}
                      disabled={retrying.has(p.id)}
                      className="inline-flex w-fit items-center gap-1.5 text-[11px] font-medium text-warn hover:text-ink disabled:opacity-60"
                    >
                      {retrying.has(p.id)
                        ? "Retrying…"
                        : "⚠ Some data failed — retry"}
                    </button>
                  )}
                  <div className="grid grid-cols-3 gap-2 border-t border-line2 pt-3.5">
                    <Mini label="Users" value={p.userCount} />
                    <Mini
                      label="Docs"
                      value={p.firestore ? p.firestore.totalDocuments : null}
                    />
                    <Mini
                      label="Active"
                      value={p.traffic ? p.traffic.totals.activeUsers : null}
                      accent
                    />
                  </div>
                  {p.traffic &&
                    p.traffic.series.slice(-28).some((s) => s.activeUsers > 0) && (
                      /* last 28 days, matching the "Active" number above */
                      <Sparkline
                        height={30}
                        data={p.traffic.series
                          .slice(-28)
                          .map((s) => s.activeUsers)}
                      />
                    )}
                  <div className="mt-auto flex items-center justify-between border-t border-line2 pt-3.5">
                    <a
                      href={consoleUrl(p.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-medium text-faint hover:text-ink"
                    >
                      Console ↗
                    </a>
                    <CopyButton text={p.id} />
                  </div>
                </Card>
              </div>
            ))}
            {lockedCount > 0 && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl2 border border-dashed border-line3 bg-inset/60 p-[19px] text-center transition-colors hover:border-accent/50"
              >
                <span className="text-3xl font-semibold tracking-[-.02em] text-ink">
                  +{lockedCount}
                </span>
                <span className="text-[13px] font-medium text-muted">
                  more project{lockedCount === 1 ? "" : "s"} on your account
                </span>
                <span className="max-w-[230px] truncate text-[11px] text-fainter">
                  {lockedProjects
                    .map((p) => p.name)
                    .join(" · ")}
                </span>
                <span className="mt-1 rounded-[9px] bg-accent px-4 py-2 text-[12px] font-semibold text-paper">
                  Unlock with Pro
                </span>
              </button>
            )}
          </div>
          {visibleProjects.length === 0 && (
            <p className="mt-6 text-center text-[12px] text-faint">
              {query
                ? `No projects match “${query}”.`
                : "No Firebase projects found on this account."}
            </p>
          )}
        </>
      )}

      {realDiag.length > 0 && <Diagnostics errors={realDiag} />}
      {expectedCount > 0 && (
        <p className="mt-[26px] text-center text-[11px] font-medium text-fainter">
          {expectedCount} service{expectedCount === 1 ? "" : "s"} skipped —
          projects without Firestore or Authentication enabled.
        </p>
      )}

      {sel && (
        <DetailModal
          project={sel}
          token={token}
          onClose={() => setSelected(null)}
          pro={pro}
          onUpgrade={() => setShowUpgrade(true)}
        />
      )}
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          onCheckout={beginCheckout}
          error={upgradeError}
        />
      )}
    </div>
  );
}

// "Service not enabled / not configured" is the normal state for projects that
// don't use Firestore or Auth — not a real failure worth alarming the user.
function isExpectedError(e: LiveError) {
  const d = e.detail || "";
  return (
    // API disabled / never used
    /has not been used in project|service_disabled|it is disabled|api is not enabled/i.test(
      d
    ) ||
    // Auth not set up on the project
    /configuration_not_found/i.test(d) ||
    // Firestore enabled but no database created yet
    /database \(default\) does not exist|add a cloud datastore or cloud firestore database/i.test(
      d
    )
  );
}

function Diagnostics({ errors }: { errors: LiveError[] }) {
  // group identical messages per api so the list stays short
  const byApi: Record<string, { count: number; sample: string }> = {};
  for (const e of errors) {
    const key = e.api;
    if (!byApi[key]) byApi[key] = { count: 0, sample: e.detail };
    byApi[key].count++;
  }
  return (
    <details className="mt-10 rounded-lg border border-warn/30 bg-warn/5 p-4">
      <summary className="cursor-pointer text-[12px] font-medium text-warn">
        Diagnostics — {errors.length} API call(s) failed (tap to expand)
      </summary>
      <div className="mt-3 space-y-3">
        {Object.entries(byApi).map(([api, info]) => (
          <div key={api} className="text-[11.5px]">
            <div className="font-medium text-ink">
              {api} — {info.count} failed
            </div>
            <div className="mt-1 break-words font-mono text-[11px] text-muted">
              {info.sample}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

// Billing plan chip — Blaze (billing attached, can spend) vs Spark (can't).
function PlanBadge({ billing }: { billing: ProjectBilling | null }) {
  const info = billing?.info;
  if (!info)
    return (
      <span className="rounded-full border border-line bg-panel2 px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[.06em] text-fainter">
        plan —
      </span>
    );
  return info.enabled ? (
    <span className="rounded-full bg-warn/15 px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[.06em] text-warn">
      Blaze · pay-as-you-go
    </span>
  ) : (
    <span className="rounded-full bg-ok/15 px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[.06em] text-ok">
      Spark · no billing
    </span>
  );
}

const fmtDriver = (d: CostDriver, n: number) =>
  d.bytes ? fmtBytes(n) : compact(Math.round(n));

// "Firestore reads ×4.2 vs prior week" — the actionable line of the watchdog.
function SpikeLine({ d }: { d: CostDriver }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-warn">
      ⚠ {d.label} ×{spikeRatio(d).toFixed(1)} vs prior week (
      {fmtDriver(d, d.last7)}
      {d.gauge ? " avg" : ""} last 7d)
    </span>
  );
}

// Estate-wide Billing Watchdog — an on-demand scan (per project: billing plan
// + the billable usage meters from Cloud Monitoring) that estimates 28-day
// cost from list prices and flags week-over-week spikes. Everything happens
// in the browser; results live in component state only.
//
// Pro-only on the hosted cloud tier: the free tier caps the project grid at
// FREE_PROJECT_LIMIT, so an ungated estate scan would name and price the very
// projects that cap is hiding. Self-hosted builds are always "pro" and get the
// full scan — see lib/tier.ts.
function WatchdogCard({
  projects,
  token,
  pro,
  onOpen,
  onLocked,
}: {
  projects: LiveProject[];
  token: string;
  pro: boolean;
  onOpen: (id: string) => void;
  onLocked: () => void;
}) {
  const [results, setResults] = useState<Record<string, ProjectBilling>>({});
  const [scan, setScan] = useState<"idle" | "scanning" | "done">("idle");
  const [done, setDone] = useState(0);

  async function runScan() {
    setScan("scanning");
    setResults({});
    setDone(0);
    await Promise.all(
      projects.map(async (p) => {
        const b = await fetchProjectBilling(token, p.id);
        setResults((prev) => ({ ...prev, [p.id]: b }));
        setDone((d) => d + 1);
      })
    );
    setScan("done");
  }

  const rows = projects
    .map((p) => ({ p, b: results[p.id] }))
    .filter((r): r is { p: LiveProject; b: ProjectBilling } => Boolean(r.b))
    .sort(
      (a, b) =>
        b.b.spikes.length - a.b.spikes.length ||
        b.b.estMonthly - a.b.estMonthly ||
        b.b.drivers.length - a.b.drivers.length
    );
  const totalEst = rows.reduce((s, r) => s + r.b.estMonthly, 0);
  const spikeCount = rows.reduce((s, r) => s + r.b.spikes.length, 0);

  return (
    <div className="mt-[14px]">
      <Card className="rounded-[20px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
              Billing watchdog
            </div>
            {scan === "done" ? (
              <div className="mt-2.5 flex items-baseline gap-[11px]">
                <div className="text-4xl font-semibold leading-none tracking-[-.03em] tabular-nums text-ink">
                  {fmtUsd(totalEst)}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-[9px] py-[3px] text-xs font-semibold ${
                    spikeCount > 0
                      ? "bg-warn/15 text-warn"
                      : "bg-ok/15 text-ok"
                  }`}
                >
                  {spikeCount > 0
                    ? `${spikeCount} spike${spikeCount === 1 ? "" : "s"}`
                    : "no spikes"}
                </span>
              </div>
            ) : (
              <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
                Scan every project&apos;s billable meters — Firestore
                reads/writes, Function invocations, Hosting &amp; Realtime DB
                bandwidth, Storage — for estimated cost and sudden usage
                spikes. Read live in your browser, nothing stored.
                {!pro && (
                  <span className="text-faint">
                    {" "}
                    Cloud Pro covers every project on your account.
                  </span>
                )}
              </p>
            )}
            {scan === "done" && (
              <div className="mt-[7px] text-xs font-medium text-faint">
                est. usage cost across the estate · last 28d · list prices,
                free tier applied
              </div>
            )}
          </div>
          {pro ? (
            <button
              onClick={runScan}
              disabled={scan === "scanning"}
              className={headerBtn}
            >
              {scan === "scanning"
                ? `Scanning ${done}/${projects.length}…`
                : scan === "done"
                ? "Rescan"
                : "Scan estate"}
            </button>
          ) : (
            <button
              onClick={onLocked}
              className="shrink-0 rounded-[10px] bg-accent px-4 py-2 text-[12px] font-semibold text-paper transition-opacity hover:opacity-90"
            >
              Unlock with Pro
            </button>
          )}
        </div>

        {scan !== "idle" && rows.length > 0 && (
          <div className="mt-5 flex flex-col">
            {rows.map(({ p, b }) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="group flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line2 py-[9px] text-left last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink group-hover:text-accent">
                  {p.name}
                </span>
                <PlanBadge billing={b} />
                <span className="w-16 text-right font-mono text-[12.5px] font-semibold tabular-nums text-ink">
                  {fmtUsd(b.estMonthly)}
                </span>
                {b.spikes.length > 0 && (
                  <span className="flex w-full flex-col gap-0.5 pl-1 sm:w-auto sm:pl-0">
                    {b.spikes.map((d) => (
                      <SpikeLine key={d.key} d={d} />
                    ))}
                  </span>
                )}
                {b.spikes.length === 0 && b.drivers[0] && (
                  <span className="hidden text-[11px] font-medium text-faint sm:inline">
                    top: {b.drivers[0].label} ·{" "}
                    {fmtDriver(b.drivers[0], b.drivers[0].total28d)}
                    {b.drivers[0].gauge ? " avg" : " / 28d"}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {scan === "done" && rows.every(({ b }) => b.drivers.length === 0) && (
          <p className="mt-4 text-[12px] leading-relaxed text-faint">
            No usage data came back. Projects with no billable activity are
            normal here; if every project is blank, the Cloud Monitoring API
            may not be enabled for your quota project (check Diagnostics
            below).
          </p>
        )}
      </Card>
    </div>
  );
}

// Per-project billing panel inside the detail modal — plan, spike warnings,
// and each active meter with usage + estimated cost over the last 28 days.
function BillingSection({ billing }: { billing: ProjectBilling | null }) {
  if (billing === null)
    return <div className="skeleton mt-6 h-24 rounded-[13px]" />;
  const { drivers, spikes } = billing;
  return (
    <div className="mt-6 rounded-[13px] border border-line bg-tile p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
          Billing watchdog · 28d
        </span>
        <PlanBadge billing={billing} />
      </div>
      {spikes.length > 0 && (
        <div className="mt-3 flex flex-col gap-1 rounded-[9px] border border-warn/30 bg-warn/5 px-3 py-2">
          {spikes.map((d) => (
            <SpikeLine key={d.key} d={d} />
          ))}
        </div>
      )}
      {drivers.length > 0 ? (
        <>
          <div className="mt-3 flex flex-col">
            {drivers.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between gap-3 border-b border-[#26221d] py-[7px] last:border-b-0"
              >
                <span className="text-[12px] font-medium text-muted">
                  {d.label}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[12px] tabular-nums text-ink">
                    {fmtDriver(d, d.total28d)}
                    {d.gauge ? " avg" : ""}
                  </span>
                  <span className="w-14 text-right font-mono text-[12px] font-medium tabular-nums text-ink">
                    {fmtUsd(d.estCost28d)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-faint">
              est. usage cost · list prices, free tier applied — see console
              for exact billing
            </span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
              {fmtUsd(billing.estMonthly)}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          No billable usage in the last 28 days
          {billing.info?.enabled === false
            ? " — and no billing account attached, so this project can't spend."
            : "."}
        </p>
      )}
    </div>
  );
}

// One breakdown tile (Pages / Sources / Countries / …): ranked rows with a
// proportional fill bar behind each label, Vercel-style, in the warm palette.
function BreakdownPanel({
  title,
  rows,
  unit = "Users",
}: {
  title: string;
  rows: DimRow[];
  unit?: string;
}) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-[13px] border border-line bg-tile p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-faint">
          {title}
        </span>
        <span className="text-[9.5px] font-semibold uppercase tracking-[.08em] text-fainter">
          {unit}
        </span>
      </div>
      <div className="flex flex-col gap-[3px]">
        {rows.slice(0, 6).map((r) => (
          <div
            key={r.label}
            className="relative overflow-hidden rounded-[6px] px-2 py-[5px]"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-[6px] bg-panel2"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
            <div className="relative flex items-center justify-between gap-2.5">
              <span
                className="truncate text-[11.5px] font-medium text-muted"
                title={r.label}
              >
                {r.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums text-ink">
                {r.value.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | null;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </div>
      <div
        className={`mt-[5px] text-lg font-semibold tracking-[-.02em] tabular-nums ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        {value === null || value === undefined ? "—" : compact(value)}
      </div>
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  password: "Email / password",
  "google.com": "Google",
  "yahoo.com": "Yahoo",
  "facebook.com": "Facebook",
  "apple.com": "Apple",
  "github.com": "GitHub",
  phone: "Phone",
  anonymous: "Anonymous",
};

// One key input, two callers: the no-key prompt and the Pro quota overflow.
function AnalystKeyInput({
  label,
  onSaved,
  onInvalid,
}: {
  label: string;
  onSaved: (key: string) => void;
  onInvalid: (msg: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sk-ant-… · sk-… · AIza… · xai-… · gsk_…"
        type="password"
        className="min-w-0 flex-1 rounded-[9px] border border-line bg-panel px-3 py-2 font-mono text-[12px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <button
        onClick={() => {
          const k = value.trim();
          if (!k) return;
          if (!detectProvider(k)) {
            onInvalid(
              "Unrecognized key format — expected an Anthropic (sk-ant-), OpenAI (sk-), Gemini (AIza… or AQ.…), xAI (xai-) or Groq (gsk_) key."
            );
            return;
          }
          setAnalystKey(k);
          onSaved(k);
          setValue("");
        }}
        className="shrink-0 rounded-[9px] bg-accent px-4 py-2 text-[12px] font-semibold text-paper transition-opacity hover:opacity-90"
      >
        {label}
      </button>
    </div>
  );
}

function DetailModal({
  project,
  token,
  onClose,
  pro = true,
  onUpgrade,
}: {
  project: LiveProject;
  token: string | null;
  onClose: () => void;
  pro?: boolean;
  onUpgrade?: () => void;
}) {
  const t = project.traffic;
  const [breakdown, setBreakdown] = useState<AuthBreakdown | null>(null);
  const [loadingBd, setLoadingBd] = useState(false);
  const [range, setRange] = useState<TrafficRange>(28);
  const [services, setServices] = useState<ProjectServices | null>(null);
  const [billing, setBilling] = useState<ProjectBilling | null>(null);
  const [sources, setSources] = useState<TrafficBreakdown | null>(null);
  const [online, setOnline] = useState<number | null>(null);
  const [chartMetric, setChartMetric] = useState<"active" | "signups">(
    "active"
  );
  const [aiKey, setAiKey] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  // BYOK AI analyst — key read client-side only (localStorage).
  useEffect(() => {
    setAiKey(getAnalystKey());
  }, []);

  async function analyze() {
    if (aiBusy) return;
    if (!aiKey && !token) {
      setAiError("Session expired — reconnect your Google account and try again.");
      return;
    }
    setAiBusy(true);
    setAiError("");
    setAiText("");
    // Everything the modal has already loaded, compacted into one snapshot.
    const payload = {
      project: { name: project.name, id: project.id },
      rangeDays: range,
      users: project.userCount,
      onlineNow: online,
      firestore: project.firestore
        ? {
            totalDocuments: project.firestore.totalDocuments,
            collections: project.firestore.collections.slice(0, 10),
          }
        : null,
      traffic: t
        ? {
            totals28d: t.totals,
            dailyActiveUsers: t.series.slice(-range).map((p) => p.activeUsers),
            previousWindowActiveUsers: t.series
              .slice(-2 * range, -range)
              .map((p) => p.activeUsers),
          }
        : null,
      sources,
      signInMethods: breakdown?.providers ?? null,
      signupsByMonth: breakdown?.signupsByMonth?.slice(-6) ?? null,
      services: services
        ? {
            functions: services.functions?.count ?? null,
            storageBuckets: services.buckets?.count ?? null,
            hostingSites: services.hosting?.count ?? null,
            realtimeDb: services.rtdb?.count ?? null,
          }
        : null,
    };
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
  }

  // Vercel-style source breakdowns (pages / sources / countries / devices /
  // OS / events) — one batched GA4 report + one events report, re-fetched
  // when the range changes.
  useEffect(() => {
    let alive = true;
    setSources(null);
    if (token && t?.propertyId) {
      fetchTrafficBreakdown(token, t.propertyId, project.id, range).then((b) => {
        if (alive) setSources(b);
      });
    }
    return () => {
      alive = false;
    };
  }, [token, project.id, t?.propertyId, range]);

  // "Online now" — GA4 realtime active users (last 30 min), refreshed every
  // 60s while the modal is open.
  useEffect(() => {
    let alive = true;
    setOnline(null);
    if (!token || !t?.propertyId) return;
    const pid = t.propertyId;
    const tick = () =>
      fetchRealtimeUsers(token, pid, project.id).then((n) => {
        if (alive) setOnline(n);
      });
    tick();
    const iv = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [token, project.id, t?.propertyId]);

  useEffect(() => {
    let alive = true;
    if (token && (project.userCount || 0) > 0) {
      setLoadingBd(true);
      fetchAuthBreakdown(token, project.id).then((b) => {
        if (alive) {
          setBreakdown(b);
          setLoadingBd(false);
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [token, project.id, project.userCount]);

  // Lazily read the rest of the estate (Functions, Storage, Hosting, RTDB) —
  // detail-only so the overview stays fast.
  useEffect(() => {
    let alive = true;
    setServices(null);
    if (token) {
      fetchProjectServices(token, project.id).then((s) => {
        if (alive) setServices(s);
      });
    }
    return () => {
      alive = false;
    };
  }, [token, project.id]);

  // Billing watchdog — plan + billable usage meters, lazy like the services.
  // Pro-only, matching the estate scan; free tier never issues the reads.
  useEffect(() => {
    let alive = true;
    setBilling(null);
    if (token && pro) {
      fetchProjectBilling(token, project.id).then((b) => {
        if (alive) setBilling(b);
      });
    }
    return () => {
      alive = false;
    };
  }, [token, project.id, pro]);

  const providers = Object.entries(breakdown?.providers || {}).sort(
    (a, b) => b[1] - a[1]
  );
  const providerRows: DimRow[] = providers.map(([id, n]) => ({
    label: PROVIDER_LABELS[id] || id,
    value: n,
  }));

  // Range-aware traffic slices for this project's chart, comparison, and chips.
  const activeAll = (t?.series || []).map((p) => ({
    date: p.date,
    value: p.activeUsers,
  }));
  // Daily Auth signups on the same YYYYMMDD calendar as traffic, zero-filled,
  // anchored to GA4's latest date (falls back to today when no traffic).
  let signupsAll: { date: string; value: number }[] = [];
  if (breakdown?.signupsByDay?.length) {
    const counts = new Map(breakdown.signupsByDay.map((s) => [s.date, s.count]));
    const anchor = t?.series.length
      ? t.series[t.series.length - 1].date
      : ymd(new Date());
    signupsAll = nDatesEndingAt(anchor, 180).map((d) => ({
      date: d,
      value: counts.get(d) || 0,
    }));
  }
  const hasActive = activeAll.some((p) => p.value > 0);
  const hasSignups = signupsAll.some((p) => p.value > 0);
  // Effective chart metric — fall back to whichever series actually has data.
  const metric: "active" | "signups" =
    chartMetric === "signups"
      ? hasSignups
        ? "signups"
        : "active"
      : hasActive
      ? "active"
      : hasSignups
      ? "signups"
      : "active";
  const chartAll = metric === "signups" ? signupsAll : activeAll;
  const { current: chartCurrent, compare: chartCompare } = sliceRange(
    chartAll,
    range
  );
  const winTotals = (t?.series || []).slice(-range).reduce(
    (a, p) => ({
      newUsers: a.newUsers + p.newUsers,
      views: a.views + p.views,
      events: a.events + p.events,
    }),
    { newUsers: 0, views: 0, events: 0 }
  );

  // Estate-service chips — only the ones that actually resolved (null = the API
  // is disabled/not used on this project, kept quiet).
  const svcItems: { label: string; value: string }[] = [];
  if (services?.functions)
    svcItems.push({ label: "Functions", value: services.functions.count.toLocaleString() });
  if (services?.buckets)
    svcItems.push({ label: "Storage buckets", value: services.buckets.count.toLocaleString() });
  if (services?.hosting)
    svcItems.push({ label: "Hosting sites", value: services.hosting.count.toLocaleString() });
  if (services?.rtdb)
    svcItems.push({ label: "Realtime DB", value: services.rtdb.count.toLocaleString() });

  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(12,10,9,.66)] p-[18px] backdrop-blur-[6px] sm:py-9"
      onClick={onClose}
    >
      <div
        className="modal-in w-full max-w-[680px] rounded-[20px] border border-line3 p-[26px] shadow-pop"
        style={{ background: "linear-gradient(180deg,#232019,#1c1916)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3.5">
          <div className="min-w-0">
            <div className="truncate text-[21px] font-semibold tracking-[-.02em] text-ink">
              {project.name}
            </div>
            <div className="mt-[5px] flex items-center gap-2.5">
              <span className="truncate font-mono text-[11.5px] text-faint">
                {project.id}
              </span>
              <CopyButton text={project.id} />
              {online !== null && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-tile px-2.5 py-[3px] text-[11px] font-medium text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      online > 0 ? "animate-pulse bg-ok" : "bg-fainter"
                    }`}
                  />
                  {online.toLocaleString()} online
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={consoleUrl(project.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[9px] border border-line3 px-[11px] py-[7px] text-xs font-medium text-muted hover:text-ink"
            >
              Console ↗
            </a>
            <button
              onClick={onClose}
              className="rounded-[9px] border border-line3 px-[11px] py-[7px] text-xs font-medium text-muted hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-[11px]">
          <TileStat
            label="Users"
            value={project.userCount?.toLocaleString() ?? "—"}
          />
          <TileStat
            label="Documents"
            value={project.firestore?.totalDocuments.toLocaleString() ?? "—"}
          />
          <TileStat
            label="Active · 28d"
            value={t?.totals.activeUsers.toLocaleString() ?? "—"}
            accent
          />
        </div>

        {/* the headline chart — traffic first, signups on the same date axis */}
        {(hasActive || hasSignups) && (
          <div className="mt-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
              <SectionLabel>
                {metric === "signups"
                  ? `Signups · new accounts${
                      breakdown?.capped ? " · recent 500" : ""
                    }`
                  : "Traffic · active users"}
              </SectionLabel>
              <div className="flex flex-wrap items-center gap-2">
                {hasActive && hasSignups && (
                  <div className={tabRail}>
                    <button
                      onClick={() => setChartMetric("active")}
                      className={tabBtn(metric === "active")}
                    >
                      Traffic
                    </button>
                    <button
                      onClick={() => setChartMetric("signups")}
                      className={tabBtn(metric === "signups")}
                    >
                      Signups
                    </button>
                  </div>
                )}
                <RangeToggle
                  value={range}
                  onChange={setRange}
                  pro={pro}
                  onLocked={onUpgrade}
                />
              </div>
            </div>
            <TimeSeriesChart
              height={150}
              data={chartCurrent}
              compare={chartCompare}
              compareLabel={`Prev ${range}d`}
            />
            <SeriesSummary data={chartCurrent} compare={chartCompare} />
            {metric === "active" && t && (
              <Chips
                className="mt-3 border-t border-line pt-3"
                items={[
                  {
                    label: "New users",
                    value: winTotals.newUsers.toLocaleString(),
                  },
                  { label: "Views", value: winTotals.views.toLocaleString() },
                  { label: "Events", value: winTotals.events.toLocaleString() },
                ]}
              />
            )}
          </div>
        )}

        {/* AI analyst — BYOK prototype; key + metrics never touch our servers */}
        <div className="mt-6 rounded-[13px] border border-line bg-tile p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"
                  fill="#d97757"
                />
              </svg>
              AI analyst
            </span>
            {aiKey && (
              <span className="flex items-center gap-2.5">
                {(() => {
                  const p = detectProvider(aiKey);
                  return p ? (
                    <span className="text-[10px] font-medium uppercase tracking-[.08em] text-fainter">
                      via {providerLabel(p)}
                    </span>
                  ) : null;
                })()}
                <button
                  onClick={() => {
                    clearAnalystKey();
                    setAiKey(null);
                    setAiText("");
                    setAiError("");
                  }}
                  className="text-[10.5px] font-medium text-fainter hover:text-muted"
                >
                  Change key
                </button>
              </span>
            )}
          </div>
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
              <div className="mt-3">
                <AnalystKeyInput
                  label="Save key"
                  onSaved={(k) => {
                    setAiError("");
                    setAiKey(k);
                  }}
                  onInvalid={(msg) => setAiError(msg)}
                />
              </div>
              {aiError && (
                <p className="mt-2 text-[12px] text-warn">{aiError}</p>
              )}
            </div>
          ) : (
            /* Cloud Pro (included, our key) OR any build with a BYOK key set. */
            <div className="mt-3">
              {aiText && (
                <p className="mb-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">
                  {aiText}
                </p>
              )}
              {aiError && (
                <p className="mb-3 text-[12px] text-warn">{aiError}</p>
              )}
              {/* Quota overflow: reveal the BYOK key field so Pro users can continue. */}
              {quotaHit && !aiKey && (
                <div className="mb-3">
                  <AnalystKeyInput
                    label="Use my key"
                    onSaved={(k) => {
                      setAiKey(k);
                      setQuotaHit(false);
                      setAiError("");
                    }}
                    onInvalid={(msg) => setAiError(msg)}
                  />
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
        </div>



        {/* Vercel-style source breakdowns — where the traffic comes from */}
        {t && sources === null && (
          <div className="mt-6 grid gap-[11px] sm:grid-cols-2">
            <div className="skeleton h-32 rounded-[13px]" />
            <div className="skeleton h-32 rounded-[13px]" />
          </div>
        )}
        {((sources &&
          [
            sources.pages,
            sources.sources,
            sources.countries,
            sources.devices,
            sources.os,
            sources.events,
          ].some((r) => r.length > 0)) ||
          providerRows.length > 0) && (
          <div className="mt-6">
            <SectionLabel>Breakdowns · {range}d</SectionLabel>
            <div className="grid gap-[11px] sm:grid-cols-2">
              {sources && (
                <>
                  <BreakdownPanel title="Pages" rows={sources.pages} />
                  <BreakdownPanel title="Sources" rows={sources.sources} />
                  <BreakdownPanel title="Countries" rows={sources.countries} />
                  <BreakdownPanel title="Devices" rows={sources.devices} />
                  <BreakdownPanel title="Operating systems" rows={sources.os} />
                  <BreakdownPanel
                    title="Events"
                    rows={sources.events}
                    unit="Count"
                  />
                </>
              )}
              {/* all-time Auth provider mix, alongside the other breakdowns */}
              <BreakdownPanel
                title="Sign-in methods · all time"
                rows={providerRows}
              />
            </div>
          </div>
        )}

        {/* rest of the estate — Functions / Storage / Hosting / Realtime DB */}
        {services === null ? (
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            <div className="skeleton h-9 w-20 rounded-lg" />
            <div className="skeleton h-9 w-20 rounded-lg" />
            <div className="skeleton h-9 w-20 rounded-lg" />
          </div>
        ) : svcItems.length > 0 ? (
          <div className="mt-6">
            <SectionLabel>Services</SectionLabel>
            <div className="flex flex-wrap gap-[9px]">
              {svcItems.map((it) => (
                <span
                  key={it.label}
                  className="inline-flex items-baseline gap-[7px] rounded-[10px] border border-line bg-tile px-[13px] py-2"
                >
                  <span className="text-[11.5px] font-medium text-muted">
                    {it.label}
                  </span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
                    {it.value}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* billing watchdog — plan, cost drivers and spike warnings (Pro) */}
        {pro && <BillingSection billing={billing} />}

        {project.firestore && project.firestore.collections.length > 0 && (
          <div className="mt-6">
            <SectionLabel>Firestore collections</SectionLabel>
            <div className="flex flex-col">
              {project.firestore.collections.slice(0, 10).map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between border-b border-[#26221d] py-[9px]"
                >
                  <span className="font-mono text-[12px] text-muted">
                    {c.name}
                  </span>
                  <span className="font-mono text-[12px] font-medium tabular-nums text-ink">
                    {c.count?.toLocaleString() ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {project.apps.length > 0 && (
          <div className="mt-6">
            <SectionLabel>Apps</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {project.apps.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] text-muted"
                >
                  <PlatformBadge platform={a.platform} />
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const GITHUB_URL = "https://github.com/russkiih/aerie";

function Landing({
  onConnect,
  error,
  configured,
}: {
  onConnect: () => void;
  error: string;
  configured: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-6 sm:px-8">
      {/* nav */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-[13px]">
          <Logo />
          <div className="leading-none">
            <div className="text-[17px] font-semibold tracking-[-.015em] text-ink">
              Aerie
            </div>
            <div className="mt-[3px] font-mono text-[10.5px] font-medium tracking-[.03em] text-faint">
              open source · your Firebase estate
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[9px]">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[10px] border border-line bg-panel px-[13px] py-2 text-xs font-medium text-muted transition-colors hover:border-[#4a4239] hover:bg-[#282420] hover:text-ink"
          >
            GitHub ↗
          </a>
          <button
            onClick={onConnect}
            disabled={!configured}
            className="rounded-[10px] bg-accent px-[13px] py-2 text-xs font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* hero */}
      <section className="mt-16 text-center sm:mt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11px] font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Open source (AGPL-3.0) · never writes · your data stays in your
          browser
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-[-.03em] text-ink sm:text-[52px] sm:leading-[1.08]">
          One dashboard for every Firebase project you own.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
          Stop clicking through the console project by project. Connect once
          and see every project&apos;s users, traffic, Firestore data, sources
          and services in a single warm pane — read live in your browser.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onConnect}
            disabled={!configured}
            className="inline-flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <GoogleGlyph />
            Continue with Google
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-6 py-3 text-[15px] font-medium text-muted transition-colors hover:border-[#4a4239] hover:text-ink"
          >
            Self-host on GitHub ↗
          </a>
        </div>
        {!configured && (
          <p className="mt-3 text-[11px] text-warn">
            Sign-in isn&apos;t configured yet (awaiting OAuth Client ID).
          </p>
        )}
        {error && (
          <p className="mx-auto mt-4 max-w-sm text-[12px] text-warn">{error}</p>
        )}
      </section>

      {/* hero shot */}
      <div className="relative mt-14">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[80%] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(217,119,87,.14), transparent)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shots/overview.png"
          alt="The Aerie dashboard: estate-wide stats, GA4 traffic chart with previous-period comparison, and per-project cards with sparklines"
          className="relative w-full rounded-[20px] border border-line3 shadow-pop"
        />
      </div>

      {/* features */}
      <section className="mt-24 sm:mt-32">
        <h2 className="text-center text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
          Everything the console scatters, in one pane
        </h2>
        <div className="mt-10 grid gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            title="Your whole estate"
            body="Every project, app and platform — users, Firestore documents, Functions, Storage, Hosting and Realtime DB, live."
          />
          <Feature
            title="GA4 traffic + signups"
            body="Active users with previous-period comparison on 7/28/90-day windows, and real Auth signups on the same axis."
          />
          <Feature
            title="Source breakdowns"
            body="Top pages, referral sources, countries, devices, operating systems and events — per project, Vercel-style."
          />
          <Feature
            title="Realtime"
            body="Who's online right now on each project, straight from GA4 realtime."
          />
          <Feature
            title="AI analyst"
            body="One click turns a project's numbers into ranked insights and next moves. Bring any key — Anthropic, OpenAI, Gemini, xAI or Groq."
          />
          <Feature
            title="Private by design"
            body="OAuth happens in your browser; Google's APIs are read directly with your token. No server ever sees your data."
          />
        </div>
      </section>

      {/* detail: modal + AI */}
      <section className="mt-24 grid items-center gap-10 sm:mt-32 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
            Click into any project
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            The detail view is a full analytics page: traffic and signups on a
            shared axis, realtime presence, sign-in mix, collections, services
            — and an AI analyst that reads all of it and tells you what&apos;s
            working, what&apos;s bot noise, and what to do next.
          </p>
          <ul className="mt-6 space-y-3 text-[14px] text-muted">
            {[
              "Traffic ↔ Signups toggle on the same 7/28/90d window",
              "Pages, sources, countries, devices, OS and events breakdowns",
              "Insights + actions grounded in your real numbers, streamed live",
              "Your API key stays in your browser — billed to you, never to us",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shots/modal.png"
          alt="A project detail view with traffic chart, realtime presence and a streamed AI analysis"
          className="w-full rounded-[20px] border border-line3 shadow-pop"
        />
      </section>

      {/* breakdowns strip */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/shots/breakdowns.png"
        alt="Per-project breakdowns: pages, sources, countries, devices, operating systems, events and sign-in methods"
        className="mt-16 w-full rounded-[20px] border border-line3 shadow-pop"
      />

      {/* open source */}
      <section className="mt-24 rounded-[20px] border border-line bg-gradient-to-b from-panel to-inset p-8 text-center shadow-card sm:mt-32 sm:p-12">
        <h2 className="text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
          Free forever if you self-host
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Aerie is AGPL-3.0 open source. Clone the repo, create your own Google
          OAuth client, and deploy the static bundle anywhere — Firebase
          Hosting&apos;s free tier works. Every feature, no caps, no account
          with us. The cloud version exists for people who&apos;d rather skip
          the setup.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-6 py-3 text-[15px] font-medium text-muted transition-colors hover:border-[#4a4239] hover:text-ink"
        >
          Read the source ↗
        </a>
      </section>

      {/* pricing */}
      <section className="mt-24 sm:mt-32">
        <h2 className="text-center text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
          Simple pricing
        </h2>
        <p className="mt-3 text-center text-[13px] font-medium text-faint">
          Early access: every Pro feature is free while billing rolls out.
        </p>
        <div className="mt-10 grid gap-[13px] lg:grid-cols-3">
          <PriceCard
            name="Self-hosted"
            price="$0"
            cadence="forever"
            items={[
              "Every feature, no caps",
              "Your own OAuth client + hosting",
              "AGPL-3.0 — modify freely",
              "AI analyst with your own key",
            ]}
            cta="Deploy from GitHub ↗"
            href={GITHUB_URL}
          />
          <PriceCard
            name="Cloud Free"
            price="$0"
            cadence="no card required"
            items={[
              "Up to 3 projects",
              "28-day traffic windows",
              "AI analyst on Pro",
              "Zero setup — sign in and go",
            ]}
            cta="Continue with Google"
            onClick={onConnect}
          />
          <PriceCard
            name="Cloud Pro"
            price="$9"
            cadence="/mo billed yearly, after a 7-day free trial"
            sub="or $19 month-to-month, billed today"
            highlight
            items={[
              "Unlimited projects",
              "7 / 28 / 90-day windows",
              "AI analyst included — no key needed",
              "Alerts & weekly digest (coming)",
            ]}
            cta="Start free trial"
            onClick={onConnect}
          />
        </div>
      </section>

      {/* footer */}
      <footer className="mt-24 border-t border-line pt-8 text-center sm:mt-32">
        <p className="mx-auto max-w-md text-[11.5px] leading-relaxed text-faint">
          Aerie reads your Google data directly in your browser and never
          writes to it. Your Google Cloud access token stays in the browser —
          the hosted version sends only a limited identity token to check your
          subscription, and stores nothing but your email and plan.
          Self-hosted builds contact no server at all.
        </p>
        <div className="mt-5 flex items-center justify-center gap-6 text-[12px] font-medium text-faint">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            GitHub
          </a>
          <a
            href={`${GITHUB_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            AGPL-3.0
          </a>
          <span>© {new Date().getFullYear()} Aerie</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[15px] border border-line bg-gradient-to-b from-panel to-inset p-5 shadow-card">
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{body}</div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  cadence,
  sub,
  items,
  cta,
  href,
  onClick,
  highlight = false,
}: {
  name: string;
  price: string;
  cadence: string;
  sub?: string;
  items: string[];
  cta: string;
  href?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const btnCls = highlight
    ? "bg-accent text-paper hover:opacity-90"
    : "border border-line bg-panel text-muted hover:border-[#4a4239] hover:text-ink";
  return (
    <div
      className={`flex flex-col rounded-[20px] border p-6 shadow-card ${
        highlight
          ? "border-accent/50 bg-gradient-to-b from-[#2a221c] to-inset"
          : "border-line bg-gradient-to-b from-panel to-inset"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-[.08em] text-muted">
          {name}
        </span>
        {highlight && (
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.06em] text-accent">
            Best value
          </span>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-[-.03em] text-ink">
          {price}
        </span>
        <span className="text-[12px] font-medium text-faint">{cadence}</span>
      </div>
      {sub && (
        <div className="mt-1 text-[12px] font-medium text-faint">{sub}</div>
      )}
      <ul className="mt-6 flex-1 space-y-2.5 text-[13px] text-muted">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5">
            <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {it}
          </li>
        ))}
      </ul>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-7 rounded-xl px-4 py-2.5 text-center text-[13.5px] font-semibold transition-all ${btnCls}`}
        >
          {cta}
        </a>
      ) : (
        <button
          onClick={onClick}
          className={`mt-7 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition-all ${btnCls}`}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        d="M12 11v3.6h5c-.2 1.3-1.6 3.8-5 3.8a5.4 5.4 0 010-10.8c1.6 0 2.7.7 3.3 1.3l2.4-2.3C16.9 4.9 14.7 4 12 4a8 8 0 100 16c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z"
      />
    </svg>
  );
}
