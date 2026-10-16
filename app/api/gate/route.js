/* Staging gate endpoint: checks the shared preview password and sets the
 * cookie middleware.js verifies. Remove with the rest of the gate after
 * launch; until that cleanup it is already dead once lib/site.mjs LAUNCHED
 * is true (a plain 404), so the public site never answers a login or
 * redirects anywhere from here.
 *
 *   LAUNCHED          404, nothing read, no cookie
 *   POST form fields `password`, `from`
 *     success           303 to the same-origin `from` (else /), Set-Cookie
 *     wrong password    303 /gate?error=1 (keeps a safe `from`)
 *     too many failures 303 /gate?error=rate: 10 failed attempts per address
 *                       per 15 minutes, in memory per server instance
 *     not a form body   400
 */
import { NextResponse } from 'next/server';
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  expectedCookieValue,
  passwordMatches,
  safeFrom,
} from '../../../lib/preview-gate.mjs';
import { clientKey, createRateLimiter } from '../../../lib/rate-limit.mjs';
import { LAUNCHED } from '../../../lib/site.mjs';

export const dynamic = 'force-dynamic';

const failures = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

const noStore = (res) => {
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
};

const notFound = () =>
  noStore(new NextResponse('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  }));

export async function POST(request) {
  if (LAUNCHED) return notFound();

  let form;
  try {
    form = await request.formData();
  } catch {
    return noStore(new NextResponse('Bad request: expected a form submission.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }));
  }

  const origin = new URL(request.url).origin;
  const rawFrom = form.get('from');
  const from = safeFrom(typeof rawFrom === 'string' ? rawFrom : '/', origin);
  const key = clientKey(request.headers);

  const backToGate = (error) => {
    const url = new URL('/gate', origin);
    url.searchParams.set('error', error);
    if (from !== '/') url.searchParams.set('from', from);
    return noStore(NextResponse.redirect(url, 303));
  };

  // Checked before the password, so a correct guess after the limit is
  // refused too; otherwise the limit would not slow guessing at all.
  if (failures.limited(key)) return backToGate('rate');

  const password = form.get('password');
  if (!(await passwordMatches(typeof password === 'string' ? password : null))) {
    failures.hit(key);
    return backToGate('1');
  }

  const res = NextResponse.redirect(new URL(from, origin), 303);
  res.cookies.set(COOKIE_NAME, await expectedCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https:'),
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return noStore(res);
}
