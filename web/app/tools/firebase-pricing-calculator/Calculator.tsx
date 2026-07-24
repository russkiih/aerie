"use client";

import { useMemo, useState } from "react";
import {
  FIRESTORE,
  FREE_TIER,
  BLAZE,
  usd,
  type FirestoreRegion,
} from "@/lib/firebase-pricing";
import { Card } from "@/components/ui";
import { NumberField, RegionToggle, LineItem, parseNum } from "@/components/tools/fields";
import Link from "next/link";

const DAYS_PER_MONTH = 30;

export default function Calculator() {
  const [region, setRegion] = useState<FirestoreRegion>("nam5");
  const [reads, setReads] = useState("");
  const [writes, setWrites] = useState("");
  const [deletes, setDeletes] = useState("");
  const [storageGiB, setStorageGiB] = useState("");
  const [rtdbStorageGB, setRtdbStorageGB] = useState("");
  const [rtdbDownloadGB, setRtdbDownloadGB] = useState("");
  const [functionsInvocations, setFunctionsInvocations] = useState("");
  const [hostingTransferGB, setHostingTransferGB] = useState("");

  const result = useMemo(() => {
    const rates = FIRESTORE[region];
    const fsFree = FREE_TIER.firestore;

    const readsPerDay = parseNum(reads);
    const writesPerDay = parseNum(writes);
    const deletesPerDay = parseNum(deletes);
    const storedGiB = parseNum(storageGiB);

    const billableReadsPerDay = Math.max(0, readsPerDay - fsFree.readsPerDay);
    const billableWritesPerDay = Math.max(0, writesPerDay - fsFree.writesPerDay);
    const billableDeletesPerDay = Math.max(0, deletesPerDay - fsFree.deletesPerDay);
    const billableStorage = Math.max(0, storedGiB - fsFree.storedGiB);

    const readsCost = (billableReadsPerDay / 100_000) * rates.readsPer100k * DAYS_PER_MONTH;
    const writesCost = (billableWritesPerDay / 100_000) * rates.writesPer100k * DAYS_PER_MONTH;
    const deletesCost = (billableDeletesPerDay / 100_000) * rates.deletesPer100k * DAYS_PER_MONTH;
    const storageCost = billableStorage * rates.storagePerGiBMonth;

    const rtdbFree = FREE_TIER.realtimeDb;
    const rtdbStored = parseNum(rtdbStorageGB);
    const rtdbDownloaded = parseNum(rtdbDownloadGB);
    const billableRtdbStorage = Math.max(0, rtdbStored - rtdbFree.storedGB);
    const billableRtdbDownload = Math.max(0, rtdbDownloaded - rtdbFree.downloadedGBPerMonth);
    const rtdbStorageCost = billableRtdbStorage * BLAZE.realtimeDb.storagePerGB;
    const rtdbDownloadCost = billableRtdbDownload * BLAZE.realtimeDb.downloadPerGB;

    const fnFree = FREE_TIER.functions;
    const invocations = parseNum(functionsInvocations);
    const billableInvocations = Math.max(0, invocations - fnFree.invocationsPerMonth);
    const functionsCost = (billableInvocations / 1_000_000) * BLAZE.functions.perMillionInvocations;

    const hostingFree = FREE_TIER.hosting;
    const freeHostingTransferGB = (hostingFree.transferMBPerDay * DAYS_PER_MONTH) / 1024;
    const hostingTransfer = parseNum(hostingTransferGB);
    const billableHostingTransfer = Math.max(0, hostingTransfer - freeHostingTransferGB);
    const hostingCost = billableHostingTransfer * BLAZE.hosting.transferPerGB;

    const lines = [
      {
        key: "reads",
        label: "Firestore reads",
        detail: `${billableReadsPerDay.toLocaleString()} billable reads/day × ${DAYS_PER_MONTH}`,
        cost: readsCost,
      },
      {
        key: "writes",
        label: "Firestore writes",
        detail: `${billableWritesPerDay.toLocaleString()} billable writes/day × ${DAYS_PER_MONTH}`,
        cost: writesCost,
      },
      {
        key: "deletes",
        label: "Firestore deletes",
        detail: `${billableDeletesPerDay.toLocaleString()} billable deletes/day × ${DAYS_PER_MONTH}`,
        cost: deletesCost,
      },
      {
        key: "fsStorage",
        label: "Firestore storage",
        detail: `${billableStorage.toLocaleString()} billable GiB stored`,
        cost: storageCost,
      },
      {
        key: "rtdbStorage",
        label: "Realtime DB storage",
        detail: `${billableRtdbStorage.toLocaleString()} billable GB stored`,
        cost: rtdbStorageCost,
      },
      {
        key: "rtdbDownload",
        label: "Realtime DB downloads",
        detail: `${billableRtdbDownload.toLocaleString()} billable GB/mo`,
        cost: rtdbDownloadCost,
      },
      {
        key: "functions",
        label: "Cloud Functions invocations",
        detail: `${billableInvocations.toLocaleString()} billable invocations/mo`,
        cost: functionsCost,
      },
      {
        key: "hosting",
        label: "Hosting transfer",
        detail: `${billableHostingTransfer.toFixed(2)} billable GB/mo`,
        cost: hostingCost,
      },
    ];

    const total = lines.reduce((s, l) => s + l.cost, 0);
    const sorted = [...lines].sort((a, b) => b.cost - a.cost);

    return { lines: sorted, total };
  }, [
    region,
    reads,
    writes,
    deletes,
    storageGiB,
    rtdbStorageGB,
    rtdbDownloadGB,
    functionsInvocations,
    hostingTransferGB,
  ]);

  const maxLine = Math.max(1, ...result.lines.map((l) => l.cost));
  const topDriver = result.lines[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-ink">Firestore</span>
            <RegionToggle value={region} onChange={setRegion} />
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-fainter">
            Region changes the rate, not the volume — see the{" "}
            <Link
              href="/tools/firestore-cost-estimator/"
              className="text-faint underline decoration-line3 underline-offset-4 hover:text-muted"
            >
              Firestore Cost Estimator
            </Link>{" "}
            for the full nam5 vs us-central1 comparison.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField label="Document reads" value={reads} onChange={setReads} suffix="/day" />
            <NumberField label="Document writes" value={writes} onChange={setWrites} suffix="/day" />
            <NumberField label="Document deletes" value={deletes} onChange={setDeletes} suffix="/day" />
            <NumberField label="Stored data" value={storageGiB} onChange={setStorageGiB} suffix="GiB" />
          </div>
        </Card>

        <Card className="p-5">
          <span className="text-[13px] font-semibold text-ink">Realtime Database</span>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField label="Stored data" value={rtdbStorageGB} onChange={setRtdbStorageGB} suffix="GB" />
            <NumberField label="Downloaded" value={rtdbDownloadGB} onChange={setRtdbDownloadGB} suffix="GB/mo" />
          </div>
        </Card>

        <Card className="p-5">
          <span className="text-[13px] font-semibold text-ink">Cloud Functions</span>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-fainter">
            Invocations only — Google hasn&apos;t published a per-GB-second or
            per-vCPU-second Blaze rate in the source this tool cites, so
            compute time isn&apos;t priced here.
          </p>
          <div className="mt-4">
            <NumberField
              label="Invocations"
              value={functionsInvocations}
              onChange={setFunctionsInvocations}
              suffix="/mo"
            />
          </div>
        </Card>

        <Card className="p-5">
          <span className="text-[13px] font-semibold text-ink">Hosting</span>
          <div className="mt-4">
            <NumberField
              label="Data transfer"
              value={hostingTransferGB}
              onChange={setHostingTransferGB}
              suffix="GB/mo"
            />
          </div>
        </Card>
      </div>

      <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[20px] border border-line bg-gradient-to-b from-panel to-inset p-6 shadow-card">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.11em] text-faint">
            Estimated monthly bill
          </div>
          <div className="mt-2.5 text-4xl font-semibold tracking-[-.03em] tabular-nums text-accent">
            {usd(result.total)}
          </div>
          <div className="mt-2 text-[11.5px] leading-relaxed text-faint">
            Blaze plan · free tier already subtracted · 30-day month
          </div>
          {topDriver.cost > 0 && (
            <div className="mt-3 text-[11.5px] font-medium text-muted">
              Biggest driver:{" "}
              <span className="text-ink">{topDriver.label}</span> ·{" "}
              {usd(topDriver.cost)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {result.lines.map((l) => (
            <LineItem key={l.key} label={l.label} detail={l.detail} cost={l.cost} max={maxLine} />
          ))}
        </div>
      </div>
    </div>
  );
}
