/**
 * tests/art-kit.test.mjs
 * ----------------------
 * `npm run assets` (scripts/art/) reads its palette from
 * public/css/eo-brand-tokens.css when scripts/art/kit.mjs is imported, and
 * throws if a token the art draws with stops resolving. Nothing else in
 * `npm test` imports the art scripts, so without this a token edit (for
 * example turning a hex into a var() alias) could break the documented
 * regeneration step silently.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('scripts/art/kit.mjs imports and resolves every token the art uses', async () => {
  const { C } = await import('../scripts/art/kit.mjs');
  for (const key of ['purple', 'blue', 'green', 'purpleDeep', 'gold', 'bg', 'ink']) {
    assert.match(C[key] || '', /^#[0-9A-F]{3,8}$/, `C.${key}`);
  }
});

test('readTokens resolves var() aliases, chained aliases included', async () => {
  const { readTokens } = await import('../scripts/art/kit.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'eo-kit-'));
  try {
    const file = join(dir, 'tokens.css');
    writeFileSync(file, [
      ':root {',
      '  --eo-top: var(--eo-middle);',
      '  --eo-middle: var(--eo-white);',
      '  --eo-white: #ffffff;',
      '  --eo-loop-a: var(--eo-loop-b);',
      '  --eo-loop-b: var(--eo-loop-a);',
      '}',
    ].join('\n'));
    const tokens = readTokens(file);
    assert.equal(tokens.white, '#FFFFFF');
    assert.equal(tokens.middle, '#FFFFFF');
    assert.equal(tokens.top, '#FFFFFF');
    assert.equal(tokens.loopA, undefined, 'a cycle resolves to nothing rather than hanging');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
