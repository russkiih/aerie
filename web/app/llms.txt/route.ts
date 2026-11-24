import { COMPARISONS, POSTS, TOOLS } from "@/lib/site-nav";

// /llms.txt (https://llmstxt.org): a plain-markdown map of the site for AI search engines.
// Generated at build from the same lists the site renders, so it never goes stale.
export const dynamic = "force-static";

const SITE = "https://aerie-dashboard-app.web.app";
const line = (href: string, label: string, blurb?: string) =>
  `- [${label.replace(/[[\]]/g, "")}](${SITE}${href})${blurb ? `: ${blurb.replace(/\s+/g, " ").trim()}` : ""}`;

export function GET() {
  const body = [
    "# Aerie",
    "",
    "> Open-source Firebase dashboard: every Firebase project's users, traffic, Firestore data and costs on one page. Read-only, free for 3 projects.",
    "",
    "## Key pages",
    "",
    line("/", "Aerie: Firebase dashboard for multiple projects", "Home page: what Aerie shows and how it works."),
    line("/#pricing", "Pricing", "Plans, including the free tier for 3 projects."),
    line("/blog/", "Blog", "Notes on Firebase cost, billing and monitoring."),
    "",
    "## Free tools",
    "",
    ...TOOLS.map((t) => line(t.href, t.label, t.blurb)),
    "",
    "## Comparisons",
    "",
    ...COMPARISONS.map((c) => line(c.href, `Aerie ${c.label}`, c.blurb)),
    "",
    "## Blog",
    "",
    ...POSTS.map((p) => line(p.href, p.label, p.blurb)),
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
