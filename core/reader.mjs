// Shared Firebase reader used by the snapshot builder, the CLI and the MCP
// server. Authenticates via the Firebase CLI (FIREBASE_TOKEN or
// GOOGLE_APPLICATION_CREDENTIALS). Read-only — never mutates the account.

import { execFileSync } from "node:child_process";

function fb(args) {
  const out = execFileSync("firebase", [...args, "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  const start = out.indexOf("{");
  if (start === -1) throw new Error("no JSON in firebase output");
  return JSON.parse(out.slice(start));
}

const platformOf = (p) =>
  ({ WEB: "web", IOS: "ios", ANDROID: "android" }[p] || String(p).toLowerCase());

export function listProjects({ includeSelf = false } = {}) {
  const res = fb(["projects:list"]);
  return (res.result || []).filter(
    (p) =>
      p.state === "ACTIVE" &&
      (includeSelf || p.projectId !== "aerie-dashboard-app")
  );
}

export function listApps(projectId) {
  try {
    const res = fb(["apps:list", "--project", projectId]);
    return (Array.isArray(res.result) ? res.result : []).map((a) => ({
      id: a.appId,
      name: a.displayName || a.appId,
      platform: platformOf(a.platform),
      namespace: a.namespace || null,
      state: a.state || "ACTIVE",
    }));
  } catch {
    return [];
  }
}

export function firestoreStatus(projectId) {
  try {
    const res = fb(["firestore:databases:list", "--project", projectId]);
    const dbs = res.result?.databases || res.result || [];
    if (!Array.isArray(dbs) || dbs.length === 0) return { configured: false };
    const primary =
      dbs.find((d) => (d.name || "").endsWith("/(default)")) || dbs[0];
    return {
      configured: true,
      count: dbs.length,
      mode: primary.type || null,
      edition: primary.databaseEdition || primary.edition || null,
    };
  } catch {
    return { configured: false };
  }
}

export function hostingSites(projectId) {
  try {
    const res = fb(["hosting:sites:list", "--project", projectId]);
    return (res.result?.sites || []).map((s) => ({
      url: s.defaultUrl || null,
      type: s.type || null,
    }));
  } catch {
    return [];
  }
}

export function analyticsWired(projectId, hasWebApp) {
  if (!hasWebApp) return { wired: false, measurementId: null };
  try {
    const res = fb(["apps:sdkconfig", "WEB", "--project", projectId]);
    const r = res.result || res;
    const cfg =
      r.sdkConfig || (r.fileContents ? JSON.parse(r.fileContents) : r) || {};
    const mid = cfg.measurementId || null;
    return { wired: Boolean(mid), measurementId: mid };
  } catch {
    return { wired: false, measurementId: null };
  }
}

export function enrichProject(p) {
  const apps = listApps(p.projectId);
  const res = p.resources || {};
  const hasWeb = apps.some((a) => a.platform === "web");
  return {
    id: p.projectId,
    number: p.projectNumber,
    name: p.displayName || p.projectId,
    state: p.state,
    hostingSite: res.hostingSite || null,
    storageBucket: res.storageBucket || null,
    databaseUrl: res.realtimeDatabaseInstance
      ? `${res.realtimeDatabaseInstance}.firebaseio.com`
      : null,
    locationId: res.locationId || null,
    firestore: firestoreStatus(p.projectId),
    hostingSites: hostingSites(p.projectId),
    analytics: analyticsWired(p.projectId, hasWeb),
    apps,
    platforms: {
      web: apps.filter((a) => a.platform === "web").length,
      ios: apps.filter((a) => a.platform === "ios").length,
      android: apps.filter((a) => a.platform === "android").length,
    },
  };
}

export function collectSnapshot({ onProgress, generatedAt } = {}) {
  const projects = listProjects();
  const enriched = [];
  for (const p of projects) {
    const e = enrichProject(p);
    enriched.push(e);
    onProgress?.(e);
  }

  const totalApps = enriched.reduce((s, p) => s + p.apps.length, 0);
  const platformTotals = enriched.reduce(
    (acc, p) => {
      acc.web += p.platforms.web;
      acc.ios += p.platforms.ios;
      acc.android += p.platforms.android;
      return acc;
    },
    { web: 0, ios: 0, android: 0 }
  );

  return {
    generatedAt: generatedAt || new Date().toISOString(),
    account: {
      projectCount: enriched.length,
      appCount: totalApps,
      activeProjects: enriched.filter((p) => p.state === "ACTIVE").length,
      withApps: enriched.filter((p) => p.apps.length > 0).length,
      withoutApps: enriched.filter((p) => p.apps.length === 0).length,
      firestoreEnabled: enriched.filter((p) => p.firestore?.configured).length,
      analyticsWired: enriched.filter((p) => p.analytics?.wired).length,
      liveSites: enriched.reduce(
        (s, p) => s + (p.hostingSites?.length || 0),
        0
      ),
      platformTotals,
    },
    projects: enriched.sort((a, b) => b.apps.length - a.apps.length),
  };
}
