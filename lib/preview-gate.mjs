/* =============================================================================
 * lib/preview-gate.mjs: the staging password gate, shared by middleware.js
 * (cookie check on every request) and app/api/gate/route.js (login), so the
 * two can never disagree about the password, the cookie or the open paths.
 *
 * Runs in both the edge runtime (middleware) and Node (the route), so it uses
 * only Web Crypto and plain JS.
 *
 * The password is process.env.STAGING_PASSWORD, falling back to 'EO2026'. The
 * fallback is kept on purpose: this is a soft design-preview gate that keeps
 * the staging build out of casual view and out of search, not a security
 * boundary for anything secret (README documents it). Set STAGING_PASSWORD on
 * every Vercel environment to rotate it; rotating invalidates every cookie.
 *
 * The cookie value is HMAC-SHA256(key = password, message = COOKIE_VERSION),
 * so it cannot be computed without the password, and bumping COOKIE_VERSION
 * signs everyone out.
 *
 * Remove with middleware.js, app/api/gate/ and public/gate.html after launch
 * (LAUNCHED = true already makes the middleware a pass-through).
 * ========================================================================== */

export const COOKIE_NAME = 'eo_preview';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const COOKIE_VERSION = 'eo-preview-v2';

/* Reachable without the cookie. Nothing here reveals page content: the gate
 * page and its script, the login endpoint, crawler and browser plumbing
 * (robots, sitemap, manifest and icons are fetched without cookies), and the
 * stylesheets, fonts and brand art the gate page and share cards use. */
export const OPEN_EXACT = new Set([
  '/gate',
  '/api/gate',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/js/eo-gate.js',
]);
export const OPEN_PREFIXES = [
  '/css/',
  '/assets/fonts/',
  '/assets/logo/',
  '/assets/brand/',
  '/assets/og/',
  '/assets/textures/',
];

/** Case-sensitive on purpose: URLs are, and "/CSS/x" must not slip past. */
export function isOpenPath(pathname) {
  return OPEN_EXACT.has(pathname) || OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function gatePassword() {
  return process.env.STAGING_PASSWORD || 'EO2026';
}

const encoder = new TextEncoder();
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

async function hmacSha256(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/** Compare two byte arrays without an early exit on the first difference. */
export function constantTimeEqual(a, b) {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/* Memoized per password: the middleware checks the cookie on every gated
 * request and must not re-derive the HMAC each time. */
let memo = null;

/** The cookie value a logged-in browser carries (hex HMAC). */
export function expectedCookieValue(password = gatePassword()) {
  if (!memo || memo.password !== password) {
    memo = { password, value: hmacSha256(password, COOKIE_VERSION).then(toHex) };
  }
  return memo.value;
}

/** Does this cookie value unlock the preview? */
export async function hasValidCookie(value) {
  if (typeof value !== 'string' || value === '') return false;
  return constantTimeEqual(encoder.encode(value), encoder.encode(await expectedCookieValue()));
}

/** Constant-time password check: compares fixed-length digests, not strings. */
export async function passwordMatches(candidate, password = gatePassword()) {
  if (typeof candidate !== 'string') return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(password)]);
  return constantTimeEqual(a, b);
}

/**
 * The post-login destination, or '/' when the value is not a plain
 * same-origin path. Rejects backslashes and control characters before
 * parsing, because URL parsing normalizes them: "/\evil.example" and
 * "/\t/evil.example" both resolve to https://evil.example/. Then requires the
 * parsed URL to stay on `origin`. Never bounces back into the gate.
 */
export function safeFrom(raw, origin) {
  if (typeof raw !== 'string' || raw === '') return '/';
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return '/';
  if (raw[0] !== '/' || raw[1] === '/') return '/';
  let base;
  let url;
  try {
    base = new URL(origin);
    url = new URL(raw, base);
  } catch {
    return '/';
  }
  if (url.origin !== base.origin) return '/';
  if (url.pathname === '/gate' || url.pathname === '/api/gate') return '/';
  return url.pathname + url.search + url.hash;
}
