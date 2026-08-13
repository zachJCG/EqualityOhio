/* Link checker for the static pages under public/.
 *
 * Verifies that every internal href/src in every .html file resolves to a
 * real destination in this repo:
 *   - clean URLs (with optional #anchor, checked against ids in the target)
 *   - real asset files (css/js/fonts)
 * and that no internal link uses a .html spelling (clean URLs only).
 *
 * Run: npm run check:links   (exit code 1 on any failure)
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');

function htmlFiles(dir = PUBLIC_DIR, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) htmlFiles(full, found);
    else if (entry.endsWith('.html')) found.push(full);
  }
  return found;
}

function cleanUrlFor(file) {
  const path = '/' + relative(PUBLIC_DIR, file).split(sep).join('/');
  if (path.endsWith('/index.html')) return path.slice(0, -'/index.html'.length) || '/';
  return path.slice(0, -'.html'.length);
}

const files = htmlFiles();
const urlToFile = new Map(files.map((f) => [cleanUrlFor(f), f]));

// Redirect sources defined in next.config.mjs that pages may legitimately
// never link to; internal links should always use the canonical URL instead.
const problems = [];

const idsIn = new Map(); // file -> Set of ids (html ids + template-injected ids)
// ids injected by js/eo-site-template.js on every page:
const TEMPLATE_IDS = new Set(['site-nav', 'main']);
function idsFor(file) {
  if (!idsIn.has(file)) {
    const html = readFileSync(file, 'utf8');
    const ids = new Set(TEMPLATE_IDS);
    for (const m of html.matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
    idsIn.set(file, ids);
  }
  return idsIn.get(file);
}

for (const file of files) {
  const rel = relative(ROOT, file);
  const html = readFileSync(file, 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(ref)) {
      // Same-page anchors: verify the id exists here.
      if (ref.startsWith('#') && ref.length > 1 && !idsFor(file).has(ref.slice(1))) {
        problems.push(`${rel}: same-page anchor ${ref} has no matching id`);
      }
      continue;
    }
    if (!ref.startsWith('/')) {
      problems.push(`${rel}: non-root-relative internal ref "${ref}"`);
      continue;
    }
    const [path, anchor] = ref.split('#');
    if (path.endsWith('.html')) {
      problems.push(`${rel}: internal link uses .html spelling "${ref}" (use the clean URL)`);
      continue;
    }
    // Asset file?
    if (existsSync(join(PUBLIC_DIR, path.slice(1))) && !path.endsWith('/')) continue;
    // Clean URL?
    const target = urlToFile.get(path === '' ? '/' : path);
    if (!target) {
      problems.push(`${rel}: broken internal link "${ref}"`);
      continue;
    }
    if (anchor && !idsFor(target).has(anchor)) {
      problems.push(`${rel}: link "${ref}" targets missing id #${anchor} in ${relative(ROOT, target)}`);
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} link problem(s):\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${files.length} pages checked, all internal links + anchors resolve.`);
