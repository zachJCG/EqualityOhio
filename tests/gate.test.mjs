/**
 * tests/gate.test.mjs
 * -------------------
 * Unit tests for the staging gate's rules (lib/preview-gate.mjs), with no
 * server. The Playwright routes spec proves the same rules over HTTP.
 *
 *   safeFrom      the post-login destination stays a same-origin path, even
 *                 after URL parsing removes dot segments ("/.//evil.example"
 *                 parses to "//evil.example"), and never loops into the gate
 *                 however the gate is spelled
 *   isOpenPath    only the exact open paths and the real files listed in
 *                 lib/open-files.generated.mjs load without the cookie
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OPEN_FILES } from '../lib/open-files.generated.mjs';
import { OPEN_EXACT, isGatePath, isOpenPath, safeFrom } from '../lib/preview-gate.mjs';
import { openFiles } from '../scripts/build-pages.mjs';

const ORIGIN = 'https://eo-preview.vercel.app';

test('safeFrom keeps plain same-origin paths, query and hash', () => {
  for (const from of ['/', '/about', '/about/history?x=1#team', '/legal-clinic/intake?ref=email', '/gatekeeper']) {
    assert.equal(safeFrom(from, ORIGIN), from, from);
  }
  assert.equal(safeFrom('/a/../about', ORIGIN), '/about');
});

test('safeFrom sends every off-site or protocol-relative value to /', () => {
  const hostile = [
    '', 'about', 'https://evil.example/', 'javascript:alert(1)',
    '//evil.example', '///evil.example', '/\\evil.example', '/\\/evil.example', '/\t/evil.example',
    '/%5Cevil.example', '/%09/evil.example',
    // Dot segments are removed by parsing, leaving a leading "//".
    '/.//evil.example', '/..//evil.example', '/a/..//evil.example', '/%2e//evil.example',
    '/%2E//evil.example', '/%2e%2e//evil.example', '/%2e%2e/%2e%2e//evil.example/phish',
  ];
  for (const from of hostile) {
    const out = safeFrom(from, ORIGIN);
    assert.ok(!out.startsWith('//'), `${JSON.stringify(from)} gave protocol-relative ${out}`);
    assert.equal(new URL(out, ORIGIN).origin, ORIGIN, `${JSON.stringify(from)} left the origin: ${out}`);
  }
  for (const from of ['/.//evil.example', '/..//evil.example', '/%2e%2e//evil.example']) {
    assert.equal(safeFrom(from, ORIGIN), '/', from);
  }
});

test('safeFrom never bounces back into the gate, however it is spelled', () => {
  for (const from of ['/gate', '/gate/', '/GATE', '/Gate.HTML', '/gate.html', '/gate.html/', '/%67ate', '/api/gate', '/api/gate/', '/API/GATE']) {
    assert.ok(isGatePath(new URL(from, ORIGIN).pathname), `${from} is the gate`);
    assert.equal(safeFrom(from, ORIGIN), '/', from);
  }
  assert.equal(isGatePath('/gatekeeper'), false);
});

test('isOpenPath lets through exact open paths and real open files only', () => {
  for (const path of OPEN_EXACT) assert.ok(isOpenPath(path), path);
  for (const path of ['/css/eo-site.css', '/assets/og/default.png', '/assets/fonts/open-sans-latin-400-normal.woff2']) {
    assert.ok(isOpenPath(path), path);
  }
  for (const path of [
    '/css/x', '/css/', '/assets/og/x', '/assets/fonts/x.woff2', '/assets/textures/nothing.svg',
    '/css/%2E%2E%2Fjs/eo-site-template.js', '/assets/og/..%2Fimg%2Fcandidate-scorecard-2026-banner.png',
    '/CSS/eo-site.css', '/js/eo-site-template.js', '/assets/img/candidate-scorecard-2026-banner.png', '/about',
  ]) {
    assert.equal(isOpenPath(path), false, path);
  }
});

test('lib/open-files.generated.mjs matches the files on disk', () => {
  assert.deepEqual([...OPEN_FILES], openFiles(), 'run `npm run pages:build`');
});
