#!/usr/bin/env node
/**
 * scripts/check-redirects.mjs
 * ---------------------------
 * Static audit of the redirect map in next.config.mjs. No server, no network
 * (except --fetch).
 *
 *   npm run check:redirects                    exit 1 on any problem
 *   node scripts/check-redirects.mjs --fetch   refresh docs/legacy-sitemap-urls.txt
 *                                              from the live sitemaps, then check
 *
 * The rules come from `await nextConfig.redirects()`, so the audit can never
 * drift from the config. Checks:
 *
 *   destinations  every destination path (minus ?query and #anchor) resolves
 *                 to a static page (lib/static-pages.mjs), an App Router route
 *                 or a file under public/; every #anchor exists as an id in
 *                 that page; no trailing slash, no http://
 *   sources       no duplicate sources (Next matches case-insensitively, so
 *                 case-only twins count), no rule made unreachable by an
 *                 earlier rule, no source that captures a page or app route
 *                 (redirects run before the filesystem)
 *   chains        no destination is itself matched by a redirect source
 *   coverage      every path in docs/legacy-sitemap-urls.txt (the live
 *                 WordPress sitemaps) is served by a page or route, or matched
 *                 by a redirect source. Unmapped paths are printed.
 *
 * Sources are matched with Next's semantics: path-to-regexp 6 with
 * strict: true, sensitive: false, delimiter '/' (next/dist/lib/
 * build-custom-route.js), so :param, :param*, :param+, :param? and
 * :name(a|b) behave exactly as on Vercel. tests/check-rules.test.mjs pins this
 * against Next's own compiled path-to-regexp.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { staticPages } from '../lib/static-pages.mjs';
import { ROOT, appRoutes, createResolver, splitRef } from './check-links.mjs';

export const SNAPSHOT = join(ROOT, 'docs/legacy-sitemap-urls.txt');
export const SITEMAP_INDEX = 'https://equalityohio.org/sitemap_index.xml';

/* ===========================================================================
 * path-to-regexp 6.3, as Next 15 bundles it (next/dist/compiled/
 * path-to-regexp) and calls it for custom routes: pathToRegexp(source, [],
 * { strict: true, sensitive: false, delimiter: '/' }). A readable port of
 * lexer(), parse() and tokensToRegexp(), MIT licensed upstream.
 * ======================================================================== */

const DELIMITER = '/';
const PREFIXES = './';
const escapeString = (s) => s.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1');

function lexer(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    if (char === '*' || char === '+' || char === '?') {
      tokens.push({ type: 'MODIFIER', index: i, value: str[i++] });
      continue;
    }
    if (char === '\\') {
      tokens.push({ type: 'ESCAPED_CHAR', index: i++, value: str[i++] });
      continue;
    }
    if (char === '{') {
      tokens.push({ type: 'OPEN', index: i, value: str[i++] });
      continue;
    }
    if (char === '}') {
      tokens.push({ type: 'CLOSE', index: i, value: str[i++] });
      continue;
    }
    if (char === ':') {
      let name = '';
      let j = i + 1;
      while (j < str.length && /[0-9A-Za-z_]/.test(str[j])) name += str[j++];
      if (!name) throw new TypeError(`Missing parameter name at ${i}`);
      tokens.push({ type: 'NAME', index: i, value: name });
      i = j;
      continue;
    }
    if (char === '(') {
      let count = 1;
      let pattern = '';
      let j = i + 1;
      if (str[j] === '?') throw new TypeError(`Pattern cannot start with "?" at ${j}`);
      while (j < str.length) {
        if (str[j] === '\\') {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ')') {
          count -= 1;
          if (count === 0) {
            j += 1;
            break;
          }
        } else if (str[j] === '(') {
          count += 1;
          if (str[j + 1] !== '?') throw new TypeError(`Capturing groups are not allowed at ${j}`);
        }
        pattern += str[j++];
      }
      if (count) throw new TypeError(`Unbalanced pattern at ${i}`);
      if (!pattern) throw new TypeError(`Missing pattern at ${i}`);
      tokens.push({ type: 'PATTERN', index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: 'CHAR', index: i, value: str[i++] });
  }
  tokens.push({ type: 'END', index: i, value: '' });
  return tokens;
}

