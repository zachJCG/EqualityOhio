/**
 * tests/e2e/global-setup.mjs
 * --------------------------
 * Signs in through the staging gate once and saves the cookie, so every
 * test starts as a reviewer who knows the preview password. Runs after the
 * webServer is up.
 *
 *   POST /api/gate  password=<STAGING_PASSWORD or EO2026>, from=/
 *   expect          303 + Set-Cookie: eo_preview=...
 *
 * Once lib/site.mjs LAUNCHED is true the gate is a pass-through, so an empty
 * storage state is saved instead.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { request } from '@playwright/test';
import { LAUNCHED } from '../../lib/site.mjs';
import { GATE_PASSWORD, STORAGE_STATE, bypassHeaders } from './support/env.mjs';

export default async function globalSetup(config) {
  const { baseURL } = config.projects[0].use;
  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  const context = await request.newContext({ baseURL, extraHTTPHeaders: bypassHeaders() });
  try {
    if (!LAUNCHED) {
      const res = await context.post('/api/gate', {
        form: { password: GATE_PASSWORD, from: '/' },
        maxRedirects: 0,
      });
      const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);
      if (res.status() !== 303 || !cookies.some((c) => c.startsWith('eo_preview='))) {
        throw new Error(
          `Gate login failed at ${baseURL}/api/gate: HTTP ${res.status()}, Set-Cookie ${JSON.stringify(cookies)}. ` +
            'Is STAGING_PASSWORD the password the server under test uses?',
        );
      }
    }
    await context.storageState({ path: STORAGE_STATE });
  } finally {
    await context.dispose();
  }
}
