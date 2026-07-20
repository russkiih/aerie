// Landing-page screenshot generator.
//
// Serves web/out on a local port, drives it in headless Chromium with a
// mocked 6-project Firebase estate (same route-interception approach as
// verify-live.mjs), and captures polished marketing shots into
// web/public/shots/ (committed — they render on the landing page and README).
//
// Usage (from scripts/, after `cd ../web && npm run build`):
//   node lp-shots.mjs
import { chromium } from "playwright-core";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  for (const dir of fs.readdirSync(root).sort().reverse()) {
    if (!dir.startsWith("chromium-")) continue;
    const exe = path.join(root, dir, "chrome-win", "chrome.exe");
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error("No Chromium found — set CHROME_PATH.");
}

// ── tiny static server for web/out ──────────────────────────────────────────
const OUT = path.resolve(import.meta.dirname, "..", "web", "out");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain", ".json": "application/json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const candidates = url.endsWith("/")
    ? [url + "index.html"]
    : [url, url + "/index.html", url + ".html"];
  for (const c of candidates) {
    const f = path.join(OUT, c);
    if (f.startsWith(OUT) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
      return res.end(fs.readFileSync(f));
    }
  }
  res.writeHead(404).end("not found");
});
await new Promise((r) => server.listen(4179, r));

// ── mock estate: six projects with distinct shapes ──────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gen(seed, base, len, growth) {
  const r = rng(seed);
  const wk = [0.72, 1, 1.03, 1.05, 1.04, 0.96, 0.7];
  const out = [];
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    out.push(Math.max(1, Math.round(base * (1 + (growth - 1) * t) * wk[i % 7] * (0.82 + r() * 0.36))));
  }
  return out;
}
const LEN = 180;
const ymd = (d) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
const dates = [];
for (let i = LEN - 1; i >= 0; i--) dates.push(ymd(new Date(Date.now() - i * 86400000)));

const defs = [
  { id: "sitesafety-ai-prod", name: "Sitesafety AI", seed: 11, base: 1150, growth: 1.7, users: 12480, docs: 84210, platforms: ["web", "ios"], fns: 24, buckets: 3, sites: 2, rtdb: 1, online: 14 },
  { id: "bookingbolt-live", name: "Booking Bolt", seed: 23, base: 830, growth: 1.45, users: 8730, docs: 41960, platforms: ["web"], fns: 16, buckets: 2, sites: 1, rtdb: 0, online: 9 },
  { id: "linguaflow-app", name: "LinguaFlow", seed: 37, base: 560, growth: 1.9, users: 5410, docs: 22340, platforms: ["web", "ios", "android"], fns: 11, buckets: 2, sites: 1, rtdb: 1, online: 6 },
  { id: "hair-directory", name: "Hair Directory", seed: 49, base: 360, growth: 1.35, users: 3920, docs: 15680, platforms: ["web"], fns: 6, buckets: 1, sites: 1, rtdb: 0, online: 3 },
  { id: "field-ticket-app", name: "Field Ticket", seed: 61, base: 220, growth: 1.55, users: 2140, docs: 9820, platforms: ["ios", "android"], fns: 8, buckets: 1, sites: 0, rtdb: 1, online: 2 },
  { id: "puretrace-io", name: "PureTrace", seed: 73, base: 92, growth: 2.1, users: 760, docs: 3120, platforms: ["web"], fns: 3, buckets: 1, sites: 1, rtdb: 0, online: 1 },
];
const byId = {};
const byProp = {};
defs.forEach((d, ix) => {
  d.number = String(100000 + ix);
  d.prop = String(300000 + ix);
  d.series = {
    active: gen(d.seed, d.base, LEN, d.growth),
    nw: gen(d.seed + 7, d.base * 0.17, LEN, d.growth + 0.2),
    ev: gen(d.seed + 13, d.base * 7, LEN, d.growth - 0.1),
  };
  byId[d.id] = d;
  byProp[d.prop] = d;
});

const BD = {
  pagePath: [["/", 980], ["/pricing", 412], ["/blog/osha-checklist-2026", 268], ["/app/reports", 241], ["/docs/getting-started", 176], ["/blog/site-audit-template", 122]],
  sessionSource: [["google", 1240], ["(direct)", 630], ["reddit.com", 214], ["chatgpt.com", 96], ["linkedin.com", 61], ["bing", 34]],
  country: [["United States", 1495], ["United Kingdom", 340], ["Canada", 262], ["Australia", 187], ["Germany", 121]],
  deviceCategory: [["desktop", 1610], ["mobile", 902], ["tablet", 64]],
  operatingSystem: [["Windows", 880], ["iOS", 622], ["Android", 519], ["Macintosh", 431], ["Linux", 124]],
};
const EVENTS = [["page_view", 48210], ["session_start", 16044], ["report_created", 4212], ["first_visit", 3921], ["sign_up", 1108], ["subscription_started", 214]];

