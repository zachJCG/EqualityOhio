/**
 * tests/checks.test.mjs
 * ---------------------
 * `npm test` runs every static check script exactly as CI and a developer
 * would, as a child process, and requires exit code 0:
 *
 *   scripts/check-links.mjs        links, anchors, link conventions
 *   scripts/check-redirects.mjs    redirect map + live-sitemap coverage
 *   scripts/check-tokens.mjs       color literals and the stale palette
 *   scripts/build-pages.mjs --check generated regions current, registry valid
 *
 * The script's own report is the failure message, so a red test reads the
 * same as running `npm run check:<name>` by hand.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const CHECKS = [
  { name: 'check:links', args: ['scripts/check-links.mjs'] },
  { name: 'check:redirects', args: ['scripts/check-redirects.mjs'] },
  { name: 'check:tokens', args: ['scripts/check-tokens.mjs'] },
  { name: 'check:pages', args: ['scripts/build-pages.mjs', '--check'] },
];

for (const { name, args } of CHECKS) {
  test(`npm run ${name} passes`, () => {
    const run = spawnSync(process.execPath, args, {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      timeout: 120_000,
    });
    if (run.error) throw run.error;
    const output = `${run.stdout}${run.stderr}`.trim();
    assert.equal(run.status, 0, `node ${args.join(' ')} exited ${run.status}:\n${output}`);
  });
}
