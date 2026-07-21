// Aerie end-to-end verification harness.
//
// The dashboard is OAuth-gated and reads live Google APIs, so plain page loads
// can't exercise it. This script drives the real app in headless Chromium with
// every external API mocked via Playwright route interception: Firebase / GA4 /
// Identity Toolkit (JSON), plus the AI-analyst providers (Anthropic SSE,
// OpenAI-compatible SSE, Gemini ListModels + SSE). It injects a fake OAuth
// token + analyst key into localStorage, opens a project modal, and asserts
// every feature renders (breakdowns, realtime pill, events, signups toggle,
// analyst streaming). Screenshots land in the working directory.
//
// Usage (from scripts/):
//   npm install                       # once — pulls playwright-core
//   node verify-live.mjs              # against the live site
//   TARGET_URL=http://localhost:4174 node verify-live.mjs   # against a local build
//                                     # (serve one with: cd ../web && npx serve out -l 4174)
//
// Chromium: set CHROME_PATH to a Chrome/Chromium executable, or let the script
// auto-detect a Playwright-managed install under ~/AppData/Local/ms-playwright.
import { chromium } from "playwright-core";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  try {
    for (const dir of fs.readdirSync(root).sort().reverse()) {
      if (!dir.startsWith("chromium-")) continue;
      const exe = path.join(root, dir, "chrome-win", "chrome.exe");
      if (fs.existsSync(exe)) return exe;
    }
  } catch {}
  throw new Error(
    "No Chromium found — set CHROME_PATH or install one via `npx playwright install chromium`."
  );
}
const EXE = findChrome();

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

const d = {
  id: "takeoffconvert-prod", name: "TakeoffConvert", number: "100001", prop: "300001",
  users: 830, docs: 12400, platforms: ["web"], fns: 6, buckets: 1, sites: 1, rtdb: 0,
  series: { active: gen(11, 14, LEN, 1.7), nw: gen(18, 4, LEN, 1.9), ev: gen(24, 90, LEN, 1.6) },
};

// ranked breakdown rows per dimension, mirroring the Vercel panels
const BD = {
  pagePath: [["/reddit/ai-proposal-generator-for-construction", 30], ["/app/estimate", 19], ["/", 16], ["/app/history", 14], ["/app/build-template", 11], ["/tools/profit-margin-calculator", 11]],
  sessionSource: [["google", 45], ["(direct)", 21], ["checkout.stripe.com", 2], ["bing", 1], ["chatgpt.com", 1]],
  country: [["United States", 34], ["China", 13], ["Singapore", 9], ["United Kingdom", 3], ["Australia", 1]],
  deviceCategory: [["desktop", 42], ["mobile", 21]],
  operatingSystem: [["Linux", 21], ["Windows", 19], ["Android", 14], ["iOS", 6], ["Macintosh", 2]],
};

const TARGET = process.env.TARGET_URL || "https://aerie-dashboard-app.web.app";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,x-goog-user-project",
};
const j = (route, obj) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(obj) });

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();

