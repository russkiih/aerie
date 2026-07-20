// Client-side export of the loaded estate — nothing leaves the browser except
// the file the user chooses to save. Pure builders (snapshot / CSV) are kept
// separate from the DOM download so they're easy to test.

import type { LiveProject } from "./live";

// Structured JSON snapshot of the whole estate.
export function buildSnapshot(projects: LiveProject[], generatedAt: string) {
  return {
    generatedAt,
    projectCount: projects.length,
    totals: {
      users: projects.reduce((s, p) => s + (p.userCount || 0), 0),
      documents: projects.reduce(
        (s, p) => s + (p.firestore?.totalDocuments || 0),
        0
      ),
      apps: projects.reduce((s, p) => s + p.apps.length, 0),
      activeUsers28d: projects.reduce(
        (s, p) => s + (p.traffic?.totals.activeUsers || 0),
        0
      ),
      events28d: projects.reduce(
        (s, p) => s + (p.traffic?.totals.events || 0),
        0
      ),
    },
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      users: p.userCount,
      documents: p.firestore?.totalDocuments ?? null,
      apps: { total: p.apps.length, ...p.platforms },
      traffic28d: p.traffic
        ? {
            activeUsers: p.traffic.totals.activeUsers,
            newUsers: p.traffic.totals.newUsers,
            events: p.traffic.totals.events,
            views: p.traffic.totals.views,
          }
        : null,
    })),
  };
}

const CSV_COLUMNS: { header: string; value: (p: LiveProject) => string | number }[] = [
  { header: "Project", value: (p) => p.name },
  { header: "ID", value: (p) => p.id },
  { header: "Users", value: (p) => p.userCount ?? "" },
  { header: "Documents", value: (p) => p.firestore?.totalDocuments ?? "" },
  { header: "Apps", value: (p) => p.apps.length },
  { header: "Web", value: (p) => p.platforms.web },
  { header: "iOS", value: (p) => p.platforms.ios },
  { header: "Android", value: (p) => p.platforms.android },
  { header: "Active (28d)", value: (p) => p.traffic?.totals.activeUsers ?? "" },
  { header: "New users (28d)", value: (p) => p.traffic?.totals.newUsers ?? "" },
  { header: "Events (28d)", value: (p) => p.traffic?.totals.events ?? "" },
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per project. Sorted by users desc so the CSV reads like the overview.
export function buildCsv(projects: LiveProject[]): string {
  const rows = [...projects].sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
  const lines = [
    CSV_COLUMNS.map((c) => c.header).join(","),
    ...rows.map((p) => CSV_COLUMNS.map((c) => csvCell(c.value(p))).join(",")),
  ];
  return lines.join("\n");
}

// Trigger a browser download of an in-memory string. No-op outside the browser.
export function downloadFile(filename: string, mime: string, content: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
