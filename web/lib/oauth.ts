// Google Identity Services (GIS) token flow — pure browser, no server.
// The user clicks "Connect", Google shows consent, and we get a short-lived
// access token. We cache it (with expiry) so a page reload within the token's
// lifetime does NOT prompt again — no logging in every time.

import { GOOGLE_CLIENT_ID, OAUTH_SCOPES } from "./firebaseConfig";

declare global {
  interface Window {
    google?: any;
  }
}

const KEY = "aerie_token_v3"; // bump when scopes change → forces fresh consent

// Identity-only token cache, kept separate from the full cloud-platform token
// above. Backend calls (tier/checkout/analyst) only need to prove "who is
// this", so they should never carry the full read/write GCP credential — see
// requestIdentityToken() below.
const IDENTITY_KEY = "aerie_id_token_v1";

let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function isConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

function store(token: string, expiresInSec: number, key: string = KEY) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ token, exp: Date.now() + (expiresInSec - 90) * 1000 })
    );
  } catch {}
}

// Returns a still-valid cached token, or null.
export function getStoredToken(key: string = KEY): string | null {
  try {
    const r = JSON.parse(localStorage.getItem(key) || "null");
    if (r && r.token && r.exp > Date.now()) return r.token;
  } catch {}
  return null;
}

export function clearToken(revokeToken?: string) {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(IDENTITY_KEY);
  } catch {}
  // Revoke so the next sign-in shows the account chooser (switch accounts).
  if (revokeToken && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(revokeToken, () => {});
    } catch {}
  }
}

export interface UserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

export async function getUserInfo(token: string): Promise<UserInfo | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as UserInfo;
  } catch {
    return null;
  }
}

// interactive=false attempts a silent grant (no popup) when the user already
// consented this session; falls back to the consent popup otherwise.
export async function requestToken(interactive = true): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("OAuth Client ID not configured yet.");
  }
  const cached = getStoredToken();
  if (cached) return cached;

  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: OAUTH_SCOPES,
      prompt: interactive ? "" : "none",
      callback: (resp: any) => {
        if (resp?.access_token) {
          store(resp.access_token, Number(resp.expires_in) || 3600);
          resolve(resp.access_token);
        } else {
          reject(new Error(resp?.error || "Authorization failed"));
        }
      },
      error_callback: (err: any) =>
        reject(new Error(err?.message || "Authorization cancelled")),
    });
    client.requestAccessToken();
  });
}

// Mints a token scoped to ONLY "openid email profile" — zero GCP API
// privilege — for handing to our own backend, which only ever needs it to
// look up a verified email (see functions/index.js verifiedEmail()). The
// full cloud-platform token must never leave the browser for that purpose:
// a compromised backend that captured it would have read/write access to
// the caller's whole Google Cloud estate, not just their identity.
//
// Uses prompt: "none" so it is always silent — the user already granted
// "openid email profile" as part of OAUTH_SCOPES when they connected, so
// Google issues this narrower token without a popup. Never throws: any
// failure (no prior grant, GIS not loaded, popup blocked, network error)
// resolves to null so callers can fall back to the full token.
//
// It must also always SETTLE, not merely never throw. If accounts.google.com
// is blocked (ad blocker, corporate proxy) or GIS never fires its callback,
// an un-raced promise hangs forever — and since fetchTier awaits this, a
// paying subscriber would sit on "free" indefinitely. The deadline below is
// what makes the fallback in backendToken() actually reachable.
// Short on purpose: this sits in front of the entitlement check, so every
// millisecond here is a millisecond a paying subscriber is still rendered as
// "free". A genuine silent grant returns in well under this.
const IDENTITY_TOKEN_TIMEOUT_MS = 1500;

// Once GIS has failed us in this page's lifetime it will almost certainly keep
// failing (blocked domain, no session), so remember it rather than paying the
// deadline again on every backend call.
let identityUnavailable = false;

export async function requestIdentityToken(): Promise<string | null> {
  if (identityUnavailable) return null;
  const deadline = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), IDENTITY_TOKEN_TIMEOUT_MS)
  );
  const token = await Promise.race([mintIdentityToken(), deadline]);
  if (!token) identityUnavailable = true;
  return token;
}

async function mintIdentityToken(): Promise<string | null> {
  try {
    if (!GOOGLE_CLIENT_ID) return null;
    const cached = getStoredToken(IDENTITY_KEY);
    if (cached) return cached;

    await loadGis();
    if (!window.google?.accounts?.oauth2) return null;

    return await new Promise<string | null>((resolve) => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "openid email profile",
          prompt: "none",
          callback: (resp: any) => {
            if (resp?.access_token) {
              store(resp.access_token, Number(resp.expires_in) || 3600, IDENTITY_KEY);
              resolve(resp.access_token);
            } else {
              resolve(null);
            }
          },
          error_callback: () => resolve(null),
        });
        client.requestAccessToken();
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

// Shared fallback logic for the three backend call sites (tier/checkout/
// analyst): prefer the identity-only token, but never let its absence break
// a paying subscriber's access. If requestIdentityToken() can't produce a
// narrow token for any reason, falling back to the existing full-privilege
// token reproduces exactly today's behaviour — worse than the scope
// overreach this narrows, but never a regression that silently downgrades a
// subscriber to "free".
export async function backendToken(fullToken: string): Promise<string> {
  const idToken = await requestIdentityToken();
  return idToken || fullToken;
}