/** Tokens: strings and { name, prefix, suffix, pattern, modifier }. */
export function parseSource(source) {
  const tokens = lexer(source);
  const result = [];
  let key = 0;
  let i = 0;
  let path = '';
  const tryConsume = (type) => (i < tokens.length && tokens[i].type === type ? tokens[i++].value : undefined);
  const mustConsume = (type) => {
    const value = tryConsume(type);
    if (value !== undefined) return value;
    const { type: got, index } = tokens[i];
    throw new TypeError(`Unexpected ${got} at ${index}, expected ${type}`);
  };
  const consumeText = () => {
    let text = '';
    let value;
    while ((value = tryConsume('CHAR') || tryConsume('ESCAPED_CHAR'))) text += value;
    return text;
  };
  const isSafe = (value) => [...DELIMITER].some((d) => value.includes(d));
  const safePattern = (prefix) => {
    const prev = result[result.length - 1];
    const text = prefix || (prev && typeof prev === 'string' ? prev : '');
    if (prev && !text) throw new TypeError(`Must have text between two parameters, missing text after "${prev.name}"`);
    if (!text || isSafe(text)) return `[^${escapeString(DELIMITER)}]+?`;
    return `(?:(?!${escapeString(text)})[^${escapeString(DELIMITER)}])+?`;
  };

  while (i < tokens.length) {
    const char = tryConsume('CHAR');
    const name = tryConsume('NAME');
    const pattern = tryConsume('PATTERN');
    if (name || pattern) {
      let prefix = char || '';
      if (!PREFIXES.includes(prefix)) {
        path += prefix;
        prefix = '';
      }
      if (path) {
        result.push(path);
        path = '';
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: '',
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume('MODIFIER') || '',
      });
      continue;
    }
    const value = char || tryConsume('ESCAPED_CHAR');
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = '';
    }
    if (tryConsume('OPEN')) {
      const prefix = consumeText();
      const groupName = tryConsume('NAME') || '';
      const groupPattern = tryConsume('PATTERN') || '';
      const suffix = consumeText();
      mustConsume('CLOSE');
      result.push({
        name: groupName || (groupPattern ? key++ : ''),
        pattern: groupName && !groupPattern ? safePattern(prefix) : groupPattern,
        prefix,
        suffix,
        modifier: tryConsume('MODIFIER') || '',
      });
      continue;
    }
    mustConsume('END');
  }
  return result;
}

/** The RegExp Next uses for a redirect source (strict, end, case-insensitive). */
export function compileSource(source, { sensitive = false } = {}) {
  const tokens = parseSource(source);
  const keys = [];
  let route = '^';
  for (const token of tokens) {
    if (typeof token === 'string') {
      route += escapeString(token);
      continue;
    }
    const prefix = escapeString(token.prefix);
    const suffix = escapeString(token.suffix);
    if (!token.pattern) {
      route += `(?:${prefix}${suffix})${token.modifier}`;
      continue;
    }
    keys.push(token);
    if (prefix || suffix) {
      if (token.modifier === '+' || token.modifier === '*') {
        const mod = token.modifier === '*' ? '?' : '';
        route += `(?:${prefix}((?:${token.pattern})(?:${suffix}${prefix}(?:${token.pattern}))*)${suffix})${mod}`;
      } else {
        route += `(?:${prefix}(${token.pattern})${suffix})${token.modifier}`;
      }
    } else {
      if (token.modifier === '+' || token.modifier === '*') {
        throw new TypeError(`Can not repeat "${token.name}" without a prefix and suffix`);
      }
      route += `(${token.pattern})${token.modifier}`;
    }
  }
  route += '$';
  return { regex: new RegExp(route, sensitive ? '' : 'i'), keys, tokens };
}

const compiled = new Map();
function compiledFor(source) {
  if (!compiled.has(source)) compiled.set(source, compileSource(source));
  return compiled.get(source);
}

/** Params object when `path` matches `source`, else null. */
export function matchSource(source, path) {
  const { regex, keys } = compiledFor(source);
  const m = regex.exec(path);
  if (!m) return null;
  const params = {};
  keys.forEach((key, index) => {
    const value = m[index + 1];
    if (value === undefined) return;
    params[key.name] = key.modifier === '*' || key.modifier === '+' ? value.split(key.suffix + key.prefix || '/') : value;
  });
  return params;
}

