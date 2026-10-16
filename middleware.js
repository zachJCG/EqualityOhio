/* Root middleware: staging password gate.
 *
 * While lib/site.mjs LAUNCHED is false, the whole deployment is a design
 * preview behind a shared password (EO2026 unless STAGING_PASSWORD overrides
 * it). A visitor without the cookie is redirected to /gate, posts the
 * password to /api/gate, and gets an HttpOnly cookie holding an HMAC keyed by
 * the password (lib/preview-gate.mjs), so rotating the password signs every
 * browser out at once.
 *
 * Reachable without the cookie: the open paths in lib/preview-gate.mjs (the
 * gate page and its script, the gate endpoint, robots/sitemap/manifest and
 * icons, and the css/font/brand assets the gate page and share cards use).
 *
 * Once LAUNCHED is true this is a pass-through. Delete it (with app/api/gate/,
 * lib/preview-gate.mjs and public/gate.html) in a cleanup after launch.
 */
import { NextResponse } from 'next/server';
import { COOKIE_NAME, hasValidCookie, isOpenPath } from './lib/preview-gate.mjs';
import { LAUNCHED } from './lib/site.mjs';

export async function middleware(req) {
  if (LAUNCHED) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isOpenPath(pathname)) return NextResponse.next();
  if (await hasValidCookie(req.cookies.get(COOKIE_NAME)?.value)) return NextResponse.next();

  const to = req.nextUrl.clone();
  to.pathname = '/gate';
  to.search = pathname === '/' ? '' : `?from=${encodeURIComponent(pathname + search)}`;
  const res = NextResponse.redirect(to);
  // Never let a browser or CDN cache "this URL goes to the gate".
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}

// Excludes Next internals; everything else (pages, static files, api) is gated.
export const config = {
  matcher: ['/((?!_next/).*)'],
};
