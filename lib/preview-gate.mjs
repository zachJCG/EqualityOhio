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
 * Remove with middleware.js, app/api/gate/, lib/preview-gate-paths.mjs,
 * lib/open-files.generated.mjs and public/gate.html after launch
 * (LAUNCHED = true already makes the middleware a pass-through and
 * /api/gate a 404).
 * ========================================================================== */

import { OPEN_FILES } from './open-files.generated.mjs';
import { OPEN_EXACT } from './preview-gate-paths.mjs';

export { OPEN_EXACT, OPEN_PREFIXES } from './preview-gate-paths.mjs';

export const COOKIE_NAME = 'eo_preview';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const COOKIE_VERSION = 'eo-preview-v2';

/** Reachable without the cookie: an OPEN_EXACT path or a real file under
 * one of the OPEN_PREFIXES (lib/preview-gate-paths.mjs). Case-sensitive and
 * exact on purpose: URLs are, and "/CSS/x" or "/css/missing" must not slip
 * past. */
export function isOpenPath(pathname) {
  return OPEN_EXACT.has(pathname) || OPEN_FILES.has(pathname);
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

/** Is this path the gate itself, however it is spelled? Rewrites match
 * case-insensitively and Next accepts a trailing slash and the .html file,
 * so "/GATE", "/gate/", "/gate.html" and "/%67ate" all serve the gate. */
export function isGatePath(pathname) {
  let p = String(pathname);
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep the raw spelling
  }
  p = p.toLowerCase().replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  return p === '/gate' || p === '/api/gate';
}

/**
 * The post-login destination, or '/' when the value is not a plain
 * same-origin path. Rejects backslashes and control characters before
 * parsing, because URL parsing normalizes them: "/\evil.example" and
 * "/\t/evil.example" both resolve to https://evil.example/. Then requires the
 * parsed URL to stay on `origin`, and checks the NORMALIZED path again:
 * parsing removes dot segments, so "/.//evil.example" and "/..//evil.example"
 * come out as "//evil.example", which a browser reads as another host. Never
 * bounces back into the gate (isGatePath).
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
  // A parsed http(s) pathname never holds a backslash, so a leading "//" is
  // the only way the result could leave the origin.
  if (url.pathname.startsWith('//')) return '/';
  if (isGatePath(url.pathname)) return '/';
  return url.pathname + url.search + url.hash;
}
