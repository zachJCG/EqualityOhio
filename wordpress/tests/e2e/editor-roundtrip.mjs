/* Editor round trip: open each page in the block editor, confirm there is no
   "unexpected or invalid content" warning, save it untouched, and compare the
   stored content before and after. Any difference means the editor rewrote
   markup on save (an attribute dropped, a span lost) and is reported.

     node tests/e2e/editor-roundtrip.mjs [slug...]
*/
import { browser, login, registry, BASE } from './support.mjs';

const only = process.argv.slice(2);
const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const page = await login(ctx);
let problems = 0;

// Map paths to post ids through the REST API (logged in).
const nonce = await page.evaluate(() => window.wpApiSettings && window.wpApiSettings.nonce);
const all = await page.evaluate(async () => {
  const r = await fetch('/wp-json/wp/v2/pages?per_page=100&context=edit&status=publish', { headers: { 'X-WP-Nonce': wpApiSettings.nonce } });
  return (await r.json()).map((p) => ({ id: p.id, link: p.link, raw: p.content.raw }));
});
const byPath = new Map(all.map((p) => [new URL(p.link).pathname, p]));
byPath.set('/', all.find((p) => new URL(p.link).pathname === '/') || byPath.get('/home/'));

for (const rec of registry) {
  if (only.length && !only.includes(rec.slug)) continue;
  const post = byPath.get(rec.path);
  if (!post) { console.log(`FAIL ${rec.path}: no page found`); problems++; continue; }
  await page.goto(`${BASE}/wp-admin/post.php?post=${post.id}&action=edit`);
  await page.waitForFunction(() => window.wp && wp.data && wp.data.select('core/block-editor').getBlocks().length > 0, null, { timeout: 60000 });
  await page.evaluate(() => { try { if (wp.data.select('core/edit-post').isFeatureActive('welcomeGuide')) wp.data.dispatch('core/edit-post').toggleFeature('welcomeGuide'); } catch (e) {} });
  const warnings = await page.evaluate(() => {
    const invalid = [];
    const walk = (list) => list.forEach((bl) => { if (bl.isValid === false || bl.name === 'core/missing') invalid.push(bl.name); if (bl.innerBlocks) walk(bl.innerBlocks); });
    walk(wp.data.select('core/block-editor').getBlocks());
    return { invalid, warningEls: document.querySelectorAll('.block-editor-warning').length };
  });
  // Save untouched: mark dirty with a no-op edit, then save.
  const result = await page.evaluate(async () => {
    const ed = wp.data.dispatch('core/editor');
    const before = wp.data.select('core/editor').getEditedPostContent();
    ed.editPost({ content: before });
    await ed.savePost();
    const r = await fetch(`/wp-json/wp/v2/pages/${wp.data.select('core/editor').getCurrentPostId()}?context=edit`, { headers: { 'X-WP-Nonce': wpApiSettings.nonce } });
    const after = (await r.json()).content.raw;
    return { serialized: before, after };
  });
  const same = result.after.trim() === post.raw.trim();
  const status = warnings.invalid.length || warnings.warningEls ? 'FAIL' : same ? 'ok ' : 'DIFF';
  if (status !== 'ok ') problems++;
  console.log(`${status} ${rec.path}: invalid=${warnings.invalid.length} warnings=${warnings.warningEls} saved-unchanged=${same}`);
  if (!same) {
    // First differing region, for the report.
    const a = post.raw, c = result.after; let i = 0; while (i < a.length && a[i] === c[i]) i++;
    console.log(`     before: …${a.slice(Math.max(0, i - 80), i + 160).replace(/\n/g, '⏎')}`);
    console.log(`     after:  …${c.slice(Math.max(0, i - 80), i + 160).replace(/\n/g, '⏎')}`);
  }
}
await b.close();
console.log(`\n${problems} problem(s)`);
process.exit(problems ? 1 : 0);
