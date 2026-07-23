// AI analyst — BYOK (bring your own key) prototype, multi-provider.
//
// The user pastes any supported provider's API key once; it lives in
// localStorage and the browser calls that provider directly (same
// nothing-stored, no-proxy model as the rest of Aerie — the key and the
// project's metrics never touch our servers). Calls bill the user's own key.
// The provider is auto-detected from the key's prefix.

import Anthropic from "@anthropic-ai/sdk";

// The billing Functions base — same host the tier/checkout calls use.
const FN = "https://us-central1-aerie-dashboard-app.cloudfunctions.net";

// Thrown when the caller has spent their monthly included analyses. The UI
// catches this specifically to reveal the bring-your-own-key overflow.
export class QuotaExhaustedError extends Error {
  constructor() {
    super("monthly-limit");
    this.name = "QuotaExhaustedError";
  }
}

const KEY = "aerie_anthropic_key_v1";

export function getAnalystKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAnalystKey(key: string) {
  geminiModelCache = null;
  try {
    localStorage.setItem(KEY, key);
  } catch {}
}

export function clearAnalystKey() {
  geminiModelCache = null;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

// ── providers ───────────────────────────────────────────────────────────────

const PROVIDERS = {
  anthropic: { label: "Anthropic", model: "claude-opus-4-8" },
  openai: { label: "OpenAI", model: "gpt-5" },
  // Gemini's model is resolved at runtime from the key's own ListModels
  // response (Google retires model IDs for new keys frequently).
  gemini: { label: "Google Gemini", model: "auto" },
  xai: { label: "xAI", model: "grok-4" },
  groq: { label: "Groq", model: "llama-3.3-70b-versatile" },
} as const;
export type ProviderId = keyof typeof PROVIDERS;

// OpenAI-compatible chat-completions endpoints.
const COMPAT_BASES: Partial<Record<ProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
  groq: "https://api.groq.com/openai/v1",
};

// Detect the provider from the key's well-known prefix. Order matters:
// sk-ant- must be checked before the generic OpenAI sk- prefix. Google has
// two formats: legacy AIza… and the newer AQ.… keys from AI Studio.
export function detectProvider(key: string): ProviderId | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("AIza") || k.startsWith("AQ.")) return "gemini";
  if (k.startsWith("xai-")) return "xai";
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

export function providerLabel(id: ProviderId): string {
  return PROVIDERS[id].label;
}

// ── prompt ──────────────────────────────────────────────────────────────────

const SYSTEM = `You are Aerie's growth analyst. Aerie is a dashboard that shows a developer live metrics for their Firebase projects. You receive a JSON snapshot of one project's real numbers: users, Firestore documents and collections, GA4 traffic (daily active users for the selected window plus the previous window for comparison), traffic sources (top pages, referral sources, countries, devices, operating systems, events), sign-in methods, signups by month, and enabled Firebase services.

Write a short, concrete analysis for the developer who owns this app:

Insights
- 3 to 5 bullets, ranked by importance. Each grounded in specific numbers from the snapshot (cite them). Call out what is working, what looks like a problem, and anything that looks like bot/crawler noise rather than real users.

Actions
- 2 to 3 bullets. Specific next moves this developer should make, derived from the insights (e.g. which page type to double down on, which acquisition channel to invest in, which sign-in method to promote, what to instrument next).

Rules: plain text only — exactly the two section headers above, bullets starting with "- ". No preamble, no closing paragraph, no markdown syntax beyond the bullets. Keep every bullet to 1-2 sentences. If a section of the snapshot is null or empty, don't speculate about it.`;

const userContent = (payload: object) =>
  `Project snapshot:\n${JSON.stringify(payload, null, 1)}`;

// ── transport ───────────────────────────────────────────────────────────────

// Read a text/event-stream response, extracting a text delta from each data
// payload with `pick`. Shared by the OpenAI-compatible and Gemini paths.
async function readSse(
  res: Response,
  pick: (json: any) => string,
  onText: (delta: string) => void
): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const piece = pick(JSON.parse(data)) || "";
        if (piece) {
          full += piece;
          onText(piece);
        }
      } catch {}
    }
  }
  return full;
}

async function httpError(res: Response): Promise<string> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    msg = body?.error?.message || body?.message || msg;
  } catch {}
  return msg;
}

async function anthropicStream(
  apiKey: string,
  payload: object,
  onText: (delta: string) => void
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });
  const stream = client.messages.stream({
    model: PROVIDERS.anthropic.model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: userContent(payload) }],
  });
  stream.on("text", onText);
  const final = await stream.finalMessage();
  return final.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
}

