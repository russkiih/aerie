import Link from "next/link";
export type Platform = "web" | "ios" | "android";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
      {children}
    </div>
  );
}

export function TopBar({ generatedAt }: { generatedAt: string }) {
  return (
    <header className="mb-8 flex items-center justify-between border-b border-line pb-5">
      <Link href="/" className="group flex items-center gap-3">
        <Logo />
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-tight text-ink">
            Aerie
          </div>
          <div className="mt-1 text-[11px] text-faint">
            Firebase command center
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-4 text-[11px] text-faint">
        <span className="hidden sm:inline">
          snapshot · {formatDate(generatedAt)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          connected
        </span>
      </div>
    </header>
  );
}

export function Logo() {
  return (
    <span
      className="grid h-10 w-10 place-items-center rounded-xl border border-line3 shadow-tab"
      style={{ background: "linear-gradient(180deg,#282219,#1e1b17)" }}
    >
      {/* eagle's-nest / peak mark */}
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 20L10 6l3.5 7L16 9l5 11H3z"
          stroke="#d97757"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl2 border border-line bg-gradient-to-b from-panel to-inset shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[15px] border border-line bg-gradient-to-b from-panel to-inset px-[18px] pb-4 pt-[17px] shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-[.11em] text-faint">
        {label}
      </div>
      <div
        className={`mt-[9px] text-[30px] font-semibold leading-none tracking-[-.025em] tabular-nums ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-[7px] text-[11px] font-medium text-faint">{sub}</div>
      )}
    </div>
  );
}

// Flat stat tile used inside the detail modal.
export function TileStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[13px] border border-line bg-tile px-4 py-[15px]">
      <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-faint">
        {label}
      </div>
      <div
        className={`mt-[7px] text-2xl font-semibold tracking-[-.02em] tabular-nums ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function Meter({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-panel2">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
      {children}
    </h2>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  const map: Record<Platform, { label: string; icon: React.ReactNode }> = {
    web: { label: "Web", icon: <GlobeIcon /> },
    ios: { label: "iOS", icon: <AppleIcon /> },
    android: { label: "Android", icon: <AndroidIcon /> },
  };
  const m = map[platform];
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] border border-line bg-panel2 px-[7px] py-[3px] text-[10px] font-medium text-muted">
      {m.icon}
      {m.label}
    </span>
  );
}

export function StatusPanel({
  ok = false,
  title,
  rows,
  note,
}: {
  ok?: boolean;
  title: string;
  rows: [string, string][];
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel2/40 p-5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <span
          className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-ok" : "bg-faint"}`}
        />
        {title}
      </div>
      <dl className="mt-4 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-faint">{k}</dt>
            <dd className="truncate font-mono text-[12px] text-muted" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {note && (
        <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-faint">
          {note}
        </p>
      )}
    </div>
  );
}

export function AwaitingConnection({
  api,
  metric,
}: {
  api: string;
  metric: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line bg-panel2/40 p-5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <LockIcon />
        {metric}
      </div>
      <p className="max-w-md text-[12.5px] leading-relaxed text-muted">
        Live {metric.toLowerCase()} populate once you connect a service-account
        key for this project. Aerie reads them through the{" "}
        <span className="text-ink">{api}</span> — no numbers are shown until
        real data is available.
      </p>
      <span className="rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-faint">
        Coming in the self-host connect flow (P1)
      </span>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* icons — minimal, single-weight */
function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.4 12.9c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7.9 1.4 2 2.5 2 1 0 1.3-.6 2.5-.6s1.5.6 2.6.6 1.7-.9 2.4-1.8c.7-1 1-2 1-2.1-.1 0-2-1-2-3.1zM14.6 6.4c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.4 2.3-1.1z" />
    </svg>
  );
}
function AndroidIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 9v7a1.5 1.5 0 001.5 1.5H8V20a1 1 0 002 0v-2.5h4V20a1 1 0 002 0v-2.5h.5A1.5 1.5 0 0018 16V9H6zM4.5 9A1.5 1.5 0 003 10.5v4a1.5 1.5 0 003 0v-4A1.5 1.5 0 004.5 9zm15 0a1.5 1.5 0 00-1.5 1.5v4a1.5 1.5 0 003 0v-4A1.5 1.5 0 0019.5 9zM15.6 4.5l1-1.5a.3.3 0 00-.5-.3l-1 1.6a6 6 0 00-4.2 0l-1-1.6a.3.3 0 00-.5.3l1 1.5A5.3 5.3 0 006 8.4h12a5.3 5.3 0 00-2.4-3.9zM9.5 7a.7.7 0 110-1.4.7.7 0 010 1.4zm5 0a.7.7 0 110-1.4.7.7 0 010 1.4z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        stroke="#8b9099"
        strokeWidth="1.6"
      />
      <path
        d="M8 10V7a4 4 0 118 0v3"
        stroke="#8b9099"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
