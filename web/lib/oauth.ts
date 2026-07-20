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

function store(token: string, expiresInSec: number) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ token, exp: Date.now() + (expiresInSec - 90) * 1000 })
    );
  } catch {}
}

// Returns a still-valid cached token, or null.
export function getStoredToken(): string | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (r && r.token && r.exp > Date.now()) return r.token;
  } catch {}
  return null;
}

export function clearToken(revokeToken?: string) {
  try {
    localStorage.removeItem(KEY);
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
