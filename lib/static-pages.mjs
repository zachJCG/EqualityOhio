/* =============================================================================
 * lib/static-pages.mjs: every static page under public/, and the clean URL it
 * answers on.
 *
 *   public/index.html               -> /
 *   public/about.html               -> /about
 *   public/legal-clinic/intake.html -> /legal-clinic/intake
 *   public/<dir>/index.html         -> /<dir>
 *
 * One walk, shared by next.config.mjs (rewrites, .html redirects, the strict
 * CSP rule per page), scripts/build-pages.mjs, app/sitemap.js and the tests,
 * so the four can never disagree about which pages exist.
 * ========================================================================== */

import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = join(ROOT, 'public');

function htmlFiles(dir = PUBLIC_DIR, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) htmlFiles(full, found);
    else if (entry.endsWith('.html')) found.push(full);
  }
  return found;
}

/** '/about/history.html' for an absolute path under public/. */
export function filePathFor(abs) {
  return '/' + relative(PUBLIC_DIR, abs).split(sep).join('/');
}

/** The clean URL an absolute path under public/ answers on. */
export function cleanUrlFor(abs) {
  const path = filePathFor(abs);
  if (path === '/index.html') return '/';
  if (path.endsWith('/index.html')) return path.slice(0, -'/index.html'.length);
  return path.slice(0, -'.html'.length);
}

/**
 * Every public/**\/*.html as { file, url, abs }, sorted by URL.
 *   file  '/about/history.html'  (the path Next serves the file on)
 *   url   '/about/history'       (the clean URL visitors use)
 *   abs   absolute path on disk
 */
export function staticPages() {
  return htmlFiles()
    .map((abs) => ({ file: filePathFor(abs), url: cleanUrlFor(abs), abs }))
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}
