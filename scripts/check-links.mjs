#!/usr/bin/env node
/**
 * scripts/check-links.mjs
 * -----------------------
 * Link checker for the static pages under public/ (and the hrefs written into
 * the code-rendered 404 in app/ or pages/). No network, no server.
 *
 *   npm run check:links      exit 1 on any problem
 *
 * Because the header and footer are prerendered into every page
 * (scripts/build-pages.mjs from lib/chrome.mjs), their links are checked here
 * like any other link. Rules, per reference:
 *
 *   internal  root-relative only; resolves to a file under public/, a static
 *             page's clean URL (lib/static-pages.mjs) or a code route
 *             (robots, sitemap, manifest, app/**\/route.js, app/**\/page.js,
 *             pages/**);
 *             never a .html spelling and never a trailing slash; a #anchor
 *             must exist as an id in the target page
 *   same page href="#id" must exist on the page; bare href="#" (or "") fails
 *   external <a>/<area> to http(s): rel contains noopener and
 *             target="_blank"; plain http:// fails on any element
 *   tel:      tel:+1XXXXXXXXXX or tel:1XXXXXXXXXX (ten digits after the 1)
 *   mailto:   well-formed addresses, percent-encoded query (subject, body,
 *             cc, bcc)
 *   other     javascript: and protocol-relative //host fail; data: only on
 *             images
 *
 * The small HTML parser and the app-route walk are exported for the node
 * tests (tests/site-rules.test.mjs) and scripts/check-redirects.mjs.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { staticPages } from '../lib/static-pages.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = join(ROOT, 'public');
export const APP_DIR = join(ROOT, 'app');
export const PAGES_DIR = join(ROOT, 'pages');

/* ===========================================================================
 * A small, forgiving HTML parser. Enough for hand-authored pages: elements
 * with parsed attributes, parents and line numbers; comments kept as their
 * own nodes (so commented-out markup never counts); raw-text elements
 * (script, style, textarea, title) not parsed into.
 * ======================================================================== */

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
/* Elements whose open tag implicitly closes an open <p>. */
const CLOSES_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre',
  'section', 'table', 'ul',
]);

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', middot: '·', hellip: '…',
  copy: '©', reg: '®', trade: '™', rarr: '→', larr: '←', uarr: '↑', darr: '↓',
  times: '×', bull: '•', eacute: 'é', shy: '­', zwj: '‍', thinsp: ' ',
};

export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/** Attribute soup of one tag ("a href=x class='y' hidden") to an object. */
export function parseAttributes(source) {
  const attrs = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(source))) {
    const name = m[1].toLowerCase();
    if (name in attrs) continue; // first one wins, as in browsers
    const raw = m[2] ?? m[3] ?? m[4];
    attrs[name] = raw === undefined ? '' : decodeEntities(raw);
  }
  return attrs;
}

