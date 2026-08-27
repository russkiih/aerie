// Turns content/autopilot/*.md (frontmatter + markdown, committed by the Blog Autopilot) into
// lib/blog-autopilot.json: POSTS entries plus pre-rendered HTML for app/blog/[slug]/page.tsx.
// Runs on predev/prebuild.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "content", "autopilot");
const outFile = join(root, "lib", "blog-autopilot.json");

function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      meta[listKey].push(unquote(item[1]));
      continue;
    }
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === "" || value === "[]") {
      meta[key] = [];
      listKey = key;
    } else {
      meta[key] = unquote(value);
      listKey = null;
    }
  }
  return { meta, body: m[2] };
}
const unquote = (v) => {
  const s = v.trim();
  return s.startsWith('"') && s.endsWith('"') ? JSON.parse(s) : s;
};
// Matches the hand-written posts' label style: "27 August 2026".
const publishedLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

const posts = [];
if (existsSync(srcDir)) {
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".md") && !/^readme\.md$/i.test(f)).sort()) {
    const { meta, body } = parseFrontmatter(readFileSync(join(srcDir, file), "utf8"));
    const slug = meta.slug || file.replace(/\.md$/, "");
    const words = body.split(/\s+/).filter(Boolean).length;
    posts.push({
      slug,
      href: `/blog/${slug}/`,
      label: meta.title ?? slug,
      blurb: meta.excerpt ?? meta.description ?? "",
      published: meta.date ?? "",
      publishedLabel: publishedLabel(meta.date ?? ""),
      readingMinutes: Math.max(1, Math.round(words / 230)),
      html: marked.parse(body, { async: false }),
    });
  }
}
posts.sort((a, b) => (a.published < b.published ? 1 : -1));
mkdirSync(join(root, "lib"), { recursive: true });
writeFileSync(outFile, JSON.stringify(posts, null, 2) + "\n");

// public/sitemap.xml is hand-maintained; keep the Autopilot entries in it (idempotent, marker-tagged).
const sitemapPath = join(root, "public", "sitemap.xml");
if (existsSync(sitemapPath)) {
  const MARK = "<!-- autopilot -->";
  const kept = readFileSync(sitemapPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => !l.includes(MARK))
    .join("\n");
  const entries = posts
    .map((p) => `  <url><loc>https://aerie-dashboard-app.web.app${p.href}</loc><lastmod>${p.published}</lastmod></url>${MARK}`)
    .join("\n");
  writeFileSync(sitemapPath, kept.replace(/<\/urlset>\s*$/, `${entries ? entries + "\n" : ""}</urlset>\n`), "utf8");
}
console.log(`autopilot posts: ${posts.length} → lib/blog-autopilot.json`);