const INSIGHT_TEXT =
  "Insights\n- Organic search is carrying growth: google drove 1,240 of 2,576 active users (48%) this window, up against the previous period.\n- /blog/osha-checklist-2026 outperforms every product page (268 users) -- content is your cheapest acquisition channel right now.\n- Google sign-in converts best: 52% of accounts, and those users fire 2.1x more report_created events than email users.\n- 214 subscription_started events against 1,108 sign_ups is a 19% activation rate -- strong; protect the onboarding flow.\n\nActions\n- Publish two more compliance-checklist posts this month; they mirror your best-performing page.\n- Promote Google sign-in as the default auth option.\n- Instrument the step between sign_up and report_created to find the 81% drop-off.";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "*",
};
const j = (route, obj) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(obj) });

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await ctx.route(/googleapis\.com/, async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
  const url = req.url();
  let m;

  if (url.includes("/oauth2/v3/userinfo")) return j(route, { email: "russ@aerie.dev", name: "Russ" });

  if (url.startsWith("https://firebase.googleapis.com/v1beta1/projects?"))
    return j(route, { results: defs.map((d) => ({ projectId: d.id, projectNumber: d.number, displayName: d.name, state: "ACTIVE" })) });

  if ((m = url.match(/v1beta1\/projects\/([^/:?]+):searchApps/))) {
    const d = byId[m[1]];
    return j(route, { apps: (d?.platforms || []).map((p) => ({ appId: `1:${d.number}:${p}:abc`, displayName: `${d.name} ${p}`, platform: p.toUpperCase() })) });
  }

  if ((m = url.match(/v1beta1\/projects\/([^/:?]+)\/analyticsDetails/))) {
    const d = byId[m[1]];
    return d ? j(route, { analyticsProperty: { id: d.prop } }) : j(route, {});
  }

  if ((m = url.match(/identitytoolkit\.googleapis\.com\/v1\/projects\/([^/:?]+)\/accounts:query/))) {
    const d = byId[m[1]];
    const body = JSON.parse(req.postData() || "{}");
    if (!body.returnUserInfo) return j(route, { recordsCount: String(d?.users || 0) });
    const r = rng((d?.seed || 1) + 99);
    const provs = ["google.com", "password", "apple.com"];
    const weights = [0.52, 0.38, 0.1];
    const users = Array.from({ length: 400 }, (_, i) => {
      let x = r(), pi = 0, acc = 0;
      for (let k = 0; k < 3; k++) { acc += weights[k]; if (x <= acc) { pi = k; break; } }
      return {
        localId: `u${i}`,
        createdAt: String(Date.now() - Math.floor(r() * 360) * 86400000),
        emailVerified: r() > 0.4,
        providerUserInfo: [{ providerId: provs[pi] }],
      };
    });
    return j(route, { recordsCount: String(d?.users || 0), userInfo: users });
  }

  if ((m = url.match(/firestore\.googleapis\.com\/v1\/projects\/([^/]+)\/databases/))) {
    const d = byId[m[1]];
    const counts = { users: d.users, sessions: Math.round(d.users * 3.1), events: Math.round(d.docs * 0.42), reports: Math.round(d.docs * 0.16), settings: Math.round(d.users * 0.22) };
    if (url.endsWith(":listCollectionIds")) return j(route, { collectionIds: Object.keys(counts) });
    if (url.endsWith(":runAggregationQuery")) {
      const body = JSON.parse(req.postData() || "{}");
      const cid = body?.structuredAggregationQuery?.structuredQuery?.from?.[0]?.collectionId;
      return j(route, [{ result: { aggregateFields: { c: { integerValue: String(counts[cid] || 0) } } } }]);
    }
  }

  if ((m = url.match(/analyticsdata\.googleapis\.com\/v1beta\/properties\/(\d+):batchRunReports/))) {
    const body = JSON.parse(req.postData() || "{}");
    return j(route, {
      reports: (body.requests || []).map((r) => ({
        rows: (BD[r.dimensions?.[0]?.name] || []).map(([label, v]) => ({
          dimensionValues: [{ value: label }],
          metricValues: [{ value: String(v) }],
        })),
      })),
    });
  }

  if ((m = url.match(/analyticsdata\.googleapis\.com\/v1beta\/properties\/(\d+):runRealtimeReport/))) {
    const d = byProp[m[1]];
    return j(route, { rows: [{ metricValues: [{ value: String(d?.online ?? 0) }] }] });
  }

  if ((m = url.match(/analyticsdata\.googleapis\.com\/v1beta\/properties\/(\d+):runReport/))) {
    const d = byProp[m[1]];
    const body = JSON.parse(req.postData() || "{}");
    if (body.dimensions?.[0]?.name === "eventName")
      return j(route, { rows: EVENTS.map(([label, v]) => ({ dimensionValues: [{ value: label }], metricValues: [{ value: String(v) }] })) });
    return j(route, {
      rows: dates.map((date, i) => ({
        dimensionValues: [{ value: date }],
        metricValues: [
          { value: String(d.series.active[i]) },
          { value: String(d.series.nw[i]) },
          { value: String(d.series.ev[i]) },
          { value: String(Math.round(d.series.ev[i] * 0.6)) },
        ],
      })),
    });
  }

  if ((m = url.match(/cloudfunctions\.googleapis\.com\/v2\/projects\/([^/]+)\//)))
    return j(route, { functions: Array.from({ length: byId[m[1]]?.fns || 0 }, (_, i) => ({ name: `p/f/fn-${i}` })) });
  if ((m = url.match(/storage\.googleapis\.com\/storage\/v1\/b\?project=([^&]+)/)))
    return j(route, { items: Array.from({ length: byId[m[1]]?.buckets || 0 }, (_, i) => ({ name: `${m[1]}-bucket-${i}` })) });
  if ((m = url.match(/firebasehosting\.googleapis\.com\/v1beta1\/projects\/([^/]+)\/sites/)))
    return j(route, { sites: Array.from({ length: byId[m[1]]?.sites || 0 }, (_, i) => ({ siteId: `${m[1]}-${i}` })) });
  if ((m = url.match(/firebasedatabase\.googleapis\.com\/v1beta\/projects\/([^/]+)\//)))
    return j(route, { instances: Array.from({ length: byId[m[1]]?.rtdb || 0 }, (_, i) => ({ name: `p/l/i/${m[1]}-rtdb-${i}` })) });

  return j(route, {});
});

// Anthropic SSE mock for the analyst panel shot
const sseEvent = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const SSE =
  sseEvent("message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-4-8", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 900, output_tokens: 1 } } }) +
  sseEvent("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) +
  sseEvent("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: INSIGHT_TEXT } }) +
  sseEvent("content_block_stop", { type: "content_block_stop", index: 0 }) +
  sseEvent("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 200 } }) +
  sseEvent("message_stop", { type: "message_stop" });
await ctx.route(/https:\/\/api\.anthropic\.com\/.*/, async (route) => {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
  return route.fulfill({ status: 200, headers: CORS, contentType: "text/event-stream", body: SSE });
});

const SHOTS = path.resolve(import.meta.dirname, "..", "web", "public", "shots");
fs.mkdirSync(SHOTS, { recursive: true });

await page.goto("http://localhost:4179");
// Shots default to the full (Pro) product; SHOT_TIER=free previews gating.
await page.evaluate((tier) => {
  localStorage.setItem("aerie_token_v3", JSON.stringify({ token: "mock", exp: Date.now() + 3600000 }));
  localStorage.setItem("aerie_anthropic_key_v1", "sk-ant-mock");
  localStorage.setItem("aerie_tier_v1", tier);
}, process.env.SHOT_TIER || "pro");
await page.reload();
await page.waitForSelector("text=Sitesafety AI", { timeout: 20000 });
await page.waitForTimeout(1500);

// 1. overview — the hero shot
await page.screenshot({ path: path.join(SHOTS, "overview.png"), fullPage: true });

// 2. project modal with the analyst filled in
await page.locator("text=Sitesafety AI").first().click();
await page.waitForSelector("text=Breakdowns", { timeout: 20000 });
await page.getByText("Analyze this project").click();
await page.waitForSelector("text=Organic search", { timeout: 15000 });
await page.waitForTimeout(600);
// scroll the modal overlay back to the top: tiles + chart + analyst in frame
await page.locator("div.overlay-in").evaluate((el) => (el.scrollTop = 0));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOTS, "modal.png") });
// and the breakdowns grid as its own shot
await page.getByText("Breakdowns").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOTS, "breakdowns.png") });

console.log("shots written to", SHOTS);
await browser.close();
server.close();
