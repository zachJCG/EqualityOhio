#!/usr/bin/env node
/**
 * scripts/check-tokens.mjs
 * ------------------------
 * Token discipline for the design system. No network, no server.
 *
 *   npm run check:tokens     exit 1 on any problem
 *
 * 1. Color literals (#hex, rgb(), rgba(), hsl(), hsla()) live ONLY in
 *    public/css/eo-brand-tokens.css. Everything else uses var(--eo-*).
 *    Scanned: every other public/css/*.css (eo-site.css, eo-fonts.css),
 *    including colors URL-encoded inside data: URIs (%23RRGGBB), plus the
 *    <style> blocks, style="" attributes and SVG paint attributes of every
 *    page under public/. Only declaration values are scanned, so an id
 *    selector such as #faded is never mistaken for a color. Not scanned:
 *    standalone .svg/.png assets (an image cannot read CSS variables) and
 *    <meta name="theme-color"> (lib/site.mjs THEME_COLOR, mirrored because
 *    the head cannot read CSS variables either).
 *
 * 2. The stale palette never appears anywhere under public/ (css, html, js,
 *    svg): the PDF's printed hex codes #401385, #0080C0, #6ACA3E and their
 *    rgb()/rgba() spellings 64,19,133 / 0,128,192 / 106,202,62. The
 *    canonical colors are #5A3F99, #0093D0 and #9FCF67 (see the header of
 *    eo-brand-tokens.css). Matching ignores case and whitespace; mentions
 *    inside comments are not usage and are skipped (the tokens file
 *    documents the stale codes in its header on purpose).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PUBLIC_DIR, elements, parseHtml } from './check-links.mjs';

export const TOKENS_FILE = 'public/css/eo-brand-tokens.css';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Replace every match with spaces, keeping newlines so line numbers hold. */
const blank = (text, re) => text.replace(re, (m) => m.replace(/[^\n]/g, ' '));
const blankCssComments = (text) => blank(text, /\/\*[\s\S]*?\*\//g);
const blankHtmlComments = (text) => blank(text, /<!--[\s\S]*?-->/g);
const blankJsComments = (text) => blank(blank(text, /\/\*[\s\S]*?\*\//g), /(^|[^:\\'"])\/\/[^\n]*/g);

const lineAt = (text, index) => {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line += 1;
  return line;
};

const HEX_LENGTHS = new Set([3, 4, 6, 8]);

/** Color literals in one declaration value: [{ offset, literal }]. */
export function literalsInValue(value) {
  const found = [];
  for (const m of value.matchAll(/(^|[^&\w%])#([0-9a-f]{3,8})(?![0-9a-z_-])/gi)) {
    if (HEX_LENGTHS.has(m[2].length)) found.push({ offset: m.index + m[1].length, literal: `#${m[2]}` });
  }
  // URL-encoded hex inside data: URIs (fill='%23ffffff').
  for (const m of value.matchAll(/%23([0-9a-f]{3,8})(?![0-9a-z_-])/gi)) {
    if (HEX_LENGTHS.has(m[1].length)) found.push({ offset: m.index, literal: `%23${m[1]} (#${m[1]} in a data: URI)` });
  }
  for (const m of value.matchAll(/\b(rgba?|hsla?)\(\s*[^)]*\)?/gi)) {
    found.push({ offset: m.index, literal: m[0].replace(/\s+/g, ' ').slice(0, 40) });
  }
  return found.sort((a, b) => a.offset - b.offset);
}

/**
 * Color literals in a stylesheet: [{ line, literal, property }]. Splits the
 * sheet into preludes (selectors, at-rule heads: skipped) and declarations
 * (scanned from the first ":"), respecting quotes and parentheses so a ";"
 * inside url("data:...;...") does not split a declaration.
 */
export function cssColorLiterals(css, { lineOffset = 0 } = {}) {
  const text = blankCssComments(css);
  const out = [];
  let segStart = 0;
  let quote = null;
  let depth = 0;
  const flush = (end, terminator) => {
    const segment = text.slice(segStart, end);
    segStart = end + 1;
    if (terminator === '{') return; // selector or at-rule prelude
    const colon = segment.indexOf(':');
    if (colon === -1) return;
    const property = segment.slice(0, colon).trim();
    if (property.startsWith('@')) return; // @import url(...); etc.
    const valueStart = end - segment.length + colon + 1;
    for (const hit of literalsInValue(segment.slice(colon + 1))) {
      out.push({ line: lineAt(text, valueStart + hit.offset) + lineOffset, literal: hit.literal, property });
    }
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth += 1;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (c === '{' || c === '}' || c === ';')) flush(i, c);
  }
  flush(text.length, null);
  return out;
}

const SVG_PAINT_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color'];

/** Color literals in a page's <style> blocks, style="" and SVG paint attributes. */
export function htmlColorLiterals(html) {
  const doc = parseHtml(html);
  const out = [];
  for (const el of elements(doc)) {
    if (el.name === 'style') {
      const css = el.children.map((c) => c.text || '').join('');
      const openEnd = el.start + el.raw.length;
      const offset = lineAt(html, openEnd) - 1;
      for (const hit of cssColorLiterals(css, { lineOffset: offset })) out.push({ ...hit, where: '<style>' });
    }
    if (el.attrs.style) {
      for (const hit of cssColorLiterals(`x{${el.attrs.style}}`)) {
        out.push({ line: el.line + hit.line - 1, literal: hit.literal, property: hit.property, where: `style="" on <${el.name}>` });
      }
    }
    for (const attr of SVG_PAINT_ATTRS) {
      if (!(attr in el.attrs)) continue;
      for (const hit of literalsInValue(el.attrs[attr])) {
        out.push({ line: el.line, literal: hit.literal, property: attr, where: `<${el.name} ${attr}>` });
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Stale palette
 * ------------------------------------------------------------------------- */

export const STALE_PATTERNS = [
  { label: '#401385 (stale purple, use #5A3F99 / var(--eo-purple))', re: /(?:#|%23)401385(?![0-9a-f])/gi },
  { label: '#0080C0 (stale blue, use #0093D0 / var(--eo-blue))', re: /(?:#|%23)0080c0(?![0-9a-f])/gi },
  { label: '#6ACA3E (stale green, use #9FCF67 / var(--eo-green))', re: /(?:#|%23)6aca3e(?![0-9a-f])/gi },
  { label: 'rgb(a)(64,19,133) (stale purple)', re: /rgba?\(\s*64\s*,\s*19\s*,\s*133\b/gi },
  { label: 'rgb(a)(0,128,192) (stale blue)', re: /rgba?\(\s*0\s*,\s*128\s*,\s*192\b/gi },
  { label: 'rgb(a)(106,202,62) (stale green)', re: /rgba?\(\s*106\s*,\s*202\s*,\s*62\b/gi },
];

const STALE_EXTENSIONS = new Set(['.css', '.html', '.js', '.mjs', '.svg']);

/** Stale-palette hits in one file's text: [{ line, label }], comments skipped. */
export function stalePaletteHits(text, ext) {
  let scan = text;
  if (ext === '.css') scan = blankCssComments(text);
  else if (ext === '.html' || ext === '.svg') scan = blankCssComments(blankHtmlComments(text));
  else if (ext === '.js' || ext === '.mjs') scan = blankJsComments(text);
  const hits = [];
  for (const { label, re } of STALE_PATTERNS) {
    for (const m of scan.matchAll(re)) hits.push({ line: lineAt(scan, m.index), label });
  }
  const inComments = STALE_PATTERNS.reduce((n, { re }) => n + [...text.matchAll(re)].length, 0) - hits.length;
  return { hits: hits.sort((a, b) => a.line - b.line), inComments };
}

/* ---------------------------------------------------------------------------
 * Run
 * ------------------------------------------------------------------------- */

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

export function checkTokens() {
  const files = walk(PUBLIC_DIR);
  const rel = (abs) => relative(ROOT, abs).split('\\').join('/');
  const literals = [];
  const stale = [];
  let staleInComments = 0;

  for (const abs of files) {
    const file = rel(abs);
    const ext = extname(abs).toLowerCase();
    if (!STALE_EXTENSIONS.has(ext)) continue;
    const text = readFileSync(abs, 'utf8');

    if (ext === '.css' && file.startsWith('public/css/') && file !== TOKENS_FILE) {
      for (const hit of cssColorLiterals(text)) literals.push({ file, ...hit, where: hit.property });
    }
    if (ext === '.html') {
      for (const hit of htmlColorLiterals(text)) literals.push({ file, ...hit, where: `${hit.where} ${hit.property}` });
    }
    const { hits, inComments } = stalePaletteHits(text, ext);
    staleInComments += inComments;
    for (const hit of hits) stale.push({ file, ...hit });
  }
  return { literals, stale, staleInComments, fileCount: files.length };
}

function report(title, list, format) {
  const byFile = new Map();
  for (const item of list) {
    if (!byFile.has(item.file)) byFile.set(item.file, []);
    byFile.get(item.file).push(item);
  }
  console.error(`✗ ${title}: ${list.length} in ${byFile.size} file(s)`);
  for (const [file, items] of byFile) {
    console.error(`  ${file}`);
    for (const item of items) console.error(`    line ${item.line}: ${format(item)}`);
  }
}

function main() {
  const { literals, stale, staleInComments } = checkTokens();
  if (literals.length) {
    report(`color literals outside ${TOKENS_FILE} (add or reuse a token there, then var(--eo-...))`, literals, (i) => `${i.literal}  [${i.where}]`);
  } else {
    console.log(`✓ no color literals outside ${TOKENS_FILE}`);
  }
  if (stale.length) {
    report('stale palette (the PDF\'s printed codes; never use them)', stale, (i) => i.label);
  } else {
    console.log(`✓ no stale palette under public/${staleInComments ? ` (${staleInComments} mention(s) in comments ignored)` : ''}`);
  }
  if (literals.length || stale.length) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