async function openaiCompatStream(
  provider: ProviderId,
  apiKey: string,
  payload: object,
  onText: (delta: string) => void
): Promise<string> {
  const res = await fetch(`${COMPAT_BASES[provider]}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PROVIDERS[provider].model,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent(payload) },
      ],
    }),
  });
  if (!res.ok) throw new Error(await httpError(res));
  return readSse(res, (j) => j.choices?.[0]?.delta?.content || "", onText);
}

// Resolve which Gemini model this key can actually use. Google retires model
// IDs for new keys often, so instead of hardcoding one we list the key's
// available models and pick by preference (newest flash first, then pro, then
// any text-capable gemini model). Cached per session.
let geminiModelCache: string | null = null;

async function pickGeminiModel(apiKey: string): Promise<string> {
  if (geminiModelCache) return geminiModelCache;
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=500",
    { headers: { "x-goog-api-key": apiKey } }
  );
  if (!res.ok) throw new Error(await httpError(res));
  const data = await res.json();
  const names: string[] = (data.models || [])
    .filter((m: any) =>
      (m.supportedGenerationMethods || []).includes("generateContent")
    )
    .map((m: any) => String(m.name || "").replace(/^models\//, ""));
  const prefs = [
    "gemini-3-flash",
    "gemini-3-pro",
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ];
  const textModels = names
    .filter(
      (n) =>
        n.startsWith("gemini-") &&
        !/embedding|tts|image|audio|live|veo|imagen/.test(n)
    )
    // lexicographic descending puts gemini-3-* ahead of gemini-2.5-*
    .sort()
    .reverse();
  const chosen =
    prefs.find((p) => names.includes(p)) ||
    textModels.find((n) => n.includes("flash")) ||
    textModels[0];
  if (!chosen)
    throw new Error("This Gemini key has no text model available.");
  geminiModelCache = chosen;
  return chosen;
}

async function geminiStream(
  apiKey: string,
  payload: object,
  onText: (delta: string) => void
): Promise<string> {
  const model = await pickGeminiModel(apiKey);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userContent(payload) }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(await httpError(res));
  return readSse(
    res,
    (j) =>
      (j.candidates?.[0]?.content?.parts || [])
        .map((p: any) => p.text || "")
        .join(""),
    onText
  );
}

// Stream an analysis of one project's snapshot via whichever provider the
// key belongs to. onText receives incremental text; the full text is returned.
export async function runAnalyst(
  apiKey: string,
  payload: object,
  onText: (delta: string) => void
): Promise<string> {
  const provider = detectProvider(apiKey);
  if (!provider) throw new Error("Unrecognized API key format.");
  if (provider === "anthropic") return anthropicStream(apiKey, payload, onText);
  if (provider === "gemini") return geminiStream(apiKey, payload, onText);
  return openaiCompatStream(provider, apiKey, payload, onText);
}

// Map errors to a short user-facing message.
export function analystErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError)
    return "Invalid API key — check it and try again.";
  if (e instanceof Anthropic.RateLimitError)
    return "Rate limited — wait a moment and retry.";
  if (e instanceof Anthropic.APIConnectionError)
    return "Couldn't reach the provider's API — check your connection.";
  if (e instanceof Anthropic.APIError)
    return `API error (${e.status}): ${e.message}`;
  return e instanceof Error ? e.message : "Something went wrong.";
}

// Cloud Pro analyst: the browser sends its verified Google token plus the same
// metrics snapshot the BYOK path builds, and the Function relays Gemini's
// stream. The provider key never touches the browser here.
export async function runAnalystViaCloud(
  googleToken: string,
  payload: object,
  onText: (delta: string) => void
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${FN}/analyst`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleToken, payload }),
    });
  } catch {
    // Offline, DNS, CORS — never surface the browser's raw "Failed to fetch".
    throw new Error("The analyst is unavailable right now — try again shortly.");
  }
  if (res.status === 429) throw new QuotaExhaustedError();
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    const raw = String(d.error || "");
    throw new Error(
      /token|audience|email/i.test(raw)
        ? "Session expired — reconnect your Google account and try again."
        : res.status === 403
        ? "The included AI analyst is a Cloud Pro feature."
        : "The analyst is unavailable right now — try again shortly."
    );
  }
  // Relay frames are { text } objects, terminated by [DONE].
  return readSse(res, (j) => j.text || "", onText);
}
