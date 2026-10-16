/**
 * tests/e2e/support/env.mjs: constants shared by playwright.config.mjs, the
 * global setup and the specs. Kept free of heavy imports so the config can
 * load it.
 */
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Where the global setup saves the signed-in gate cookie. Git-ignored. */
export const STORAGE_STATE = fileURLToPath(new URL('../.auth/preview.json', import.meta.url));

/** Same fallback as lib/preview-gate.mjs gatePassword(). */
export const GATE_PASSWORD = process.env.STAGING_PASSWORD || 'EO2026';

/** True when the suite runs against a deployment (PLAYWRIGHT_BASE_URL). */
export const EXTERNAL = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());

/** A context with no cookies: what a first-time visitor (or crawler) sends. */
export const UNAUTHENTICATED = { cookies: [], origins: [] };

export function bypassHeaders() {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return secret ? { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' } : undefined;
}
