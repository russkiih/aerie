#!/usr/bin/env node
// Collects AGGREGATE-ONLY Auth metrics per project. The user explicitly
// consented to this read. Privacy contract (enforced by this script):
//   • Raw exports are written to a temp file, read once, then DELETED.
//   • ONLY aggregate counts are persisted — total users, signups-by-month,
//     sign-in-method breakdown, verified/disabled/active counts.
//   • NO emails, UIDs, names, phone numbers or any personal identifier is
//     ever written to the output or logged.
//
// Output: web/data/auth.json  (merged into the dashboard snapshot).

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listProjects } from "../core/reader.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../web/data/auth.json");
const TMP_DIR = resolve(__dirname, "../.auth-tmp");
mkdirSync(TMP_DIR, { recursive: true });

const now = Date.now();
const DAY = 86400000;

function monthKey(ms) {
  const d = new Date(Number(ms));
  if (isNaN(d)) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function aggregate(users) {
  const byMonth = {};
  const providers = {};
  let verified = 0,
    disabled = 0,
    active30 = 0,
    active7 = 0;

  for (const u of users) {
    const m = monthKey(u.createdAt);
    if (m) byMonth[m] = (byMonth[m] || 0) + 1;

    const provs = new Set(
      (u.providerUserInfo || []).map((p) => p.providerId).filter(Boolean)
    );
    if (provs.size === 0 && u.passwordHash) provs.add("password");
    for (const p of provs) providers[p] = (providers[p] || 0) + 1;

    if (u.emailVerified) verified++;
    if (u.disabled) disabled++;
    const last = Number(u.lastLoginAt || u.lastRefreshAt || 0);
    if (last && now - last < 30 * DAY) active30++;
    if (last && now - last < 7 * DAY) active7++;
  }

  // sort months ascending
  const months = Object.keys(byMonth).sort();
  return {
    totalUsers: users.length,
    verified,
    disabled,
    active30,
    active7,
    providers,
    signupsByMonth: months.map((m) => ({ month: m, count: byMonth[m] })),
  };
}

const result = {};
const projects = listProjects();

for (const p of projects) {
  const id = p.projectId;
  const file = resolve(TMP_DIR, `${id}.json`);
  process.stdout.write(`• ${id} … `);
  try {
    execFileSync(
      "firebase",
      ["auth:export", file, "--project", id, "--format=json"],
      { encoding: "utf8", stdio: "pipe", env: process.env }
    );
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const users = raw.users || [];
    result[id] = aggregate(users);
    console.log(`${result[id].totalUsers} users`);
  } catch (e) {
    result[id] = { totalUsers: 0, error: true };
    console.log("no auth / error");
  } finally {
    // Delete the raw PII export immediately, always.
    try {
      rmSync(file, { force: true });
    } catch {}
  }
}

// Remove the temp dir entirely — no raw exports left behind.
try {
  rmSync(TMP_DIR, { recursive: true, force: true });
} catch {}

writeFileSync(OUT, JSON.stringify(result, null, 2));
const total = Object.values(result).reduce((s, a) => s + (a.totalUsers || 0), 0);
console.log(`\n✓ Auth aggregates: ${total} users across ${projects.length} projects → ${OUT}`);
