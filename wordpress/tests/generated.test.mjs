/* Generated files are current: theme.json from the tokens, the 29 page files
   and registry from source/content, the patterns from the page files, and
   the theme's copies of the Next.js design files (tokens, eo-site.css, the
   behaviors script, textures). Runs without a WordPress. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const run = (script) => execFileSync(process.execPath, [join(root, 'tools', script), '--check'], { cwd: root, encoding: 'utf8' });

test('theme.json is generated from the tokens', () => { assert.match(run('build-theme-json.mjs'), /current/); });
test('page files and registry are generated from source/content', () => { assert.match(run('html-to-blocks.mjs'), /current/); });
test('patterns are generated from the page files', () => { assert.match(run('build-patterns.mjs'), /patterns/); });
test('theme copies of the source design files are current', () => { assert.match(run('sync-theme-assets.mjs'), /current|skipped/); });

test('no color literal outside the tokens file', () => {
  const css = join(root, 'themes/equality-ohio/assets/css');
  for (const f of readdirSync(css)) {
    if (f === 'eo-brand-tokens.css') continue;
    const text = readFileSync(join(css, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, `${f} holds a color literal`);
  }
  for (const f of readdirSync(join(root, 'plugins/eo-site/content/pages'))) {
    const text = readFileSync(join(root, 'plugins/eo-site/content/pages', f), 'utf8');
    assert.doesNotMatch(text, /style="[^"]*(#[0-9a-fA-F]{3,8}|rgba?\()/, `${f} inline color`);
  }
});

test('no inline script or on* handler in page content', () => {
  for (const f of readdirSync(join(root, 'plugins/eo-site/content/pages'))) {
    const text = readFileSync(join(root, 'plugins/eo-site/content/pages', f), 'utf8');
    assert.doesNotMatch(text, /<script\b(?![^>]*application\/ld\+json)/i, `${f} has a script`);
    assert.doesNotMatch(text, /\son[a-z]+="/i, `${f} has an on* handler`);
    assert.doesNotMatch(text, /href="\/[^"#?]*[^\/"]"/, `${f} has an internal link without a trailing slash`);
    assert.doesNotMatch(text, /href="tel:(?!\+)/, `${f} has a tel: link without +`);
    assert.doesNotMatch(text, /data-expires=/, `${f} still carries data-expires`);
  }
});