await ctx.route(/googleapis\.com/, async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
  const url = req.url();
  let m;

  if (url.includes("/oauth2/v3/userinfo")) return j(route, { email: "russ@aerie.dev", name: "Russ" });

  if (url.startsWith("https://firebase.googleapis.com/v1beta1/projects?"))
    return j(route, { results: [{ projectId: d.id, projectNumber: d.number, displayName: d.name, state: "ACTIVE" }] });

  if (url.includes(":searchApps"))
    return j(route, { apps: d.platforms.map((p) => ({ appId: `1:${d.number}:${p}:abc`, displayName: `${d.name} ${p}`, platform: p.toUpperCase() })) });

  if (url.includes("/analyticsDetails")) return j(route, { analyticsProperty: { id: d.prop } });

  if (url.includes("identitytoolkit")) {
    const body = JSON.parse(req.postData() || "{}");
    if (!body.returnUserInfo) return j(route, { recordsCount: String(d.users) });
    const users = Array.from({ length: 120 }, (_, i) => ({
      localId: `u${i}`,
      createdAt: String(Date.now() - (i % 300) * 86400000),
      emailVerified: i % 2 === 0,
      providerUserInfo: [{ providerId: i % 3 === 0 ? "password" : "google.com" }],
    }));
    return j(route, { recordsCount: String(d.users), userInfo: users });
  }

  if (url.endsWith(":listCollectionIds")) return j(route, { collectionIds: ["users", "estimates", "templates"] });
  if (url.endsWith(":runAggregationQuery")) {
    const body = JSON.parse(req.postData() || "{}");
    const cid = body?.structuredAggregationQuery?.structuredQuery?.from?.[0]?.collectionId;
    const n = { users: 830, estimates: 9800, templates: 1770 }[cid] || 0;
    return j(route, [{ result: { aggregateFields: { c: { integerValue: String(n) } } } }]);
  }

  if (url.includes(":batchRunReports")) {
    const body = JSON.parse(req.postData() || "{}");
    const reports = (body.requests || []).map((r) => {
      const dim = r.dimensions?.[0]?.name;
      const rows = (BD[dim] || []).map(([label, v]) => ({
        dimensionValues: [{ value: label }],
        metricValues: [{ value: String(v) }],
      }));
      return { rows };
    });
    return j(route, { reports });
  }

  if (url.includes(":runRealtimeReport"))
    return j(route, {
      rows: [{ metricValues: [{ value: "7" }] }],
    });

  if (url.includes(":runReport")) {
    const body = JSON.parse(req.postData() || "{}");
    if (body.dimensions?.[0]?.name === "eventName") {
      const events = [["page_view", 526], ["session_start", 180], ["first_visit", 51], ["estimate_created", 34], ["sign_up", 12], ["purchase", 3]];
      return j(route, {
        rows: events.map(([label, v]) => ({
          dimensionValues: [{ value: label }],
          metricValues: [{ value: String(v) }],
        })),
      });
    }
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

  // Billing Watchdog mocks. The Monitoring URL embeds metric types like
  // "storage.googleapis.com/…" in its filter param, so this branch must run
  // BEFORE the service-list branches below or they'd swallow the request.
  if (url.includes("monitoring.googleapis.com")) {
    const filter = decodeURIComponent(url);
    const mkPoints = (fn) =>
      Array.from({ length: 28 }, (_, i) => ({
        interval: { endTime: new Date(Date.now() - (27 - i) * 86400000).toISOString() },
        value: { int64Value: String(fn(i)) },
      }));
    let pts = [];
    // Firestore reads spike ~6.7x in the last 7 days — must trip the watchdog
    if (filter.includes("document/read_count")) pts = mkPoints((i) => (i >= 21 ? 400000 : 60000));
    else if (filter.includes("document/write_count")) pts = mkPoints(() => 9000);
    else if (filter.includes("function/execution_count")) pts = mkPoints(() => 20000);
    else if (filter.includes("sent_bytes_count")) pts = mkPoints(() => 40 * 1024 * 1024);
    else if (filter.includes("storage/total_bytes")) pts = mkPoints(() => 2 * 1024 ** 3);
    return j(route, { timeSeries: pts.length ? [{ points: pts }] : [] });
  }
  if (url.includes("cloudbilling.googleapis.com"))
    return j(route, { billingEnabled: true, billingAccountName: "billingAccounts/ABC-123" });

  if (url.includes("cloudfunctions")) return j(route, { functions: Array.from({ length: d.fns }, (_, i) => ({ name: `p/f/fn-${i}` })) });
  if (url.includes("storage.googleapis.com")) return j(route, { items: [{ name: `${d.id}-uploads` }] });
  if (url.includes("firebasehosting")) return j(route, { sites: [{ siteId: d.id }] });
  if (url.includes("firebasedatabase")) return j(route, { instances: [] });

  return j(route, {});
});

page.on("console", (msg) => { if (msg.type() === "error") console.log("PAGE ERROR:", msg.text()); });

// Mocked Anthropic API for the BYOK analyst (SSE stream)
const sseEvent = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const INSIGHT_TEXT =
  "Insights\n- Your /reddit landing page drove 30 of 79 visitors (38%)  -- the Reddit-intercept strategy is your best channel.\n- China + Singapore account for 22 visitors with zero signups  -- likely crawler noise, ignore it.\n- Email/password users produce 2x more estimate_created events than Google users.\n\nActions\n- Publish 3 more reddit-targeted landing pages this week.\n- Promote email signup on the landing page.";