function lineIndex(html) {
  const starts = [0];
  for (let i = 0; i < html.length; i++) if (html.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/**
 * Parse a document into a tree. Nodes:
 *   element  { type: 'element', name, attrs, children, parent, start, line, raw }
 *   text     { type: 'text', text, parent }
 *   comment  { type: 'comment', text, parent, start, line }
 */
export function parseHtml(html) {
  const lineOf = lineIndex(html);
  const root = { type: 'document', name: '#document', attrs: {}, children: [], parent: null, start: 0, line: 1 };
  let cur = root;
  const TOKEN = /<!--([\s\S]*?)-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let m;

  const closeTo = (name) => {
    for (let n = cur; n && n !== root; n = n.parent) {
      if (n.name === name) {
        cur = n.parent;
        return true;
      }
    }
    return false;
  };

  while ((m = TOKEN.exec(html))) {
    if (m.index > last) cur.children.push({ type: 'text', text: html.slice(last, m.index), parent: cur });
    last = TOKEN.lastIndex;

    if (m[1] !== undefined) {
      cur.children.push({ type: 'comment', text: m[1], parent: cur, start: m.index, line: lineOf(m.index) });
      continue;
    }
    if (m[2] !== undefined) {
      closeTo(m[2].toLowerCase());
      continue;
    }
    if (m[3] === undefined) continue; // doctype, CDATA

    const name = m[3].toLowerCase();
    if (name === 'li') {
      for (let n = cur; n && n !== root && !['ul', 'ol', 'menu'].includes(n.name); n = n.parent) {
        if (n.name === 'li') { cur = n.parent; break; }
      }
    } else if (CLOSES_P.has(name) && cur.name === 'p') {
      cur = cur.parent;
    }

    const el = {
      type: 'element',
      name,
      attrs: parseAttributes(m[4]),
      children: [],
      parent: cur,
      start: m.index,
      line: lineOf(m.index),
      raw: m[0],
    };
    cur.children.push(el);

    if (VOID.has(name) || /\/\s*$/.test(m[4])) continue;
    if (RAW_TEXT.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, TOKEN.lastIndex);
      const end = close === -1 ? html.length : close;
      el.children.push({ type: 'text', text: html.slice(TOKEN.lastIndex, end), parent: el });
      const after = close === -1 ? html.length : html.indexOf('>', close) + 1;
      TOKEN.lastIndex = after;
      last = after;
      continue;
    }
    cur = el;
  }
  if (last < html.length) cur.children.push({ type: 'text', text: html.slice(last), parent: cur });
  return root;
}

/** Depth-first walk over element nodes. */
export function* elements(node) {
  for (const child of node.children || []) {
    if (child.type !== 'element') continue;
    yield child;
    yield* elements(child);
  }
}

export const findAll = (node, pred) => [...elements(node)].filter(pred);
export const find = (node, pred) => {
  for (const el of elements(node)) if (pred(el)) return el;
  return null;
};
export const hasClass = (el, cls) => (el.attrs.class || '').split(/\s+/).includes(cls);
export function closest(el, pred) {
  for (let n = el; n && n.type === 'element'; n = n.parent) if (pred(n)) return n;
  return null;
}
/** Visible text (entities decoded, whitespace collapsed), comments excluded. */
export function textOf(node) {
  if (node.type === 'text') return node.text;
  if (node.type === 'comment') return '';
  if (node.type === 'element' && (node.name === 'script' || node.name === 'style')) return '';
  return (node.children || []).map(textOf).join('');
}
export const cleanText = (node) => decodeEntities(textOf(node)).replace(/\s+/g, ' ').trim();

/** Every id attribute in the parsed markup (comments do not count). */
export function idsOf(doc) {
  const ids = new Set();
  for (const el of elements(doc)) if (el.attrs.id) ids.add(el.attrs.id);
  return ids;
}

/* ===========================================================================
 * App Router routes (the URLs Next serves that are not files in public/).
 * ======================================================================== */

const METADATA_ROUTES = {
  robots: '/robots.txt',
  sitemap: '/sitemap.xml',
  manifest: '/manifest.webmanifest',
};

/**
 * Static URLs Next serves from code rather than public/:
 *   app/**\/page.js and route.js (route groups stripped, _private folders and
 *   dynamic [segments] skipped) plus the root metadata routes (robots,
 *   sitemap, manifest); and pages/**\/*.js (index -> its folder; _app,
 *   _document, _error, 404 and 500 are not routes). Dynamic catch-alls never
 *   count: they cannot prove a URL exists.
 */
export function appRoutes({ appDir = APP_DIR, pagesDir = PAGES_DIR } = {}) {
  const urls = new Set();
  const CODE = /\.(m?jsx?|tsx?|mdx)$/;
  const walk = (abs, segments, onFile) => {
    for (const entry of readdirSync(abs)) {
      const full = join(abs, entry);
      if (statSync(full).isDirectory()) {
        if (entry.startsWith('_') || entry.startsWith('[')) continue;
        walk(full, /^\(.*\)$/.test(entry) ? segments : [...segments, entry], onFile);
      } else if (CODE.test(entry)) {
        onFile(entry.replace(CODE, ''), segments);
      }
    }
  };
  if (existsSync(appDir)) {
    walk(appDir, [], (base, segments) => {
      if (base === 'page' || base === 'route') urls.add('/' + segments.join('/'));
      else if (segments.length === 0 && METADATA_ROUTES[base]) urls.add(METADATA_ROUTES[base]);
    });
  }
  if (existsSync(pagesDir)) {
    walk(pagesDir, [], (base, segments) => {
      if (base.startsWith('_') || base.startsWith('[') || base === '404' || base === '500') return;
      urls.add('/' + [...segments, ...(base === 'index' ? [] : [base])].join('/'));
    });
  }
  return urls;
}

/* ===========================================================================
 * Link rules
 * ======================================================================== */

/* Elements and the attributes that carry a URL. */
const URL_ATTRS = {
  a: ['href'], area: ['href'], link: ['href'], img: ['src', 'srcset'], source: ['src', 'srcset'],
  script: ['src'], iframe: ['src'], video: ['src', 'poster'], audio: ['src'], track: ['src'],
  embed: ['src'], object: ['data'], form: ['action'], use: ['href', 'xlink:href'], image: ['href', 'xlink:href'],
};

const TEL_RE = /^tel:\+?1\d{10}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const MAILTO_KEYS = new Set(['subject', 'body', 'cc', 'bcc']);

export function mailtoProblem(href) {
  if (/\s/.test(href)) return 'contains whitespace (percent-encode it)';
  const [addresses, query = ''] = href.slice('mailto:'.length).split(/\?(.*)/s);
  let decoded;
  try {
    decoded = decodeURIComponent(addresses);
  } catch {
    return 'address is not valid percent-encoding';
  }
  const list = decoded.split(',').map((a) => a.trim());
  if (!list.length || list.some((a) => !EMAIL_RE.test(a))) return `malformed address "${decoded}"`;
  if (query) {
    for (const pair of query.split('&')) {
      const [key, value = ''] = pair.split('=');
      if (!MAILTO_KEYS.has(key.toLowerCase())) return `unknown mailto parameter "${key}"`;
      try {
        decodeURIComponent(value);
      } catch {
        return `parameter "${key}" is not valid percent-encoding`;
      }
    }
  }
  return null;
}

/**
 * Build the resolver: which internal paths exist, and which ids each page
 * carries (parsed lazily).
 */
export function createResolver({ pages = staticPages(), routes = appRoutes() } = {}) {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const idCache = new Map();
  const idsForPage = (page) => {
    if (!idCache.has(page.abs)) idCache.set(page.abs, idsOf(parseHtml(readFileSync(page.abs, 'utf8'))));
    return idCache.get(page.abs);
  };
  const isFile = (path) => {
    let decoded;
    try {
      decoded = decodeURI(path);
    } catch {
      return false;
    }
    const abs = join(PUBLIC_DIR, decoded.replace(/^\/+/, ''));
    if (!abs.startsWith(PUBLIC_DIR) || !existsSync(abs)) return false;
    return statSync(abs).isFile();
  };
  /** { kind: 'file'|'page'|'route', page? } or null. */
  const resolve = (path) => {
    if (byUrl.has(path)) return { kind: 'page', page: byUrl.get(path) };
    if (routes.has(path)) return { kind: 'route' };
    if (path !== '/' && !path.endsWith('/') && isFile(path)) return { kind: 'file' };
    return null;
  };
  return { resolve, idsForPage, pages: byUrl, routes };
}

/** Split "/a/b?x=1#frag" into { path, query, hash } (hash without '#'). */
export function splitRef(ref) {
  const hashAt = ref.indexOf('#');
  const beforeHash = hashAt === -1 ? ref : ref.slice(0, hashAt);
  const hash = hashAt === -1 ? null : ref.slice(hashAt + 1);
  const queryAt = beforeHash.indexOf('?');
  return {
    path: queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt),
    query: queryAt === -1 ? null : beforeHash.slice(queryAt + 1),
    hash,
  };
}

