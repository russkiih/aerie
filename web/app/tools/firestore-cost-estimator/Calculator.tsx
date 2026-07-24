"use client";

import { useMemo, useState } from "react";
import { FIRESTORE, FREE_TIER, usd, type FirestoreRegion } from "@/lib/firebase-pricing";
import { Card } from "@/components/ui";
import { NumberField, LineItem, parseNum } from "@/components/tools/fields";

const DAYS_PER_MONTH = 30;

function monthlyCost(region: FirestoreRegion, readsPerDay: number, writesPerDay: number, deletesPerDay: number) {
  const rates = FIRESTORE[region];
  const free = FREE_TIER.firestore;
  const billableReads = Math.max(0, readsPerDay - free.readsPerDay);
  const billableWrites = Math.max(0, writesPerDay - free.writesPerDay);
  const billableDeletes = Math.max(0, deletesPerDay - free.deletesPerDay);
  const readsCost = (billableReads / 100_000) * rates.readsPer100k * DAYS_PER_MONTH;
  const writesCost = (billableWrites / 100_000) * rates.writesPer100k * DAYS_PER_MONTH;
  const deletesCost = (billableDeletes / 100_000) * rates.deletesPer100k * DAYS_PER_MONTH;
  return {
    total: readsCost + writesCost + deletesCost,
    readsCost,
    writesCost,
    deletesCost,
    billableReads,
    billableWrites,
    billableDeletes,
  };
}

export default function Calculator() {
  const [reads, setReads] = useState("");
  const [writes, setWrites] = useState("");
  const [deletes, setDeletes] = useState("");

  const result = useMemo(() => {
    const readsPerDay = parseNum(reads);
    const writesPerDay = parseNum(writes);
    const deletesPerDay = parseNum(deletes);
    const nam5 = monthlyCost("nam5", readsPerDay, writesPerDay, deletesPerDay);
    const regional = monthlyCost("us-central1", readsPerDay, writesPerDay, deletesPerDay);
    const monthlyDiff = nam5.total - regional.total;
    const annualDiff = monthlyDiff * 12;
    return { nam5, regional, monthlyDiff, annualDiff };
  }, [reads, writes, deletes]);

  const maxLine = Math.max(1, result.nam5.readsCost, result.nam5.writesCost, result.nam5.deletesCost);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <span className="text-[13px] font-semibold text-ink">Daily volume</span>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-fainter">
          Same volume, priced two ways — the free tier is subtracted once,
          identically, before either rate is applied.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <NumberField label="Document reads" value={reads} onChange={setReads} suffix="/day" />
          <NumberField label="Document writes" value={writes} onChange={setWrites} suffix="/day" />
          <NumberField label="Document deletes" value={deletes} onChange={setDeletes} suffix="/day" />
        </div>
      </Card>

      {/* headline: exactly 2x */}
      <div className="rounded-[20px] border border-accent/30 bg-gradient-to-b from-[#2a221c] to-inset p-6 text-center shadow-card">
        <div className="text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
          Multi-region costs exactly 2x single-region
        </div>
        <div className="mt-2.5 text-4xl font-semibold tracking-[-.03em] tabular-nums text-accent">
          {usd(result.annualDiff)}
          <span className="ml-1 text-[15px] font-medium text-faint">/year</span>
        </div>
        <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
          is what you pay extra for nam5 over us-central1 at this volume —
          most developers picked nam5 at project-creation time without
          knowing it doubles every Firestore read, write and delete.
        </p>
      </div>

      {/* side by side */}
      <div className="grid gap-5 sm:grid-cols-2">
        <RegionCard
          label={FIRESTORE.nam5.label}
          total={result.nam5.total}
          highlight
        />
        <RegionCard
          label={FIRESTORE["us-central1"].label}
          total={result.regional.total}
        />
      </div>

      {/* breakdown for the pricier option, since that's the one worth explaining */}
      <div>
        <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
          nam5 breakdown
        </div>
        <div className="flex flex-col gap-2">
          <LineItem
            label="Reads"
            detail={`${result.nam5.billableReads.toLocaleString()} billable reads/day × 30`}
            cost={result.nam5.readsCost}
            max={maxLine}
          />
          <LineItem
            label="Writes"
            detail={`${result.nam5.billableWrites.toLocaleString()} billable writes/day × 30`}
            cost={result.nam5.writesCost}
            max={maxLine}
          />
          <LineItem
            label="Deletes"
            detail={`${result.nam5.billableDeletes.toLocaleString()} billable deletes/day × 30`}
            cost={result.nam5.deletesCost}
            max={maxLine}
          />
        </div>
      </div>
    </div>
  );
}

function RegionCard({
  label,
  total,
  highlight = false,
}: {
  label: string;
  total: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[15px] border p-5 shadow-card ${
        highlight
          ? "border-accent/40 bg-gradient-to-b from-[#2a221c] to-inset"
          : "border-line bg-gradient-to-b from-panel to-inset"
      }`}
    >
      <div className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </div>
      <div
        className={`mt-2.5 text-3xl font-semibold tracking-[-.03em] tabular-nums ${
          highlight ? "text-accent" : "text-ink"
        }`}
      >
        {usd(total)}
        <span className="ml-1 text-[13px] font-medium text-faint">/mo</span>
      </div>
    </div>
  );
}
