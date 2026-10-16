/**
 * tests/check-rules.test.mjs
 * --------------------------
 * Unit tests for the rules inside the check scripts, so a checker that
 * silently stops catching something fails here first:
 *
 *   scripts/check-redirects.mjs  the redirect-source compiler is byte-for-byte
 *                                Next's (path-to-regexp 6.3 with Next's
 *                                options), samples, and the map analysis
 *   scripts/check-links.mjs      the per-link rules
 *   scripts/check-tokens.mjs     literal and stale-palette detection
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { checkRef, createResolver, parseHtml } from '../scripts/check-links.mjs';
import {
  analyzeRedirects,
  compileSource,
  loadRedirects,
  matchSource,
  normalizeLegacyPath,
  samplePath,
  statusFor,
} from '../scripts/check-redirects.mjs';
import { cssColorLiterals, htmlColorLiterals, stalePaletteHits } from '../scripts/check-tokens.mjs';

const require = createRequire(import.meta.url);
const { pathToRegexp } = require('next/dist/compiled/path-to-regexp');
const nextRegex = (source) => pathToRegexp(source, [], { strict: true, sensitive: false, delimiter: '/' });

describe('redirect source matching follows Next exactly', () => {
  const SYNTHETIC = [
    '/event/:slug*', '/people/:slug+', '/a/:b?', '/assets/:dir(img|logo|brand)/:path*',
    '/:file(favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png)', '/files/:name.:ext', '/x{-:y}?',
    '/foo-:bar', '/:a/:b', '/about.html', '/news/:year(\\d{4})/:rest*', '/(.*)', '/v{1}',
  ];

  test('compiled regex is identical to next/dist/compiled/path-to-regexp for every source', async () => {
    const sources = [...new Set([...SYNTHETIC, ...(await loadRedirects()).map((r) => r.source)])];
    for (const source of sources) {
      const ours = compileSource(source).regex;
      const theirs = nextRegex(source);
      assert.equal(ours.source, theirs.source, `regex for ${source}`);
      assert.equal(ours.flags, theirs.flags, `flags for ${source}`);
    }
  });

  test('matching semantics: wildcards, optional, alternation, case, trailing slash', () => {
    assert.deepEqual(matchSource('/event/:slug*', '/event'), {});
    assert.deepEqual(matchSource('/event/:slug*', '/event/a/b'), { slug: ['a', 'b'] });
    assert.equal(matchSource('/people/:slug+', '/people'), null);
    assert.deepEqual(matchSource('/people/:slug+', '/people/josh'), { slug: ['josh'] });
    assert.equal(matchSource('/about/staff-interns/:slug', '/about/staff-interns/a/b'), null);
    assert.deepEqual(matchSource('/assets/:dir(img|logo)/:path*', '/assets/LOGO/x.png'), { dir: 'LOGO', path: ['x.png'] });
    assert.equal(matchSource('/assets/:dir(img|logo)/:path*', '/assets/fonts/x.woff2'), null);
    assert.ok(matchSource('/Get-Involved/Donate', '/get-involved/donate'), 'case-insensitive like Next');
    assert.equal(matchSource('/give', '/give/'), null, 'strict: the trailing-slash 308 runs first');
  });

  test('samplePath builds a path the source matches, one segment per param', () => {
    assert.deepEqual(samplePath('/event/:slug*'), { path: '/event/sample', params: { slug: ['sample'] } });
    assert.equal(samplePath('/assets/:dir(img|logo)/:path*').path, '/assets/img/sample');
    assert.equal(samplePath('/:file(favicon\\.ico|favicon\\.svg)').path, '/favicon.ico');
    assert.equal(samplePath('/news/:year(\\d{4})').path, '/news/2026');
  });

  test('status codes and legacy path normalization', () => {
    assert.equal(statusFor({ permanent: true }), 308);
    assert.equal(statusFor({ permanent: false }), 307);
    assert.equal(statusFor({ statusCode: 301 }), 301);
    assert.equal(normalizeLegacyPath('/about/'), '/about');
    assert.equal(normalizeLegacyPath('/'), '/');
    assert.equal(normalizeLegacyPath('/a/b/?x=1'), '/a/b');
  });
});

describe('redirect map analysis', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eo-redirects-'));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const pageFile = (name, body) => {
    const abs = join(dir, `${name}.html`);
    writeFileSync(abs, `<!doctype html><html lang="en"><body><main id="main">${body}</main></body></html>`);
    return abs;
  };
  const pages = [
    { file: '/give.html', url: '/give', abs: pageFile('give', '<section id="daf"></section>') },
    { file: '/news.html', url: '/news', abs: pageFile('news', '') },
  ];
  const routes = new Set(['/sitemap.xml']);
  const analyze = (redirects, snapshot = []) => analyzeRedirects({ redirects, pages, routes, snapshot });
  const r = (source, destination, permanent = true) => ({ source, destination, permanent });

  test('a clean map passes', () => {
    const { problems } = analyze([r('/donate', '/give'), r('/daf', '/give#daf'), r('/category/:slug*', '/news')]);
    assert.deepEqual(problems, []);
  });

  test('flags duplicates (case-insensitive), unreachable rules and captured pages', () => {
    const { problems } = analyze([
      r('/category/:slug*', '/news'),
      r('/category/events', '/give'),
      r('/Donate', '/give'),
      r('/donate', '/news'),
      r('/:page(give)', '/news'),
    ]);
    const text = problems.join('\n');
    assert.match(text, /rule #2 \/category\/events is unreachable: earlier rule #1/);
    assert.match(text, /duplicate source \/donate: rules #3 and #4/);
    assert.match(text, /captures \/give/);
  });

  test('flags unknown destinations, missing anchors, chains, loops, trailing slashes and http', () => {
    const { problems } = analyze([
      r('/a', '/nowhere'),
      r('/b', '/give#missing'),
      r('/c', '/d'),
      r('/d', '/news'),
      r('/e', '/e'),
      r('/f', '/give/'),
      r('/g', 'http://example.org'),
    ]);
    const text = problems.join('\n');
    assert.match(text, /#1 \/a -> \/nowhere: \/nowhere is not a static page/);
    assert.match(text, /#2 \/b -> \/give#missing: #missing is not an id/);
    assert.match(text, /#3 \/c -> \/d: redirect chain, \/d is redirected again by #4/);
    assert.match(text, /#5 \/e -> \/e: redirect loop/);
    assert.match(text, /#6 \/f -> \/give\/: trailing slash/);
    assert.match(text, /#7 \/g: destination http:\/\/example.org uses plain http/);
  });

  test('coverage: live paths are served by a page, a route or a redirect', () => {
    const { unmapped, coverage } = analyze([r('/category/:slug*', '/news'), r('/old', '/give', false)], [
      '/give/', '/sitemap.xml', '/category/blog/', '/old/', '/privacy-policy/', '/tag/lgbt/',
    ]);
    assert.deepEqual(unmapped, ['/privacy-policy/', '/tag/lgbt/']);
    assert.deepEqual(coverage, { total: 6, pages: 2, redirects: 2, temporary: 1 });
  });
});

describe('link rules', () => {
  const resolver = createResolver();
  const ids = new Set(['here']);
  const check = (html) => {
    const doc = parseHtml(html);
    const el = doc.children.find((c) => c.type === 'element');
    const attr = ['href', 'src', 'action'].find((a) => a in el.attrs);
    return checkRef({ el, attr, value: el.attrs[attr], ids, resolver });
  };

  test('internal links: clean URLs, anchors, files and app routes pass', () => {
    assert.deepEqual(check('<a href="/give#daf">x</a>'), []);
    assert.deepEqual(check('<a href="/">x</a>'), []);
    assert.deepEqual(check('<a href="#here">x</a>'), []);
    assert.deepEqual(check('<link rel="stylesheet" href="/css/eo-site.css">'), []);
    assert.deepEqual(check('<link rel="manifest" href="/manifest.webmanifest">'), []);
    assert.deepEqual(check('<a href="/gate?error=1">x</a>'), []);
  });

  test('internal links: .html, trailing slash, relative, broken and missing anchors fail', () => {
    assert.match(check('<a href="/about.html">x</a>')[0], /\.html spelling/);
    assert.match(check('<a href="/about/">x</a>')[0], /trailing slash/);
    assert.match(check('<a href="about">x</a>')[0], /relative URL/);
    assert.match(check('<a href="/nope">x</a>')[0], /broken internal link/);
    assert.match(check('<a href="/give#nope">x</a>')[0], /not an id in public\/give\.html/);
    assert.match(check('<a href="#gone">x</a>')[0], /same-page anchor "#gone"/);
  });

  test('bare #, javascript:, protocol-relative and plain http fail', () => {
    assert.match(check('<a href="#">x</a>')[0], /bare href="#"/);
    assert.match(check('<a href="">x</a>')[0], /bare href=""/);
    assert.match(check('<a href="javascript:void(0)">x</a>')[0], /unsupported URL scheme "javascript:"/);
    assert.match(check('<a href="//evil.example">x</a>')[0], /protocol-relative/);
    assert.match(check('<a href="http://shop.equalityohio.org" rel="noopener" target="_blank">x</a>')[0], /plain http/);
    assert.match(check('<img src="http://example.org/x.png" alt="">')[0], /plain http/);
  });

  test('external links need rel="noopener" and target="_blank"', () => {
    assert.deepEqual(check('<a href="https://example.org" rel="noopener" target="_blank">x</a>'), []);
    assert.deepEqual(check('<a href="https://example.org" rel="noopener noreferrer" target="_blank">x</a>'), []);
    const problems = check('<a href="https://twitter.com/equalityohio" rel="noopener">x</a>');
    assert.deepEqual(problems, ['external link "https://twitter.com/equalityohio" has no target="_blank"']);
    assert.equal(check('<a href="https://example.org">x</a>').length, 2);
  });

  test('tel: and mailto: shapes', () => {
    assert.deepEqual(check('<a href="tel:+18555428529">x</a>'), []);
    assert.deepEqual(check('<a href="tel:18555428529">x</a>'), []);
    assert.match(check('<a href="tel:855-542-8529">x</a>')[0], /not tel:\+1XXXXXXXXXX/);
    assert.match(check('<a href="tel:5428529">x</a>')[0], /not tel:\+1XXXXXXXXXX/);
    assert.deepEqual(check('<a href="mailto:info@equalityohio.org">x</a>'), []);
    assert.deepEqual(check('<a href="mailto:info@equalityohio.org?subject=Legal%20Clinic">x</a>'), []);
    assert.match(check('<a href="mailto:info@equalityohio">x</a>')[0], /malformed address/);
    assert.match(check('<a href="mailto:info@equalityohio.org?subject=Hi there">x</a>')[0], /whitespace/);
    assert.match(check('<a href="mailto:info@equalityohio.org?foo=1">x</a>')[0], /unknown mailto parameter/);
  });
});

describe('token rules', () => {
  test('finds literals in declaration values only, with line numbers', () => {
    const css = [
      '#faded, #add { color: var(--eo-ink); }', // id selectors, not colors
      '.a { color: #fff; background: rgba(255, 255, 255, 0.9); }',
      '/* #123456 in a comment */',
      '.b { border-color: hsl(10 20% 30%); }',
      '.c { background: url("data:image/svg+xml,%3Csvg fill=\'%23ffffff\'%3E;%3C/svg%3E") no-repeat; color: #5A3F99 }',
    ].join('\n');
    const hits = cssColorLiterals(css).map((h) => `${h.line}:${h.literal}:${h.property}`);
    assert.deepEqual(hits, [
      '2:#fff:color',
      '2:rgba(255, 255, 255, 0.9):background',
      '4:hsl(10 20% 30%):border-color',
      '5:%23ffffff (#ffffff in a data: URI):background',
      '5:#5A3F99:color',
    ]);
  });

  test('page styles: <style>, style="" and SVG paint attributes; entities are not colors', () => {
    const html = [
      '<p>855&#8209;LGBT&#8209;LAW</p>',
      '<style>',
      '  .x { color: #C0392B; }',
      '</style>',
      '<span style="background:rgba(255,255,255,0.9)">x</span>',
      '<svg><rect fill="#9FCF67"/><rect fill="currentColor"/></svg>',
    ].join('\n');
    const hits = htmlColorLiterals(html).map((h) => `${h.line}:${h.literal}`);
    assert.deepEqual(hits, ['3:#C0392B', '5:rgba(255,255,255,0.9)', '6:#9FCF67']);
  });

  test('stale palette: any spelling, any case, comments ignored', () => {
    const css = '.a{color:#0080c0}\n.b{background:RGBA( 106 , 202 , 62 , .1)}\n/* never #401385 */\n.c{fill:%236ACA3E}';
    const { hits, inComments } = stalePaletteHits(css, '.css');
    assert.deepEqual(hits.map((h) => h.line), [1, 2, 4]);
    assert.equal(inComments, 1);
    assert.equal(stalePaletteHits('<!-- #0080C0 --><p>ok</p>', '.html').hits.length, 0);
  });
});