/**
 * Problems with one URL-bearing attribute. `el` is the parsed element (or a
 * stand-in { name, attrs }), `ids` the ids of the page it sits on.
 */
export function checkRef({ el, attr, value, ids, resolver }) {
  const problems = [];
  const tag = el.name;
  const ref = value.trim();
  const isLink = tag === 'a' || tag === 'area';

  if (ref === '' || ref === '#') {
    if (isLink || attr !== 'action') problems.push(`bare ${attr}="${ref}" (link somewhere real, or use a <button>)`);
    return problems;
  }
  if (ref !== value) problems.push(`${attr}="${value}" has leading or trailing whitespace`);

  const scheme = (ref.match(/^([a-z][a-z0-9+.-]*):/i) || [])[1]?.toLowerCase();
  if (ref.startsWith('//')) {
    problems.push(`protocol-relative URL "${ref}" (spell out https://)`);
    return problems;
  }
  if (scheme === 'http') {
    problems.push(`plain http:// URL "${ref}" (use https://)`);
    return problems;
  }
  if (scheme === 'https') {
    if (isLink) {
      const rel = (el.attrs.rel || '').toLowerCase().split(/\s+/);
      if (!rel.includes('noopener')) problems.push(`external link "${ref}" has no rel="noopener"`);
      if (el.attrs.target !== '_blank') problems.push(`external link "${ref}" has no target="_blank"`);
    }
    return problems;
  }
  if (scheme === 'tel') {
    if (!TEL_RE.test(ref)) problems.push(`"${ref}" is not tel:+1XXXXXXXXXX or tel:1XXXXXXXXXX`);
    return problems;
  }
  if (scheme === 'mailto') {
    const problem = mailtoProblem(ref);
    if (problem) problems.push(`"${ref}": ${problem}`);
    return problems;
  }
  if (scheme === 'data') {
    if (!['img', 'source', 'image', 'use', 'link'].includes(tag)) problems.push(`data: URL on <${tag} ${attr}>`);
    return problems;
  }
  if (scheme) {
    problems.push(`unsupported URL scheme "${scheme}:" in "${ref}"`);
    return problems;
  }

  const { path, hash } = splitRef(ref);
  if (path === '') {
    // "#id" (same page) or "?query" (same page with a query)
    if (hash !== null && hash !== '' && !ids.has(hash)) problems.push(`same-page anchor "#${hash}" has no matching id`);
    if (hash === '') problems.push(`bare "#" in "${ref}"`);
    return problems;
  }
  if (!path.startsWith('/')) {
    problems.push(`relative URL "${ref}" (use a root-relative path)`);
    return problems;
  }
  if (/\.html$/i.test(path)) {
    problems.push(`internal link uses the .html spelling "${ref}" (use the clean URL)`);
    return problems;
  }
  if (path !== '/' && path.endsWith('/')) {
    problems.push(`internal link has a trailing slash "${ref}" (use the clean URL, it 308s otherwise)`);
    return problems;
  }
  const target = resolver.resolve(path);
  if (!target) {
    problems.push(`broken internal link "${ref}"`);
    return problems;
  }
  if (hash !== null) {
    if (hash === '') problems.push(`empty anchor in "${ref}"`);
    else if (target.kind === 'page' && !resolver.idsForPage(target.page).has(hash)) {
      problems.push(`"${ref}" targets #${hash}, which is not an id in public${target.page.file}`);
    }
  }
  return problems;
}