const SSE =
  sseEvent("message_start", {
    type: "message_start",
    message: {
      id: "msg_1", type: "message", role: "assistant", model: "claude-opus-4-8",
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 900, output_tokens: 1 },
    },
  }) +
  sseEvent("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) +
  sseEvent("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: INSIGHT_TEXT } }) +
  sseEvent("content_block_stop", { type: "content_block_stop", index: 0 }) +
  sseEvent("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 120 } }) +
  sseEvent("message_stop", { type: "message_stop" });

const ANTHROPIC_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "*",
};
await ctx.route(/https:\/\/api\.anthropic\.com\/.*/, async (route) => {
  if (route.request().method() === "OPTIONS")
    return route.fulfill({ status: 204, headers: ANTHROPIC_CORS, body: "" });
  return route.fulfill({
    status: 200,
    headers: ANTHROPIC_CORS,
    contentType: "text/event-stream",
    body: SSE,
  });
});

// OpenAI-compatible mock (chat/completions SSE) — exercises the multi-provider path
const OPENAI_SSE =
  `data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })}\n\n` +
  `data: ${JSON.stringify({ choices: [{ delta: { content: INSIGHT_TEXT } }] })}\n\n` +
  `data: [DONE]\n\n`;
await ctx.route(/https:\/\/api\.openai\.com\/.*/, async (route) => {
  if (route.request().method() === "OPTIONS")
    return route.fulfill({ status: 204, headers: ANTHROPIC_CORS, body: "" });
  return route.fulfill({
    status: 200,
    headers: ANTHROPIC_CORS,
    contentType: "text/event-stream",
    body: OPENAI_SSE,
  });
});

// Gemini mock (streamGenerateContent SSE) — registered after the googleapis
// catch-all so it takes precedence (Playwright matches newest-first)
const GEMINI_SSE = `data: ${JSON.stringify({
  candidates: [{ content: { parts: [{ text: INSIGHT_TEXT }], role: "model" } }],
})}\n\n`;
await ctx.route(/https:\/\/generativelanguage\.googleapis\.com\/.*/, async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS")
    return route.fulfill({ status: 204, headers: ANTHROPIC_CORS, body: "" });
  // ListModels — the app resolves the usable model from this at runtime
  if (req.method() === "GET")
    return route.fulfill({
      status: 200,
      headers: ANTHROPIC_CORS,
      contentType: "application/json",
      body: JSON.stringify({
        models: [
          { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
          { name: "models/gemini-3-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-3-pro", supportedGenerationMethods: ["generateContent"] },
        ],
      }),
    });
  if (!req.url().includes("gemini-3-flash"))
    return route.fulfill({
      status: 404,
      headers: ANTHROPIC_CORS,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "model not available (mock expected gemini-3-flash)" } }),
    });
  return route.fulfill({
    status: 200,
    headers: ANTHROPIC_CORS,
    contentType: "text/event-stream",
    body: GEMINI_SSE,
  });
});

// logged-out pass: the landing page (hero, pricing, GitHub CTAs)
await page.goto(TARGET);
await page.waitForSelector("text=One dashboard for every Firebase project", { timeout: 20000 });
for (const needle of [
  "Self-host on GitHub",
  "Free forever if you self-host",
  "Simple pricing",
  "billed yearly",
  "7-day free trial",
  "$19 month-to-month",
  "Start free trial",
  "Up to 3 projects",
  "AGPL-3.0",
]) {
  const n = await page.getByText(needle).count();
  console.log(`${n > 0 ? "OK " : "MISSING"} landing: ${needle}`);
}
await page.screenshot({ path: "landing.png", fullPage: true });

await page.evaluate(() => {
  localStorage.setItem("aerie_token_v3", JSON.stringify({ token: "mock", exp: Date.now() + 3600000 }));
  localStorage.setItem("aerie_anthropic_key_v1", "AQ.Ab8-mock-key");
});
await page.reload();
await page.waitForSelector("text=TakeoffConvert", { timeout: 20000 });

// free-tier gating (cloud builds only: NEXT_PUBLIC_AERIE_CLOUD=1) — fresh
// accounts land on Free; a locked range opens the upgrade modal; unlocking
// flips to Pro and the rest of the suite runs ungated.
console.log(
  (await page.getByText("Free plan · Upgrade").count()) > 0
    ? "OK  free-plan pill shown"
    : "MISSING free-plan pill"
);
// the watchdog is Pro-only on cloud: on Free it must offer the upgrade
// instead of the scan, and must not name/price any project.
console.log(
  (await page.getByText("Scan estate").count()) === 0 &&
    (await page.getByText("Unlock with Pro").count()) > 0
    ? "OK  watchdog locked on free tier"
    : "MISSING watchdog free-tier lock"
);
await page.getByText("90d", { exact: true }).first().click();
await page.waitForSelector("text=Cloud Pro", { timeout: 10000 });
console.log("OK  locked range opens upgrade modal");
await page.getByText("Unlock Pro —").first().click();
await page.waitForTimeout(500);
console.log(
  (await page.getByText("Free plan · Upgrade").count()) === 0
    ? "OK  pro unlocked, pill gone"
    : "MISSING pro unlock"
);

