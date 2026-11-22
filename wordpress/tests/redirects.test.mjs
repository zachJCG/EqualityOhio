/* Every row of source/redirects/legacy-url-map.csv against the running site
   (HANDOFF.md Phase 3 checks): 25 paths answer 200 in place, 528 reach their
   landing page in exactly one hop with the listed code. No chains, no loops.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const BASE = (process.env.EO_BASE || 'http://localhost:8080').replace(/\/$/, '');

function csv(text) {
  const [head, ...rows] = text.trim().split('\n');
  const cols = head.split(',');
  return rows.map((r) => {
    const cells = []; let cur = ''; let q = false;
    for (const ch of r) {
      if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}
const rows = csv(readFileSync(join(root, 'source/redirects/legacy-url-map.csv'), 'utf8'));

test('legacy map columns', () => {
  assert.ok(rows.length >= 553, `${rows.length} rows`);
  assert.ok('live_path' in rows[0] && 'on_the_new_site' in rows[0] && 'lands_on' in rows[0], Object.keys(rows[0]).join());
});

test('all live paths resolve as listed, in one hop', async () => {
  const problems = [];
  let keeps = 0; let redirects = 0;
  const limit = 6; let i = 0;
  async function worker() {
    while (i < rows.length) {
      const row = rows[i++];
      const path = row.live_path;
      const res = await fetch(BASE + path, { redirect: 'manual', method: 'GET' });
      await res.arrayBuffer(); // drain, or undici trips on paused sockets
      if (row.on_the_new_site === 'keeps its path') {
        keeps++;
        if (res.status !== 200) problems.push(`${path}: expected 200, got ${res.status}`);
      } else {
        redirects++;
        const loc = res.headers.get('location') || '';
        const want = BASE + row.lands_on;
        const code = Number(row.http_code || row.code);
        if (res.status !== code) problems.push(`${path}: expected ${code}, got ${res.status} → ${loc}`);
        else if (loc !== want) problems.push(`${path}: lands on ${loc}, expected ${want}`);
        else {
          const dest = new URL(loc);
          const r2 = await fetch(dest.origin + dest.pathname, { redirect: 'manual' });
          await r2.arrayBuffer();
          if (r2.status !== 200) problems.push(`${path}: landing ${dest.pathname} answered ${r2.status} (chain)`);
        }
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  console.log(`keeps: ${keeps}, redirects: ${redirects}, problems: ${problems.length}`);
  assert.deepEqual(problems.slice(0, 40), []);
});
