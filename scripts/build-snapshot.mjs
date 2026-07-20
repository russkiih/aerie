#!/usr/bin/env node
// Builds a real data snapshot of the connected Firebase account and writes it to
// web/data/snapshot.json, which the static dashboard imports at build time.
//
// All reads go through core/reader.mjs (Firebase CLI, read-only). Metric surfaces
// that need a per-project service account (Auth counts, Firestore usage, GA4
// counts) are represented as explicit "awaiting connection" states in the UI —
// we never fabricate numbers.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectSnapshot } from "../core/reader.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../web/data/snapshot.json");

console.log("• Reading Firebase account…");
const snapshot = collectSnapshot({
  generatedAt: process.env.SNAPSHOT_TIME || new Date().toISOString(),
  onProgress: (p) =>
    console.log(
      `  ${p.id} — ${p.apps.length} app(s) · firestore ${
        p.firestore.configured ? "✓" : "—"
      } · ga4 ${p.analytics.wired ? "✓" : "—"} · ${
        p.hostingSites.length
      } site(s)`
    ),
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
console.log(
  `\n✓ Snapshot: ${snapshot.account.projectCount} projects, ${snapshot.account.appCount} apps → ${OUT}`
);