// billing watchdog: on-demand estate scan (plan + meters + spike flags)
await page.getByText("Scan estate").click();
await page.waitForSelector("text=est. usage cost across the estate", { timeout: 15000 });
for (const needle of ["Billing watchdog", "Blaze · pay-as-you-go", "1 spike", "Firestore reads ×"]) {
  const n = await page.getByText(needle).count();
  console.log(`${n > 0 ? "OK " : "MISSING"} watchdog: ${needle}`);
}
await page.screenshot({ path: "watchdog.png", fullPage: true });

await page.locator("text=TakeoffConvert").first().click();
await page.waitForSelector("text=Breakdowns", { timeout: 20000 });

// AI analyst: click Analyze, wait for streamed insights, screenshot the panel
await page.getByText("Analyze this project").click();
await page.waitForSelector("text=Reddit-intercept", { timeout: 15000 });
await page.waitForTimeout(400);
const aiPanel = page
  .locator("div.modal-in > div")
  .filter({ has: page.getByText("AI analyst") })
  .last();
await aiPanel.screenshot({ path: "analyst-panel.png" });
for (const needle of ["AI analyst", "Insights", "Actions", "Analyze again", "crawler noise", "via Google Gemini"]) {
  const n = await page.getByText(needle).count();
  console.log(`${n > 0 ? "OK " : "MISSING"} ${needle}`);
}
const errCount = await page.getByText("stream ended without").count();
console.log(errCount === 0 ? "OK  no analyst error shown" : "MISSING clean finalMessage (error visible)");
await page.waitForTimeout(900);
await page.screenshot({ path: "live-modal.png", fullPage: true });

// sanity: assert every panel title + a known row is present
for (const needle of ["Pages", "Sources", "Countries", "Devices", "Operating systems", "/app/estimate", "google", "United States", "desktop", "Linux", "7 online", "Events", "page_view", "estimate_created", "Count"]) {
  const n = await page.getByText(needle).count();
  console.log(`${n > 0 ? "OK " : "MISSING"} ${needle}`);
}

// per-project billing panel inside the modal
for (const needle of ["Billing watchdog · 28d", "Function invocations", "est. usage cost · list prices"]) {
  const n = await page.getByText(needle).count();
  console.log(`${n > 0 ? "OK " : "MISSING"} modal billing: ${needle}`);
}

// scroll the fixed overlay so the Traffic sources grid is in view
await page.getByText("Breakdowns").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: "live-sources.png" });

// also flip the range to 7d and confirm it refetches without error
await page.locator("div.modal-in").getByText("7d", { exact: true }).first().click();
await page.waitForTimeout(1200);
await page.getByText("Breakdowns").first().scrollIntoViewIfNeeded();
await page.screenshot({ path: "live-sources-7d.png" });
const label = await page.getByText("Breakdowns · 7d").count();
console.log(label > 0 ? "OK  range label switched to 7d" : "MISSING 7d range label");

// chart metric toggle: Traffic <-> Signups on the same date axis
const modal = page.locator("div.modal-in");
console.log(
  (await modal.getByText("Traffic · active users").count()) > 0
    ? "OK  chart defaults to traffic"
    : "MISSING traffic chart default"
);
await modal.getByRole("button", { name: "Signups", exact: true }).click();
await page.waitForTimeout(400);
console.log(
  (await modal.getByText("Signups · new accounts").count()) > 0
    ? "OK  signups toggle switches chart"
    : "MISSING signups chart label"
);
console.log(
  (await modal.getByText("Sign-in methods · all time").count()) > 0
    ? "OK  sign-in methods tile in breakdowns grid"
    : "MISSING sign-in methods tile"
);
await modal.getByText("Signups · new accounts").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: "signups-toggle.png" });

// element screenshot of the sources section itself (scroll can't clip it)
const section = page
  .locator("div.modal-in > div")
  .filter({ has: page.getByText("Breakdowns") })
  .last();
await section.screenshot({ path: "live-sources-panels.png" });
console.log("DONE");
await browser.close();
