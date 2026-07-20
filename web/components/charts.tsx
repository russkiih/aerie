"use client";

import { useEffect, useId, useRef, useState } from "react";

// ── shared helpers ──────────────────────────────────────────────────────────

const ACCENT = "#d97757";
const LINE = "#2c2721";
const FAINT = "#6b635a";
const COMPARE = "#8a8177"; // muted line for the previous-period overlay
const AXIS_FONT = "var(--font-mono), ui-monospace, monospace";

// Signed percentage change, formatted for a delta chip. Returns null when there
// is no meaningful baseline to compare against.
function pct(curr: number, prev: number): string | null {
  if (prev <= 0) return curr > 0 ? "New" : null;
  const d = ((curr - prev) / prev) * 100;
  if (!isFinite(d)) return null;
  const r = Math.round(d);
  return `${r > 0 ? "+" : ""}${r}%`;
}

// Round a max up to a "nice" axis bound (1/2/5 × 10^n) so gridlines read cleanly.
function niceCeil(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function compact(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

// Aerie stores dates as YYYYMMDD (GA4 daily) or YYYY-MM (signups by month).
function defaultFmt(d: string) {
  if (/^\d{8}$/.test(d))
    return new Date(
      Number(d.slice(0, 4)),
      Number(d.slice(4, 6)) - 1,
      Number(d.slice(6, 8))
    ).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (/^\d{4}-\d{2}$/.test(d)) {
    const [y, m] = d.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
      month: "short",
    });
  }
  return d;
}

// Measure the rendered width so the SVG uses real pixels — crisp text, no
// stretched strokes.
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) =>
      setW(entries[0].contentRect.width)
    );
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function smoothPath(pts: [number, number][]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  return pts.reduce(
    (d, [x, y], i) => (i === 0 ? `M${x},${y}` : `${d} L${x},${y}`),
    ""
  );
}

// ── TimeSeriesChart — area + line, gridlines, y-axis, hover crosshair ─────────

