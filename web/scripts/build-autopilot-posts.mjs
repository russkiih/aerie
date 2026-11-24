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

// Accept only https://blogkeeping.com/api/v1/card/... ; returns the normalized URL or undefined.
function blogkeepingCardUrl(value) {
  if (typeof value !== "string") return undefined;
  let u;
  try {
    u = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" || u.host !== "blogkeeping.com" || !u.pathname.startsWith("/api/v1/card/")) return undefined;
  return u.href;
}

// Blogkeeping writes the FAQ into the post body as a "## FAQ" (or "Frequently asked questions")
// section: each question is a bold line (or a ### heading) followed by its answer paragraphs.
// Returns plain-text { question, answer } pairs that match the visible, rendered section.
function extractFaq(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+(faqs?|frequently asked questions)\s*:?\s*$/i.test(l.trim()));
  if (start < 0) return [];
  const items = [];
  let cur = null;
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (/^#{1,2}\s/.test(line)) break;
    const heading = /^###\s+(.+)$/.exec(line);
    const bold = /^\*\*(.+?)\*\*\s*(.*)$/.exec(line);
    if (heading || (bold && (bold[2] === "" || /\?\s*$/.test(bold[1])))) {
      cur = { question: faqPlain(heading ? heading[1] : bold[1]), answer: [] };
      if (bold && bold[2]) cur.answer.push(bold[2]);
      items.push(cur);
    } else if (cur && line) {
      cur.answer.push(line);
    }
  }
  return items
    .map((i) => ({ question: i.question, answer: faqPlain(i.answer.join(" ")) }))
    .filter((i) => i.question && i.answer);
}
function faqPlain(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*(?:[-*+]|\d+\.|>)\s+/gm, "")
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}
// Blogkeeping's optional refresh date; only a real YYYY-MM-DD is kept.
function isoDate(v) {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) ? s : undefined;
}

const posts = [];
if (existsSync(srcDir)) {
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".md") && !/^readme\.md$/i.test(f)).sort()) {
    const { meta, body } = parseFrontmatter(readFileSync(join(srcDir, file), "utf8"));
    const slug = meta.slug || file.replace(/\.md$/, "");
    const words = body.split(/\s+/).filter(Boolean).length;
    const coverImage = blogkeepingCardUrl(meta.coverImage);
    const published = meta.date ?? "";
    const updated = isoDate(meta.updatedDate);
    const faq = extractFaq(body);
    posts.push({
      slug,
      href: `/blog/${slug}/`,
      label: meta.title ?? slug,
      blurb: meta.excerpt ?? meta.description ?? "",
      published,
      publishedLabel: publishedLabel(published),
      // Shown as "Updated …" and used for dateModified / sitemap lastmod when it differs.
      ...(updated && updated !== published ? { updated, updatedLabel: publishedLabel(updated) } : {}),
      readingMinutes: Math.max(1, Math.round(words / 230)),
      html: marked.parse(body, { async: false }),
      // Blogkeeping's 1200x630 title card; anything but a blogkeeping.com card URL is dropped.
      ...(coverImage ? { coverImage } : {}),
      // Visible "## FAQ" section, as plain text, for FAQPage JSON-LD.
      ...(faq.length ? { faq } : {}),
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
    .map((p) => `  <url><loc>https://aerie-dashboard-app.web.app${p.href}</loc><lastmod>${p.updated || p.published}</lastmod></url>${MARK}`)
    .join("\n");
  writeFileSync(sitemapPath, kept.replace(/<\/urlset>\s*$/, `${entries ? entries + "\n" : ""}</urlset>\n`), "utf8");
}
console.log(`autopilot posts: ${posts.length} → lib/blog-autopilot.json`);
