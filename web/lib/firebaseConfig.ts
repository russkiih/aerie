// Public Firebase web config for the Aerie app itself (aerie-dashboard-app).
// These values are NOT secret — Firebase web config is meant to ship in the
// client. The OAuth Client ID is injected separately (see lib/oauth.ts).
export const firebaseConfig = {
  projectId: "aerie-dashboard-app",
  appId: "1:122164526376:web:1e4cd00e12ecd00562641d",
  apiKey: "AIzaSyD--DaMNdGOss3OiATuaHMOW0JvOU4vns8",
  authDomain: "aerie-dashboard-app.firebaseapp.com",
  storageBucket: "aerie-dashboard-app.firebasestorage.app",
  messagingSenderId: "122164526376",
};

// OAuth Web Client ID for aerie-dashboard-app. This is a PUBLIC value (it ships
// in every OAuth client and is safe to commit) — not the client secret.
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "122164526376-12ng726h8ff7t3qcgppc03hicara154s.apps.googleusercontent.com";

// Scopes. cloud-platform is required (not read-only) because Firestore admin
// reads (listCollectionIds / aggregation count) and Identity Toolkit
// accounts:query reject the read-only variant with "insufficient scopes".
// Both are "sensitive" tier — no restricted scopes, so no CASA audit; we only
// ever issue read requests. analytics.readonly covers the GA4 Data API.
export const OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");
