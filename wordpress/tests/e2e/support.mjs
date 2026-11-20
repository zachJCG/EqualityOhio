/* Shared helpers for the Playwright checks against a running WordPress. */
import { createRequire } from 'node:module';
// Playwright is preinstalled globally in the build environment; ESM does not read NODE_PATH.
const { chromium } = createRequire(import.meta.url)(process.env.EO_PLAYWRIGHT || 'playwright');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const BASE = (process.env.EO_BASE || 'http://localhost:8080').replace(/\/$/, '');
export const ADMIN_USER = process.env.EO_ADMIN_USER || 'admin';
export const ADMIN_PASS = process.env.EO_ADMIN_PASS || 'admin';
export const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, '..', '..');
export const registry = JSON.parse(readFileSync(join(root, 'plugins/eo-site/data/pages.json'), 'utf8')).pages;

export async function browser() {
  return chromium.launch();
}

export async function login(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/wp-login.php`);
  await page.fill('#user_login', ADMIN_USER);
  await page.fill('#user_pass', ADMIN_PASS);
  await page.click('#wp-submit');
  await page.waitForURL(/wp-admin/);
  return page;
}
