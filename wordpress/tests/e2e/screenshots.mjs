/* Screenshots of every page at 390 and 1280, WordPress beside the source
   (the Next.js public/ folder served statically, EO_SOURCE_BASE), into
   docs/screenshots/. Logged out.

     node tests/e2e/screenshots.mjs [slug...]
*/
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { browser, registry, root, BASE } from './support.mjs';

const SRC = (process.env.EO_SOURCE_BASE || 'http://127.0.0.1:8090').replace(/\/$/, '');
const only = process.argv.slice(2);
const out = join(root, 'docs', 'screenshots');
mkdirSync(out, { recursive: true });
const b = await browser();
for (const width of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width, height: width === 390 ? 844 : 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const rec of registry) {
    if (only.length && !only.includes(rec.slug)) continue;
    const name = rec.path === '/' ? 'home' : rec.path.slice(1, -1).replace(/\//g, '--');
    await page.goto(`${BASE}${rec.path}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(out, `${name}-${width}-wp.png`), fullPage: true });
    if (SRC) {
      const srcPath = rec.path === '/' ? '/index.html' : rec.path.slice(0, -1) + '.html';
      await page.goto(`${SRC}${srcPath}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(out, `${name}-${width}-source.png`), fullPage: true });
    }
  }
  await ctx.close();
}
await b.close();
console.log(`screenshots in ${out}`);
