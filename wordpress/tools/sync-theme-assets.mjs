#!/usr/bin/env node
/**
 * Keeps the theme's copies of the Next.js site's design files in step with
 * the source: the repository this folder lives in, or --source <dir>.
 *
 *   public/css/eo-brand-tokens.css  -> assets/css/eo-brand-tokens.css  verbatim
 *   public/css/eo-site.css          -> assets/css/eo-site.css          texture urls made relative
 *   public/js/eo-site-template.js   -> assets/js/eo-site.js            the "WP:" edits below
 *   public/assets/textures/*.svg    -> assets/textures/                verbatim
 *
 *   node tools/sync-theme-assets.mjs [--source <repo>] [--check]
 *
 * Everything WordPress needs on top of eo-site.css goes in eo-wp.css, never
 * into the copy. --check exits 1 when a copy differs from what the source
 * would produce; without a source checkout (this folder moved to its own
 * repository) it reports "skipped" and passes.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const i = args.indexOf('--source');
const SOURCE = resolve(i === -1 ? join(root, '..') : args[i + 1]);
const THEME = join(root, 'themes/equality-ohio/assets');

if (!existsSync(join(SOURCE, 'public/css/eo-site.css'))) {
  console.log(`skipped: no Next.js source at ${SOURCE}`);
  process.exit(0);
}

/* The behaviors script runs unchanged apart from these edits, each marked
   "WP:" in the output. Every `from` must occur exactly once in the source;
   if the source moved on around one, update it here rather than editing the
   copy. */
const JS_EDITS = [
  {
    name: 'header comment',
    from: `   The header, footer, preview ribbon and phone help bar are not injected
   here: they are prerendered into every page by scripts/build-pages.mjs from
   lib/chrome.mjs (and server-rendered on the 404), so they exist without
   JavaScript. This file only wires behavior onto that markup. The static
   pages are served with script-src 'self', so everything a page does lives
   in /js/ files like this one, never inline.
`,
    to: `   WordPress port of eo-site-template.js (Next.js build). The header, footer,
   preview ribbon and phone help bar are rendered by the theme's PHP
   (inc/chrome.php) from menus and site data, so they exist without
   JavaScript. This file only wires behavior onto that markup. Changes from
   the source are marked "WP:"; everything else is verbatim.
`,
  },
  {
    name: 'help bar: core blocks drop data-cta, so callouts carry .clinic-cta',
    from: "    var ctas = document.querySelectorAll('[data-cta]');\n",
    to: "    var ctas = document.querySelectorAll('[data-cta], .clinic-cta') /* WP: class hook too */;\n",
  },
  {
    name: 'help bar: the footer is in its own template part, not the next sibling',
    from: '      var footer = bar.nextElementSibling;\n',
    to: "      var footer = bar.nextElementSibling;\n      if (!footer || !footer.classList.contains('site-footer')) footer = document.querySelector('.site-footer'); /* WP */\n",
  },
];

function siteCss(text) {
  const out = text.replace(/url\('\/assets\/textures\//g, "url('../textures/");
  const stray = out.match(/url\(['"]?\/[^)]*\)/g);
  if (stray) throw new Error(`eo-site.css points at root paths the theme does not serve: ${stray.join(', ')}`);
  return out;
}

function siteJs(text) {
  let out = text;
  for (const edit of JS_EDITS) {
    const n = out.split(edit.from).length - 1;
    if (n !== 1) throw new Error(`eo-site-template.js: the "${edit.name}" edit matches ${n} times; update JS_EDITS in tools/sync-theme-assets.mjs`);
    out = out.replace(edit.from, edit.to);
  }
  return out;
}

const outputs = [
  ['css/eo-brand-tokens.css', readFileSync(join(SOURCE, 'public/css/eo-brand-tokens.css'), 'utf8')],
  ['css/eo-site.css', siteCss(readFileSync(join(SOURCE, 'public/css/eo-site.css'), 'utf8'))],
  ['js/eo-site.js', siteJs(readFileSync(join(SOURCE, 'public/js/eo-site-template.js'), 'utf8'))],
];
for (const f of readdirSync(join(SOURCE, 'public/assets/textures')).filter((f) => f.endsWith('.svg')).sort()) {
  outputs.push([`textures/${f}`, readFileSync(join(SOURCE, 'public/assets/textures', f), 'utf8')]);
}

const stale = [];
for (const [rel, text] of outputs) {
  const file = join(THEME, rel);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (current === text) continue;
  stale.push(rel);
  if (!CHECK) writeFileSync(file, text);
}

if (CHECK) {
  if (stale.length) {
    console.error(`theme copies out of step with ${SOURCE}: ${stale.join(', ')}. Run npm run theme:sync.`);
    process.exit(1);
  }
  console.log(`theme assets current (${outputs.length} files)`);
} else {
  console.log(`${stale.length} of ${outputs.length} theme file(s) written`);
}