/** Every URL-bearing attribute of one parsed document, as [el, attr, value]. */
export function* refsOf(doc) {
  for (const el of elements(doc)) {
    const attrs = URL_ATTRS[el.name];
    if (!attrs) continue;
    for (const attr of attrs) {
      if (!(attr in el.attrs)) continue;
      const value = el.attrs[attr];
      if (attr === 'srcset') {
        for (const candidate of value.split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          if (url) yield [el, attr, url];
        }
      } else {
        yield [el, attr, value];
      }
    }
  }
}

/** Link problems for one HTML document: [{ line, message }]. */
export function checkDocument(html, resolver) {
  const doc = parseHtml(html);
  const ids = idsOf(doc);
  const out = [];
  for (const [el, attr, value] of refsOf(doc)) {
    for (const message of checkRef({ el, attr, value, ids, resolver })) out.push({ line: el.line, message });
  }
  return out;
}

/* The 404 and any other code-rendered page are JSX, not HTML: check their
 * literal hrefs (app/ and pages/). */
function appSourceProblems(resolver) {
  const out = [];
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(m?jsx?|tsx?)$/.test(entry)) files.push(full);
    }
  };
  walk(APP_DIR);
  walk(PAGES_DIR);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const lineOf = lineIndex(source);
    for (const m of source.matchAll(/\bhref=["']([^"'{}]+)["']/g)) {
      const fake = { name: 'a', attrs: { href: m[1], rel: 'noopener', target: '_blank' } };
      for (const message of checkRef({ el: fake, attr: 'href', value: m[1], ids: new Set(), resolver })) {
        out.push({ file: relative(ROOT, file), line: lineOf(m.index), message });
      }
    }
  }
  return out;
}

