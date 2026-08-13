/* Staging gate endpoint: checks the shared preview password and sets the
 * cookie middleware.js verifies. Remove with the rest of the gate at launch. */
import { NextResponse } from 'next/server';

const PASSWORD = process.env.STAGING_PASSWORD || 'EO2026';
const COOKIE_NAME = 'eo_preview';
const COOKIE_SALT = 'eo-staging-v1';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Only same-site relative paths may be used as a post-login destination.
function safePath(raw) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export async function POST(request) {
  const form = await request.formData();
  const password = String(form.get('password') || '');
  const from = safePath(String(form.get('from') || '/'));
  const origin = new URL(request.url).origin;

  if (password !== PASSWORD) {
    const back = new URL('/gate', origin);
    back.searchParams.set('error', '1');
    if (from !== '/') back.searchParams.set('from', from);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(from, origin), 303);
  res.cookies.set(COOKIE_NAME, await sha256Hex(`${PASSWORD}|${COOKIE_SALT}`), {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https:'),
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
