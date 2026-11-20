/* axe-core WCAG 2.1 A/AA at 390 and 1280 on every page, the 404, the open
   phone menu, an open desktop dropdown, and the intake form after an empty
   submit. Logged out. Also checks for sideways scroll at 320 (plain and under
   WCAG 1.4.12 text spacing).

     node tests/e2e/axe.mjs [slug...]
*/
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { browser, registry, BASE } from './support.mjs';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const only = process.argv.slice(2);
const RUN = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };

const targets = registry.filter((r) => !only.length || only.includes(r.slug)).map((r) => ({ name: r.path, url: BASE + r.path }));
if (!only.length) targets.push({ name: '/404 (unknown URL)', url: BASE + '/this-page-does-not-exist/' });

const b = await browser();
let violations = 0;
const lines = [];
async function run(page, label) {
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate((RUN) => axe.run(document, RUN), RUN);
  if (res.violations.length) {
    violations += res.violations.length;
    for (const v of res.violations) lines.push(`VIOLATION ${label}: ${v.id} (${v.impact}) ${v.help} :: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  }
  return res.violations.length;
}

for (const width of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width, height: width === 390 ? 844 : 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const t of targets) {
    await page.goto(t.url, { waitUntil: 'networkidle' });
    const n = await run(page, `${t.name} @${width}`);
    lines.push(`${t.name} @${width}: ${n} violations`);
  }
  // States.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (width === 390) {
    await page.click('.nav-toggle');
    await page.waitForSelector('#site-nav.open');
    lines.push(`open phone menu @390: ${await run(page, 'open phone menu @390')} violations`);
  } else {
    await page.click('#site-nav .has-sub .sub-toggle');
    await page.waitForSelector('#site-nav .has-sub.open');
    lines.push(`open dropdown @1280: ${await run(page, 'open dropdown @1280')} violations`);
  }
  await page.goto(BASE + '/legal-clinic/intake/', { waitUntil: 'networkidle' });
  await page.click('form[data-mock] button[type="submit"]');
  await page.waitForSelector('.error-summary');
  lines.push(`intake after empty submit @${width}: ${await run(page, `intake empty submit @${width}`)} violations`);
  await ctx.close();
}

// Sideways scroll at 320, plain and with WCAG 1.4.12 text spacing.
const ctx = await b.newContext({ viewport: { width: 320, height: 640 } });
const page = await ctx.newPage();
const SPACING = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
for (const t of targets) {
  await page.goto(t.url, { waitUntil: 'networkidle' });
  const w1 = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.addStyleTag({ content: SPACING });
  const w2 = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w1 > 320 || w2 > 320) { violations++; lines.push(`VIOLATION ${t.name} @320: scrollWidth ${w1} / with text spacing ${w2}`); }
}
await ctx.close();
await b.close();
console.log(lines.join('\n'));
console.log(`\nTotal violations: ${violations}`);
process.exit(violations ? 1 : 0);
