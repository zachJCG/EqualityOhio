/**
 * playwright.config.mjs
 * ---------------------
 * End-to-end suite (tests/e2e): accessibility (axe), routes and redirects,
 * and the behavior contract, against a PRODUCTION build.
 *
 *   npm run build && npm run test:e2e        local: starts `next start` on 3100
 *   npm run lint:a11y                        axe only
 *   PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app npm run test:e2e
 *                                            a deployed preview; no local server
 *
 * Environment:
 *   PLAYWRIGHT_BASE_URL     test a running deployment instead of starting one
 *   PLAYWRIGHT_PORT         local port (default 3100)
 *   STAGING_PASSWORD        the preview gate password (default EO2026, the
 *                           same fallback lib/preview-gate.mjs uses)
 *   PLAYWRIGHT_CHROMIUM_PATH  a local Chromium; defaults to the preinstalled
 *                           /opt/pw-browsers/chromium when present (never run
 *                           `playwright install` in that environment). In CI
 *                           neither exists and Playwright's own browser runs.
 *   VERCEL_AUTOMATION_BYPASS_SECRET  sent as x-vercel-protection-bypass when
 *                           Vercel Deployment Protection guards the preview
 *
 * The global setup logs in through the gate once (POST /api/gate) and saves
 * the cookie to tests/e2e/.auth/preview.json; every test starts signed in.
 * Gate tests opt out with an empty storage state.
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE, bypassHeaders } from './tests/e2e/support/env.mjs';

const PORT = Number(process.env.PLAYWRIGHT_PORT || 3100);
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/+$/, '') || undefined;
const baseURL = externalBaseURL ?? `http://localhost:${PORT}`;
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH?.trim() || '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  globalSetup: './tests/e2e/global-setup.mjs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    storageState: STORAGE_STATE,
    extraHTTPHeaders: bypassHeaders(),
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: existsSync(chromiumPath) ? chromiumPath : undefined,
        },
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: `${baseURL}/robots.txt`,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