/** Line ranges [first, last] of the prerendered chrome regions in a page. */
export function chromeLineRanges(html) {
  const lineOf = lineIndex(html);
  const ranges = [];
  for (const [start, end] of [
    ['<!-- chrome:header:start -->', '<!-- chrome:header:end -->'],
    ['<!-- chrome:footer:start -->', '<!-- chrome:footer:end -->'],
  ]) {
    const a = html.indexOf(start);
    const b = a === -1 ? -1 : html.indexOf(end, a);
    if (a !== -1 && b !== -1) ranges.push([lineOf(a), lineOf(b)]);
  }
  return ranges;
}

/**
 * Everything: [{ file, line, message, chrome }]. `chrome` is true when the
 * reference sits inside a generated chrome region (its source is
 * lib/chrome.mjs, not the page).
 */
export function checkLinks({ pages = staticPages() } = {}) {
  const resolver = createResolver({ pages });
  const problems = [];
  for (const page of pages) {
    const html = readFileSync(page.abs, 'utf8');
    const ranges = chromeLineRanges(html);
    for (const p of checkDocument(html, resolver)) {
      const chrome = ranges.some(([a, b]) => p.line >= a && p.line <= b);
      problems.push({ file: `public${page.file}`, chrome, ...p });
    }
  }
  problems.push(...appSourceProblems(resolver).map((p) => ({ chrome: false, ...p })));
  return { problems, pageCount: pages.length };
}

function main() {
  const { problems, pageCount } = checkLinks();
  if (problems.length) {
    // Chrome problems repeat on every page; report each one once.
    const chrome = new Map();
    const byFile = new Map();
    for (const p of problems) {
      if (p.chrome) {
        if (!chrome.has(p.message)) chrome.set(p.message, new Set());
        chrome.get(p.message).add(p.file);
        continue;
      }
      if (!byFile.has(p.file)) byFile.set(p.file, []);
      byFile.get(p.file).push(p);
    }
    const count = chrome.size + [...byFile.values()].reduce((n, list) => n + list.length, 0);
    console.error(`✗ ${count} link problem(s):`);
    if (chrome.size) {
      console.error('  site chrome (lib/chrome.mjs, prerendered into every page; fix there, then npm run pages:build)');
      for (const [message, files] of chrome) console.error(`    ${message}  [${files.size} pages]`);
    }
    for (const [file, list] of byFile) {
      console.error(`  ${file}`);
      for (const p of list) console.error(`    line ${p.line}: ${p.message}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${pageCount} pages (chrome included) and the app routes: every link resolves and follows the link rules.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();