/* A sample value for one param: the first alternative of a custom pattern
 * when it is plain text (":dir(img|logo)" -> "img"), else the first of a few
 * stock values the pattern accepts. */
const STOCK_SAMPLES = ['sample', '2026', '1', 'a', 'sample-1', 'sample.html'];
function sampleValue(token) {
  let depth = 0;
  let first = '';
  for (let i = 0; i < token.pattern.length; i++) {
    const c = token.pattern[i];
    if (c === '\\') {
      first += token.pattern.slice(i, i + 2);
      i += 1;
      continue;
    }
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === '|' && depth === 0) break;
    first += c;
  }
  const plain = !/[\\^$.*+?()[\]{}|]/.test(first.replace(/\\./g, ''));
  const accepts = new RegExp(`^(?:${token.pattern})$`, 'i');
  const candidates = [...(plain ? [first.replace(/\\(.)/g, '$1')] : []), ...STOCK_SAMPLES];
  return candidates.find((value) => accepts.test(value)) ?? 'sample';
}

/**
 * A concrete path that `source` matches, with the params used: every param
 * gets one sample segment (so wildcard rules are exercised with a real
 * segment). Throws when no sample can be built.
 */
export function samplePath(source) {
  const { tokens, regex } = compiledFor(source);
  let path = '';
  const params = {};
  for (const token of tokens) {
    if (typeof token === 'string') {
      path += token;
      continue;
    }
    if (!token.pattern) {
      path += token.prefix + token.suffix;
      continue;
    }
    const value = sampleValue(token);
    path += token.prefix + value + token.suffix;
    params[token.name] = token.modifier === '*' || token.modifier === '+' ? [value] : value;
  }
  if (!regex.test(path)) throw new Error(`could not build a sample path for redirect source ${source}`);
  return { path, params };
}

/** Substitute :params into a destination path (Next's compile step). */
export function applyParams(destination, params) {
  return destination.replace(/:([A-Za-z_][0-9A-Za-z_]*)([*+?])?/g, (whole, name) => {
    if (!(name in params)) return whole;
    const value = params[name];
    return Array.isArray(value) ? value.join('/') : value;
  });
}

/** The status Next answers a redirect rule with. */
export function statusFor(rule) {
  if (rule.statusCode) return rule.statusCode;
  return rule.permanent ? 308 : 307;
}

/* ===========================================================================
 * Inputs
 * ======================================================================== */

export async function loadRedirects() {
  const { default: config } = await import(pathToFileURL(join(ROOT, 'next.config.mjs')).href);
  return typeof config.redirects === 'function' ? await config.redirects() : [];
}

/** { paths, header } from docs/legacy-sitemap-urls.txt. */
export function readSnapshot(file = SNAPSHOT) {
  if (!existsSync(file)) return { paths: [], header: [], missing: true };
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  return {
    paths: lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#')),
    header: lines.filter((l) => l.startsWith('#')),
    missing: false,
  };
}

