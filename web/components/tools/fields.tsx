// Small presentational form controls shared by the /tools calculators. No
// hooks of their own — every one is a controlled component driven by the
// client calculator that renders it, so they're safe to import from a
// "use client" file without needing the directive here themselves.

import type { FirestoreRegion } from "@/lib/firebase-pricing";
import { FIRESTORE, usd } from "@/lib/firebase-pricing";

/** Parse a raw <input> string into a safe, non-negative number. Empty,
 *  garbage ("abc"), and negative input all collapse to 0 — the one rule
 *  every tool on this page must never break is "no NaN on screen." */
export function parseNum(raw: string): number {
  const n = parseFloat(raw);
  if (!isFinite(n) || isNaN(n) || n < 0) return 0;
  return n;
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  placeholder = "0",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </span>
      <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-line bg-inset px-3 py-3 focus-within:border-accent">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-[16px] font-medium text-ink placeholder:text-fainter focus:outline-none"
        />
        {suffix && (
          <span className="shrink-0 text-[12px] font-medium text-faint">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <span className="mt-1.5 block text-[11px] leading-relaxed text-fainter">
          {hint}
        </span>
      )}
    </label>
  );
}

export function RegionToggle({
  value,
  onChange,
}: {
  value: FirestoreRegion;
  onChange: (r: FirestoreRegion) => void;
}) {
  return (
    <div className="inline-flex items-center gap-[3px] rounded-[11px] border border-line bg-inset p-[3px]">
      {(Object.keys(FIRESTORE) as FirestoreRegion[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`min-h-[42px] rounded-lg px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
            value === r
              ? "bg-[#332d26] text-ink"
              : "text-faint hover:text-muted"
          }`}
        >
          {FIRESTORE[r].label}
        </button>
      ))}
    </div>
  );
}

/** One row of a cost breakdown: label, a short usage detail, and the dollar
 *  amount, with a proportional fill bar behind it so the dominant line item
 *  is visible at a glance without reading every number. */
export function LineItem({
  label,
  detail,
  cost,
  max,
}: {
  label: string;
  detail: string;
  cost: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, (cost / max) * 100) : 0;
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-line2 bg-tile px-3.5 py-3">
      <div
        className="absolute inset-y-0 left-0 bg-panel2"
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink">{label}</div>
          <div className="mt-0.5 truncate text-[11px] text-faint">
            {detail}
          </div>
        </div>
        <div className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink">
          {usd(cost)}
        </div>
      </div>
    </div>
  );
}
