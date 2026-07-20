#!/usr/bin/env node
// Aerie CLI — read your whole Firebase estate from the terminal.
//
//   aerie overview                 account-wide rollup
//   aerie projects                 list all projects
//   aerie apps <projectId>         list a project's apps
//   aerie project <projectId>      full detail for one project
//   aerie snapshot [--out FILE]    write a JSON snapshot
//
// Global flag: --json  → machine-readable output for scripts and agents.
// Auth: FIREBASE_TOKEN or GOOGLE_APPLICATION_CREDENTIALS (same as firebase CLI).

import { writeFileSync } from "node:fs";
import {
  collectSnapshot,
  listProjects,
  enrichProject,
  listApps,
} from "../core/reader.mjs";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const args = argv.filter((a) => !a.startsWith("--"));
const cmd = args[0] || "help";

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const accent = (s) => `\x1b[38;5;173m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const out = (o) => console.log(JSON.stringify(o, null, 2));

function findProject(id) {
  const p = listProjects().find((x) => x.projectId === id);
  if (!p) {
    console.error(`Project not found: ${id}`);
    process.exit(1);
  }
  return enrichProject(p);
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

try {
  switch (cmd) {
    case "overview": {
      const snap = collectSnapshot();
      if (json) {
        out(snap.account);
        break;
      }
      const a = snap.account;
      console.log("\n" + bold(accent("Aerie")) + dim("  · Firebase estate\n"));
      console.log(`  ${bold(pad(a.projectCount, 4))} projects`);
      console.log(`  ${bold(pad(a.appCount, 4))} apps  ${dim(
        `(${a.platformTotals.web} web · ${a.platformTotals.ios} iOS · ${a.platformTotals.android} android)`
      )}`);
      console.log(`  ${bold(pad(a.firestoreEnabled, 4))} with Firestore`);
      console.log(`  ${bold(pad(a.analyticsWired, 4))} with GA4 analytics`);
      console.log(`  ${bold(pad(a.liveSites, 4))} live hosting sites`);
      console.log("");
      break;
    }

    case "projects": {
      const projects = listProjects().map(enrichProject);
      if (json) {
        out(projects);
        break;
      }
      console.log(
        "\n  " +
          dim(pad("PROJECT ID", 30) + pad("NAME", 24) + pad("APPS", 6) + "SIGNALS")
      );
      for (const p of projects.sort((a, b) => b.apps.length - a.apps.length)) {
        const sig = [
          p.firestore.configured ? ok("firestore") : dim("firestore"),
          p.analytics.wired ? ok("ga4") : dim("ga4"),
        ].join(" ");
        console.log(
          "  " +
            accent(pad(p.id, 30)) +
            pad(p.name, 24) +
            pad(p.apps.length, 6) +
            sig
        );
      }
      console.log("");
      break;
    }

    case "apps": {
      const id = args[1];
      if (!id) {
        fail("usage: aerie apps <projectId>");
        break;
      }
      const apps = listApps(id);
      if (json) {
        out(apps);
        break;
      }
      console.log(`\n  ${bold(id)} — ${apps.length} app(s)\n`);
      for (const a of apps) {
        console.log(
          `  ${pad(a.platform, 9)} ${bold(pad(a.name, 26))} ${dim(a.id)}`
        );
      }
      console.log("");
      break;
    }

    case "project": {
      const id = args[1];
      if (!id) {
        fail("usage: aerie project <projectId>");
        break;
      }
      const p = findProject(id);
      if (json) {
        out(p);
        break;
      }
      console.log(`\n  ${bold(accent(p.name))}  ${dim(p.id + " · #" + p.number)}\n`);
      console.log(
        `  Firestore  ${p.firestore.configured ? ok(p.firestore.mode || "configured") : dim("not configured")}`
      );
      console.log(
        `  Analytics  ${p.analytics.wired ? ok(p.analytics.measurementId) : dim("not wired")}`
      );
      console.log(`  Apps       ${p.apps.length}`);
      for (const a of p.apps)
        console.log(`    ${dim("·")} ${pad(a.platform, 8)} ${a.name}`);
      if (p.hostingSites.length) {
        console.log(`  Hosting`);
        for (const s of p.hostingSites) console.log(`    ${dim("·")} ${s.url}`);
      }
      console.log("");
      break;
    }

    case "snapshot": {
      const i = argv.indexOf("--out");
      const file = i !== -1 ? argv[i + 1] : "aerie-snapshot.json";
      const snap = collectSnapshot();
      writeFileSync(file, JSON.stringify(snap, null, 2));
      console.log(
        `✓ Snapshot written: ${snap.account.projectCount} projects → ${file}`
      );
      break;
    }

    default:
      console.log(`
${bold(accent("aerie"))} — one terminal view of every Firebase project

  ${bold("aerie overview")}              account-wide rollup
  ${bold("aerie projects")}              list all projects
  ${bold("aerie apps")} <projectId>      list a project's apps
  ${bold("aerie project")} <projectId>   full detail for one project
  ${bold("aerie snapshot")} [--out FILE] write a JSON snapshot

  ${dim("Add --json to any command for machine-readable output.")}
  ${dim("Auth: FIREBASE_TOKEN or GOOGLE_APPLICATION_CREDENTIALS.")}
`);
  }
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