/** Next 308s "/x/" to "/x" (trailingSlash: false) before any rule runs. */
export function normalizeLegacyPath(raw) {
  let path = raw.split('#')[0].split('?')[0];
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

/* ===========================================================================
 * Analysis
 * ======================================================================== */

/**
 * Every problem with the redirect map, plus coverage of the legacy snapshot.
 * Pure: pass in the rules, pages, routes and snapshot paths.
 */
export function analyzeRedirects({
  redirects,
  pages = staticPages(),
  routes = appRoutes(),
  snapshot = [],
  resolver = createResolver({ pages, routes }),
}) {
  const problems = [];
  const notes = [];
  const label = (i) => `#${i + 1} ${redirects[i].source}`;

  // Shape.
  redirects.forEach((rule, i) => {
    if (typeof rule.source !== 'string' || !rule.source.startsWith('/')) problems.push(`rule ${i + 1}: source must start with "/" (${JSON.stringify(rule.source)})`);
    if (typeof rule.destination !== 'string' || !rule.destination) problems.push(`rule ${label(i)}: no destination`);
    if (rule.statusCode === undefined && typeof rule.permanent !== 'boolean') problems.push(`rule ${label(i)}: set permanent: true or false`);
    if (rule.statusCode !== undefined && ![301, 302, 303, 307, 308].includes(rule.statusCode)) problems.push(`rule ${label(i)}: statusCode ${rule.statusCode} is not a redirect`);
    try {
      compiledFor(rule.source);
      samplePath(rule.source);
    } catch (err) {
      problems.push(`rule ${label(i)}: ${err.message}`);
    }
  });
  if (problems.length) return { problems, notes, unmapped: [], coverage: null };

  // Duplicate sources (case-insensitive, as Next matches).
  const firstBySource = new Map();
  redirects.forEach((rule, i) => {
    const key = rule.source.toLowerCase();
    if (firstBySource.has(key)) {
      const j = firstBySource.get(key);
      problems.push(`duplicate source ${rule.source}: rules #${j + 1} and #${i + 1} (only the first ever runs)`);
    } else {
      firstBySource.set(key, i);
    }
  });

  // Unreachable rules: an earlier rule already matches this one's sample.
  const samples = redirects.map((rule) => samplePath(rule.source));
  redirects.forEach((rule, i) => {
    if (firstBySource.get(rule.source.toLowerCase()) !== i) return; // already reported as duplicate
    for (let j = 0; j < i; j++) {
      if (matchSource(redirects[j].source, samples[i].path)) {
        problems.push(`rule ${label(i)} is unreachable: earlier rule ${label(j)} matches ${samples[i].path} first`);
        break;
      }
    }
  });

  // Sources that capture a page or an app route.
  const served = [...pages.map((p) => p.url), ...routes];
  for (const url of served) {
    const i = redirects.findIndex((rule) => matchSource(rule.source, url));
    if (i !== -1) problems.push(`redirect ${label(i)} captures ${url}: redirects run before the filesystem, so that page can never be reached`);
  }

  // Destinations and chains.
  redirects.forEach((rule, i) => {
    const dest = rule.destination;
    if (/^http:\/\//i.test(dest)) {
      problems.push(`rule ${label(i)}: destination ${dest} uses plain http://`);
      return;
    }
    if (/^https:\/\//i.test(dest)) {
      notes.push(`rule ${label(i)} leaves the site: ${dest}`);
      return;
    }
    const applied = applyParams(dest, samples[i].params);
    const { path, hash } = splitRef(applied);
    const where = `rule ${label(i)} -> ${dest}`;
    if (!path.startsWith('/')) {
      problems.push(`${where}: destination must be root-relative or https://`);
      return;
    }
    if (/:[A-Za-z_]/.test(path)) {
      problems.push(`${where}: destination param not present in the source`);
      return;
    }
    if (path !== '/' && path.endsWith('/')) problems.push(`${where}: trailing slash in the destination (it chains into the trailing-slash 308)`);

    const target = resolver.resolve(path);
    if (!target) {
      problems.push(`${where}: ${path} is not a static page, an app route or a file under public/`);
    } else if (hash !== null) {
      if (hash === '') problems.push(`${where}: empty #anchor`);
      else if (target.kind === 'page' && !resolver.idsForPage(target.page).has(hash)) {
        problems.push(`${where}: #${hash} is not an id in public${target.page.file}`);
      } else if (target.kind !== 'page') {
        problems.push(`${where}: #${hash} on a ${target.kind}, which has no ids to check`);
      }
    }

    const next = redirects.findIndex((other) => matchSource(other.source, path));
    if (next !== -1) {
      problems.push(next === i
        ? `${where}: redirect loop (the destination matches its own source)`
        : `${where}: redirect chain, ${path} is redirected again by ${label(next)} -> ${redirects[next].destination}`);
    }
  });

  // Coverage of the live sitemap snapshot.
  const pageUrls = new Map(pages.map((p) => [p.url.toLowerCase(), p.url]));
  const routeUrls = new Set([...routes].map((r) => r.toLowerCase()));
  const unmapped = [];
  const coverage = { total: snapshot.length, pages: 0, redirects: 0, temporary: 0 };
  for (const raw of snapshot) {
    const path = normalizeLegacyPath(raw);
    if (pageUrls.has(path.toLowerCase()) || routeUrls.has(path.toLowerCase())) {
      coverage.pages += 1;
      continue;
    }
    const i = redirects.findIndex((rule) => matchSource(rule.source, path));
    if (i === -1) {
      unmapped.push(raw);
      continue;
    }
    coverage.redirects += 1;
    if (statusFor(redirects[i]) === 307 || statusFor(redirects[i]) === 302) coverage.temporary += 1;
  }

  return { problems, notes, unmapped, coverage };
}

/* ===========================================================================
 * --fetch: rebuild the snapshot from the live sitemaps (curl, browser UA)
 * ======================================================================== */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function curl(url) {
  return execFileSync('curl', ['-sSL', '--fail', '--max-time', '60', '-A', BROWSER_UA, url], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

const locs = (xml) =>
  [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^\]<\s]+)\s*(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1]);

