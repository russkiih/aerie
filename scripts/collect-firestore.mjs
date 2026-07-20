#!/usr/bin/env node
// Collects real Firestore metrics for ONE project using the Admin SDK and a
// service-account key. Requires:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
//   node scripts/collect-firestore.mjs --project <projectId>
//
// The service account needs read access to Firestore (e.g. roles/viewer or
// roles/datastore.viewer). Output is MERGED into web/data/firestore.json,
// keyed by project — run once per project/key.
//
// Metrics (all real, from count() aggregation queries — cheap, server-side):
//   • top-level collection names
//   • document count per collection
//   • total document count
// Read/write/delete rates and storage bytes come from Cloud Monitoring (a
// later collector) — this one needs only a Viewer key.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../web/data/firestore.json");

const argv = process.argv.slice(2);
const pIdx = argv.indexOf("--project");
const projectId = pIdx !== -1 ? argv[pIdx + 1] : process.env.GCLOUD_PROJECT;

if (!projectId) {
  console.error("Usage: node scripts/collect-firestore.mjs --project <id>");
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key JSON path."
  );
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const key = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({ credential: cert(key), projectId });
const db = getFirestore();

console.log(`• ${projectId}: listing collections…`);
const collections = await db.listCollections();
const perCollection = [];
let total = 0;

for (const col of collections) {
  try {
    const snap = await col.count().get();
    const n = snap.data().count;
    perCollection.push({ name: col.id, count: n });
    total += n;
    console.log(`   ${col.id}: ${n}`);
  } catch (e) {
    perCollection.push({ name: col.id, count: null });
    console.log(`   ${col.id}: (count failed)`);
  }
}

perCollection.sort((a, b) => (b.count || 0) - (a.count || 0));

// merge into existing file
mkdirSync(dirname(OUT), { recursive: true });
const existing = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : {};
existing[projectId] = {
  collectionCount: collections.length,
  totalDocuments: total,
  collections: perCollection,
  collectedAt: new Date().toISOString(),
};
writeFileSync(OUT, JSON.stringify(existing, null, 2));
console.log(
  `\n✓ ${projectId}: ${collections.length} collections, ${total} documents → ${OUT}`
);
process.exit(0);
