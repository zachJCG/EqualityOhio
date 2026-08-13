/* Root middleware: staging password gate.
 *
 * The whole deployment is a design preview until launch, so every request is
 * gated behind a shared password (EO2026 unless STAGING_PASSWORD overrides
 * it). The visitor lands on /gate, posts the password to /api/gate, and gets
 * an HttpOnly cookie holding a salted SHA-256 of the password; this
 * middleware recomputes the digest per request, so rotating the password
 * invalidates every existing cookie at once.
 *
 * What stays reachable without the cookie: the gate page itself, the gate
 * endpoint, robots.txt (which disallows everything anyway), and the css/font
 * assets the gate page is styled with. Nothing under those paths reveals page
 * content.
 *
 * REMOVE THIS FILE (and public/gate.html + app/api/gate/) at production
 * launch, together with the noindex headers in next.config.mjs.
 */
import { NextResponse } from 'next/server';

const PASSWORD = process.env.STAGING_PASSWORD || 'EO2026';
const COOKIE_NAME = 'eo_preview';
const COOKIE_SALT = 'eo-staging-v1';

const OPEN_EXACT = new Set(['/gate', '/gate.html', '/api/gate', '/robots.txt', '/favicon.ico']);
const OPEN_PREFIXES = ['/css/', '/assets/fonts/', '/assets/logo/'];

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const lower = pathname.toLowerCase();

  if (OPEN_EXACT.has(lower) || OPEN_PREFIXES.some((p) => lower.startsWith(p))) {
    return NextResponse.next();
  }

  const expected = await sha256Hex(`${PASSWORD}|${COOKIE_SALT}`);
  if (req.cookies.get(COOKIE_NAME)?.value === expected) {
    return NextResponse.next();
  }

  const to = req.nextUrl.clone();
  to.pathname = '/gate';
  to.search = pathname === '/' ? '' : `?from=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(to);
}

// Excludes Next internals; everything else (pages, static files, api) is gated.
export const config = {
  matcher: ['/((?!_next/).*)'],
};