export function fetchSnapshot({ index = SITEMAP_INDEX, today = new Date().toISOString().slice(0, 10) } = {}) {
  const children = locs(curl(index));
  if (!children.length) throw new Error(`${index} lists no child sitemaps`);
  const counts = [];
  const paths = new Set();
  for (const child of children) {
    const urls = locs(curl(child));
    counts.push(`${child.split('/').pop()} ${urls.length}`);
    for (const url of urls) {
      const u = new URL(url);
      paths.add(u.pathname + u.search);
    }
  }
  const sorted = [...paths].sort();
  const header = [
    '# docs/legacy-sitemap-urls.txt',
    '# Every URL path in the live equalityohio.org WordPress sitemaps, spelled as',
    '# the live site spells it (trailing slash). scripts/check-redirects.mjs',
    '# requires each one to be served by a page or matched by a redirect in',
    '# next.config.mjs, so no inbound link or search result 404s at launch.',
    `# Fetched ${today} from ${index}`,
    `# (${children.length} child sitemaps, ${sorted.length} paths):`,
    ...counts.map((c) => `#   ${c}`),
    '# Refresh before launch: node scripts/check-redirects.mjs --fetch',
  ];
  writeFileSync(SNAPSHOT, `${header.join('\n')}\n${sorted.join('\n')}\n`);
  return { paths: sorted, children: children.length };
}

/* ======================================================================== */

async function main() {
  if (process.argv.includes('--fetch')) {
    const { paths, children } = fetchSnapshot();
    console.log(`✓ wrote ${relative(ROOT, SNAPSHOT)}: ${paths.length} paths from ${children} child sitemaps`);
  }

  const redirects = await loadRedirects();
  const snapshot = readSnapshot();
  const { problems, notes, unmapped, coverage } = analyzeRedirects({ redirects, snapshot: snapshot.paths });

  const temporary = redirects.filter((r) => [302, 307].includes(statusFor(r)));
  console.log(`check-redirects: ${redirects.length} rules from next.config.mjs (${redirects.length - temporary.length} permanent, ${temporary.length} temporary)`);
  if (temporary.length) console.log(`  temporary (307, may be reused later): ${temporary.map((r) => r.source).join(', ')}`);
  for (const note of notes) console.log(`  note: ${note}`);

  let failed = false;
  if (problems.length) {
    failed = true;
    console.error(`✗ ${problems.length} redirect problem(s):`);
    for (const p of problems) console.error(`    ${p}`);
  } else {
    console.log('✓ destinations resolve (pages, routes, #anchors); no duplicates, unreachable rules, captured pages or chains');
  }

  if (snapshot.missing) {
    failed = true;
    console.error(`✗ ${relative(ROOT, SNAPSHOT)} is missing; run: node scripts/check-redirects.mjs --fetch`);
  } else if (coverage) {
    const fetched = (snapshot.header.find((l) => /Fetched \d{4}-\d{2}-\d{2}/.test(l)) || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || 'unknown date';
    const servedCount = coverage.pages + coverage.redirects;
    const summary = `${servedCount} of ${coverage.total} live sitemap paths answer (${coverage.pages} pages, ${coverage.redirects} redirects, ${coverage.temporary} of them temporary); snapshot fetched ${fetched}`;
    if (unmapped.length) {
      failed = true;
      console.error(`✗ coverage: ${summary}. ${unmapped.length} would 404 at launch (add a page or a redirect):`);
      for (const p of unmapped) console.error(`    ${p}`);
    } else {
      console.log(`✓ coverage: ${summary}`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
