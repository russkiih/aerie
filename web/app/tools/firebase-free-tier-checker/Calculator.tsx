"use client";

import { useMemo, useState } from "react";
import { FREE_TIER } from "@/lib/firebase-pricing";
import { Card } from "@/components/ui";
import { parseNum } from "@/components/tools/fields";

type FieldDef = {
  key: string;
  section: string;
  label: string;
  limit: number;
  suffix: string;
};

const FIELDS: FieldDef[] = [
  { key: "fsReads", section: "Firestore", label: "Document reads", limit: FREE_TIER.firestore.readsPerDay, suffix: "/ day" },
  { key: "fsWrites", section: "Firestore", label: "Document writes", limit: FREE_TIER.firestore.writesPerDay, suffix: "/ day" },
  { key: "fsDeletes", section: "Firestore", label: "Document deletes", limit: FREE_TIER.firestore.deletesPerDay, suffix: "/ day" },
  { key: "fsStorage", section: "Firestore", label: "Stored data", limit: FREE_TIER.firestore.storedGiB, suffix: "GiB" },
  { key: "fsEgress", section: "Firestore", label: "Network egress", limit: FREE_TIER.firestore.egressGiBPerMonth, suffix: "GiB / mo" },
  { key: "rtdbStorage", section: "Realtime Database", label: "Stored data", limit: FREE_TIER.realtimeDb.storedGB, suffix: "GB" },
  { key: "rtdbDownload", section: "Realtime Database", label: "Downloaded", limit: FREE_TIER.realtimeDb.downloadedGBPerMonth, suffix: "GB / mo" },
  { key: "rtdbConns", section: "Realtime Database", label: "Peak simultaneous connections", limit: FREE_TIER.realtimeDb.simultaneousConnections, suffix: "" },
  { key: "storStorage", section: "Cloud Storage", label: "Stored data", limit: FREE_TIER.storage.storedGB, suffix: "GB" },
  { key: "storDownload", section: "Cloud Storage", label: "Downloaded", limit: FREE_TIER.storage.downloadedGBPerMonth, suffix: "GB / mo" },
  { key: "storUpload", section: "Cloud Storage", label: "Upload operations", limit: FREE_TIER.storage.uploadOpsPerMonth, suffix: "/ mo" },
  { key: "storDownloadOps", section: "Cloud Storage", label: "Download operations", limit: FREE_TIER.storage.downloadOpsPerMonth, suffix: "/ mo" },
  { key: "hostStorage", section: "Hosting", label: "Stored data", limit: FREE_TIER.hosting.storedGB, suffix: "GB" },
  { key: "hostTransfer", section: "Hosting", label: "Data transfer", limit: FREE_TIER.hosting.transferMBPerDay, suffix: "MB / day" },
  { key: "authMau", section: "Authentication", label: "Monthly active users", limit: FREE_TIER.auth.monthlyActiveUsers, suffix: "MAU" },
];

const SECTIONS = Array.from(new Set(FIELDS.map((f) => f.section)));

export default function Calculator() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [functionsUsed, setFunctionsUsed] = useState(false);

  const results = useMemo(
    () =>
      FIELDS.map((f) => {
        const usage = parseNum(values[f.key] ?? "");
        const pct = f.limit > 0 ? (usage / f.limit) * 100 : 0;
        return { ...f, usage, pct };
      }),
    [values]
  );

  const worst = results.reduce((a, b) => (b.pct > a.pct ? b : a), results[0]);
  const overLimit = results.some((r) => r.pct >= 100);
  const needsBlaze = functionsUsed || overLimit;

  function setValue(key: string, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  return (
    <div className="space-y-6">
      {/* verdict banner */}
      <div
        className={`rounded-[20px] border p-6 shadow-card ${
          needsBlaze ? "border-warn/40 bg-warn/5" : "border-ok/30 bg-ok/5"
        }`}
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
          Verdict
        </div>
        <div
          className={`mt-2 text-2xl font-semibold tracking-[-.02em] ${
            needsBlaze ? "text-warn" : "text-ok"
          }`}
        >
          {needsBlaze ? "You need Blaze." : "You're within Spark limits."}
        </div>
        <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
          {functionsUsed
            ? "Cloud Functions require Blaze the moment you deploy one — Spark has zero allowance for them, no matter how small your usage."
            : overLimit
            ? `${worst.label} (${worst.section}) is over its Spark limit at ${worst.pct.toFixed(0)}% of ${worst.limit.toLocaleString()} ${worst.suffix}.`
            : worst.pct > 0
            ? `Closest to a limit: ${worst.label} (${worst.section}) at ${worst.pct.toFixed(0)}% of its Spark allowance.`
            : "Enter your usage below to check it against every Spark limit."}
        </p>
      </div>

      {/* Cloud Functions — the always-on callout */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-ink">Cloud Functions</div>
            <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted">
              Not available on Spark at all — zero free invocations, zero free
              compute. Deploying a single function forces the whole project
              onto Blaze, regardless of usage. This is the most common reason
              developers get pushed off the free tier.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.06em] text-warn">
            Blaze only
          </span>
        </div>
        <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] font-medium text-muted">
          <input
            type="checkbox"
            checked={functionsUsed}
            onChange={(e) => setFunctionsUsed(e.target.checked)}
            className="h-[18px] w-[18px] shrink-0 accent-[#d97757]"
          />
          I use, or plan to use, Cloud Functions
        </label>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section} className="p-5">
          <span className="text-[13px] font-semibold text-ink">{section}</span>
          <div className="mt-1">
            {results
              .filter((r) => r.section === section)
              .map((r) => (
                <LimitRow
                  key={r.key}
                  label={r.label}
                  suffix={r.suffix}
                  limit={r.limit}
                  pct={r.pct}
                  value={values[r.key] ?? ""}
                  onChange={(v) => setValue(r.key, v)}
                />
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function LimitRow({
  label,
  suffix,
  limit,
  pct,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  limit: number;
  pct: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const over = pct >= 100;
  const near = pct >= 70 && pct < 100;
  return (
    <div className="border-b border-line2 py-3.5 first:pt-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <span
          className={`font-mono text-[11px] font-semibold tabular-nums ${
            over || near ? "text-warn" : "text-faint"
          }`}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full min-w-0 rounded-[9px] border border-line bg-inset px-3 py-3 text-[16px] font-medium text-ink placeholder:text-fainter focus:border-accent focus:outline-none"
        />
        <span className="shrink-0 text-[11px] font-medium text-faint">
          / {limit.toLocaleString()} {suffix}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel2">
        <div
          className={`h-full rounded-full ${over ? "bg-warn" : "bg-accent"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
