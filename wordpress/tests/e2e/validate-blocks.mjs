/* Editor round trip: parse every generated page's block markup with the real
   block editor (wp.blocks.parse) and report any block the editor would flag
   as invalid ("unexpected or invalid content"), with the markup it expected.
   Also lists the raw HTML blocks per page.

     node tests/e2e/validate-blocks.mjs [slug...]
*/
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { browser, login, registry, root, BASE } from './support.mjs';

const only = process.argv.slice(2);
const b = await browser();
const ctx = await b.newContext();
const page = await login(ctx);
await page.goto(`${BASE}/wp-admin/post-new.php?post_type=page`);
await page.waitForFunction(() => window.wp && window.wp.blocks && window.wp.blocks.getBlockTypes().length > 50, null, { timeout: 60000 });
// Dismiss the welcome guide if it shows.
await page.evaluate(() => { try { wp.data.dispatch('core/edit-post').toggleFeature && wp.data.select('core/edit-post').isFeatureActive('welcomeGuide') && wp.data.dispatch('core/edit-post').toggleFeature('welcomeGuide'); } catch (e) {} });

let invalidTotal = 0;
const summary = [];
for (const rec of registry) {
  if (only.length && !only.includes(rec.slug) && !only.includes(rec.file)) continue;
  const markup = readFileSync(join(root, 'plugins/eo-site/content/pages', rec.file), 'utf8')
    .replace(/\{\{THEME_URI\}\}/g, `${BASE}/wp-content/themes/equality-ohio`)
    .replace(/\{\{DOC:([^}]+)\}\}/g, `${BASE}/wp-content/uploads/$1`);
  const result = await page.evaluate((markup) => {
    const blocks = wp.blocks.parse(markup);
    const out = { count: 0, invalid: [], raw: 0, names: {} };
    const walk = (list) => {
      for (const bl of list) {
        out.count++;
        out.names[bl.name] = (out.names[bl.name] || 0) + 1;
        if (bl.name === 'core/html') out.raw++;
        if (bl.name === 'core/missing' || bl.isValid === false) {
          let expected = '';
          try { expected = wp.blocks.getSaveContent(bl.name, bl.attributes, bl.innerBlocks); } catch (e) { expected = 'ERR ' + e.message; }
          out.invalid.push({ name: bl.name, original: (bl.originalContent || '').slice(0, 600), expected: expected.slice(0, 600), attrs: JSON.stringify(bl.attributes).slice(0, 400) });
        }
        if (bl.innerBlocks && bl.innerBlocks.length) walk(bl.innerBlocks);
      }
    };
    walk(blocks);
    return out;
  }, markup);
  invalidTotal += result.invalid.length;
  summary.push(`${rec.path}: ${result.count} blocks, ${result.raw} raw HTML, ${result.invalid.length} invalid`);
  for (const inv of result.invalid.slice(0, 3)) {
    console.log(`\n--- INVALID ${rec.path} ${inv.name}\nattrs:    ${inv.attrs}\noriginal: ${inv.original}\nexpected: ${inv.expected}`);
  }
}
console.log('\n' + summary.join('\n'));
console.log(`\nTotal invalid blocks: ${invalidTotal}`);
await b.close();
process.exit(invalidTotal ? 1 : 0);
