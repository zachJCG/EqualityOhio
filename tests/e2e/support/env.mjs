/**
 * tests/e2e/support/env.mjs: constants shared by playwright.config.mjs, the
 * global setup and the specs. Kept free of heavy imports so the config can
 * load it.
 *
 * The env files are loaded first, the same way `next start` loads them
 * (.env.production.local, .env.local, .env.production, .env; the shell
 * wins over every file), so a STAGING_PASSWORD set in .env.local is the
 * password both the server under test and the suite use.
 */
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
import { LAUNCHED, SITE_URL } from '../../../lib/site.mjs';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

nextEnv.loadEnvConfig(ROOT, false, { info() {}, error: console.error });

/** Where the global setup saves the signed-in gate cookie. Git-ignored. */
export const STORAGE_STATE = fileURLToPath(new URL('../.auth/preview.json', import.meta.url));

/** Same fallback as lib/preview-gate.mjs gatePassword(). */
export const GATE_PASSWORD = process.env.STAGING_PASSWORD || 'EO2026';

/** The deployment under test (PLAYWRIGHT_BASE_URL), if any. */
export const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/+$/, '') || undefined;

/** True when the suite runs against a deployment (PLAYWRIGHT_BASE_URL). */
export const EXTERNAL = Boolean(EXTERNAL_BASE_URL);

/**
 * Whether the server under test may be indexed, by the same rule as
 * lib/seo.mjs indexingAllowed() (LAUNCHED and VERCEL_ENV=production, read
 * at build time). A local `next start` is indexable only when it was built
 * with VERCEL_ENV=production in the environment, which CI never sets; a
 * deployment is indexable only when it is the production origin
 * (lib/site.mjs SITE_URL). Everything else, launched or not, must answer
 * robots.txt with Disallow: / and send X-Robots-Tag noindex.
 */
export const INDEXABLE =
  LAUNCHED &&
  (EXTERNAL
    ? new URL(EXTERNAL_BASE_URL).origin === new URL(SITE_URL).origin
    : process.env.VERCEL_ENV === 'production');

/** A context with no cookies: what a first-time visitor (or crawler) sends. */
export const UNAUTHENTICATED = { cookies: [], origins: [] };

export function bypassHeaders() {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return secret ? { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' } : undefined;
}