export function TimeSeriesChart({
  data,
  compare,
  compareLabel = "Prev 28d",
  height = 176,
  format = defaultFmt,
  legend = true,
}: {
  data: { date: string; value: number }[];
  // Optional previous-period series, aligned to `data` by index. Drawn as a
  // faint dashed line behind the main series (GA-style comparison).
  compare?: { date: string; value: number }[];
  compareLabel?: string;
  height?: number;
  format?: (d: string) => string;
  // Hide the built-in overlay legend when the caller renders its own.
  legend?: boolean;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/[:]/g, "");

  const hasCompare = !!compare && compare.some((d) => d.value > 0);

  const padL = 36;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const iw = Math.max(1, w - padL - padR);
  const ih = Math.max(1, height - padT - padB);
  const n = data.length;

  const rawMax = Math.max(
    1,
    ...data.map((d) => d.value),
    ...(hasCompare ? compare!.map((d) => d.value) : [])
  );
  const max = niceCeil(rawMax);

  const px = (i: number) =>
    padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const py = (v: number) => padT + ih - (v / max) * ih;

  const pts: [number, number][] = data.map((d, i) => [px(i), py(d.value)]);
  const line = smoothPath(pts);
  const area =
    pts.length > 0
      ? `${line} L${pts[pts.length - 1][0]},${padT + ih} L${pts[0][0]},${
          padT + ih
        } Z`
      : "";

  const comparePts: [number, number][] = hasCompare
    ? compare!.slice(0, n).map((d, i) => [px(i), py(d.value)])
    : [];
  const compareLine = smoothPath(comparePts);

  // three gridlines: 0, half, full — drop the midline when its rounded label
  // would duplicate a neighbor (tiny maxima like 1 signup/day)
  const mid = max / 2;
  const ticks =
    compact(mid) === compact(max) || compact(mid) === compact(0)
      ? [0, max]
      : [0, mid, max];

  // up to 5 evenly spaced x labels
  const labelIdx = new Set<number>();
  if (n > 0) {
    const steps = Math.min(4, n - 1);
    for (let s = 0; s <= steps; s++) {
      labelIdx.add(steps === 0 ? 0 : Math.round((s / steps) * (n - 1)));
    }
  }

  function onMove(e: React.MouseEvent) {
    if (!ref.current || n === 0) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - padL;
    const i = Math.max(0, Math.min(n - 1, Math.round((relX / iw) * (n - 1))));
    setHover(i);
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          className="block"
        >
          <defs>
            <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.32} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* gridlines + y labels */}
          {ticks.map((t, i) => {
            const y = py(t);
            return (
              <g key={i}>
                <line
                  x1={padL}
                  x2={w - padR}
                  y1={y}
                  y2={y}
                  stroke={LINE}
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? "" : "3 3"}
                />
                <text
                  x={padL - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily={AXIS_FONT}
                  fill={FAINT}
                >
                  {compact(t)}
                </text>
              </g>
            );
          })}

          {area && <path d={area} fill={`url(#g-${gid})`} />}
          {compareLine && (
            <path
              d={compareLine}
              fill="none"
              stroke={COMPARE}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.9}
            />
          )}
          {line && (
            <path
              d={line}
              fill="none"
              stroke={ACCENT}
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* last-point marker when not hovering */}
          {hover === null && n > 1 && (
            <circle
              cx={px(n - 1)}
              cy={py(data[n - 1].value)}
              r={3.6}
              fill={ACCENT}
              stroke="#1c1916"
              strokeWidth={2.5}
            />
          )}

          {/* x labels */}
          {data.map((d, i) =>
            labelIdx.has(i) ? (
              <text
                key={i}
                x={px(i)}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fontSize={10.5}
                fontFamily={AXIS_FONT}
                fill={FAINT}
              >
                {format(d.date)}
              </text>
            ) : null
          )}

          {/* hover crosshair + dot */}
          {hover !== null && (
            <g>
              <line
                x1={px(hover)}
                x2={px(hover)}
                y1={padT}
                y2={padT + ih}
                stroke={ACCENT}
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              {hasCompare && compare![hover] && (
                <circle
                  cx={px(hover)}
                  cy={py(compare![hover].value)}
                  r={3}
                  fill={COMPARE}
                  stroke="#1c1916"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={px(hover)}
                cy={py(data[hover].value)}
                r={4}
                fill={ACCENT}
                stroke="#1c1916"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      )}

      {/* legend — only when a comparison line is present */}
      {legend && hasCompare && w > 0 && (
        <div className="pointer-events-none absolute right-0 top-0 flex items-center gap-3 text-[10px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-3 rounded-full bg-accent" />
            Current
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0 w-3 border-t border-dashed"
              style={{ borderColor: COMPARE }}
            />
            {compareLabel}
          </span>
        </div>
      )}

      {/* tooltip */}
      {hover !== null && w > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] shadow-lg"
          style={{
            left: Math.min(Math.max(px(hover), 46), w - 46),
            top: Math.max(0, py(data[hover].value) - (hasCompare ? 60 : 44)),
          }}
        >
          <div className="font-medium text-ink">{format(data[hover].date)}</div>
          <div className="text-accent">
            {data[hover].value.toLocaleString()}
          </div>
          {hasCompare && compare![hover] && (
            <div className="mt-0.5 flex items-center gap-1.5 text-faint">
              <span style={{ color: COMPARE }}>
                {compare![hover].value.toLocaleString()}
              </span>
              {(() => {
                const p = pct(data[hover].value, compare![hover].value);
                return p ? <DeltaTag text={p} /> : null;
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A small +/- delta pill. Green for up, red for down, neutral for "New".
function DeltaTag({ text }: { text: string }) {
  const up = text.startsWith("+");
  const down = text.startsWith("-");
  const cls = up ? "text-ok" : down ? "text-warn" : "text-faint";
  return <span className={`font-medium ${cls}`}>{text}</span>;
}

// ── SeriesSummary — GA-style Total / Peak / Avg chips for a time series ───────

export function SeriesSummary({
  data,
  compare,
  format = defaultFmt,
}: {
  data: { date: string; value: number }[];
  // Optional previous-period series — adds a "vs prev" delta to the Total chip.
  compare?: { date: string; value: number }[];
  format?: (d: string) => string;
}) {
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  const peak = data.reduce((m, d) => (d.value > m.value ? d : m), data[0]);
  const avg = Math.round(total / data.length);
  const prevTotal = compare?.reduce((s, d) => s + d.value, 0);
  const delta =
    prevTotal !== undefined ? pct(total, prevTotal) : null;
  return (
    <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3">
      <Chip
        label="Total"
        value={total.toLocaleString()}
        delta={delta || undefined}
        deltaSub={delta ? "vs prev" : undefined}
      />
      <Chip
        label="Peak / day"
        value={peak.value.toLocaleString()}
        sub={format(peak.date)}
      />
      <Chip label="Avg / day" value={avg.toLocaleString()} />
    </div>
  );
}

// A row of labelled metric chips — reused across the traffic summary and the
// project detail modal so numbers read consistently.
export function Chips({
  items,
  className = "",
}: {
  items: { label: string; value: string; sub?: string }[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-x-8 gap-y-2 ${className}`}>
      {items.map((it) => (
        <Chip key={it.label} {...it} />
      ))}
    </div>
  );
}

export function Chip({
  label,
  value,
  sub,
  delta,
  deltaSub,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaSub?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-faint">
        {label}
      </div>
      <div className="mt-0.5 text-[16px] font-semibold tracking-tight text-ink">
        {value}
        {sub && (
          <span className="ml-1.5 text-[11px] font-normal text-faint">
            {sub}
          </span>
        )}
      </div>
      {delta && (
        <div className="mt-0.5 flex items-center gap-1 text-[11px]">
          <DeltaTag text={delta} />
          {deltaSub && <span className="text-faint">{deltaSub}</span>}
        </div>
      )}
    </div>
  );
}

// ── Sparkline — mini area+line for cards (no axes, no hover) ──────────────────

export function Sparkline({
  data,
  height = 34,
}: {
  data: number[];
  height?: number;
}) {
  const gid = useId().replace(/[:]/g, "");
  const W = 100;
  const n = data.length;
  const max = Math.max(1, ...data);
  const pts: [number, number][] = data.map((v, i) => [
    n <= 1 ? W / 2 : (i / (n - 1)) * W,
    height - 2 - (v / max) * (height - 4),
  ]);
  const line = smoothPath(pts);
  const area =
    pts.length > 0
      ? `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`
      : "";
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className="block"
    >
      <defs>
        <linearGradient id={`s-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#s-${gid})`} />}
      {line && (
        <path
          d={line}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
