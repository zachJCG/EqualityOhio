/* Text, outline, anchor and link parity: every rendered page against the
   source content in source/content (HANDOFF.md §6 Phase 2 checks 1–4).
   Needs a running WordPress with the pages imported (EO_BASE, default
   http://localhost:8080).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseHTML } from 'linkedom';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const BASE = (process.env.EO_BASE || 'http://localhost:8080').replace(/\/$/, '');
const TODAY = process.env.EO_TODAY || new Date().toISOString().slice(0, 10);
const registry = JSON.parse(readFileSync(join(root, 'plugins/eo-site/data/pages.json'), 'utf8')).pages;
const sourcePages = JSON.parse(readFileSync(join(root, 'source/content/pages.json'), 'utf8'));

const BLOCK = /<\/?(?:section|div|article|aside|p|h[1-6]|li|ul|ol|dl|dt|dd|form|fieldset|legend|label|button|select|option|textarea|table|tr|td|th|blockquote|figure|figcaption|picture|br|hr|details|summary|nav|header|footer|time|main|a)\b[^>]*>/gi; // <a> splits too: buttons stand alone in both builds, and inline links split identically on both sides
/** The handoff's visible_text (tools/analyze.py), reproduced. */
function visibleText(html) {
  let t = html.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  // Block tags split lines; raw newlines inside inline runs are plain whitespace
  // (the handoff's text files kept source newlines as line breaks; the rendered
  // page has them collapsed, which is the same visible text).
  t = t.replace(BLOCK, '\u0001');
  t = t.replace(/<[^>]+>/g, '');
  const { document } = parseHTML('<textarea>' + t.replace(/</g, '&lt;') + '</textarea>');
  t = document.querySelector('textarea').textContent;
  return t.split('\u0001').map((l) => l.split(/\s+/).filter(Boolean).join(' ')).filter(Boolean);
}

/** Known, documented text differences (see docs/conversion-report.md). */
const ALLOWED = {
  '/legal-clinic/intake/': [
    ['If you need legal help today, call 855‑LGBT‑LAW.', 'If you aren’t able to complete this form, you can give us a call at 855‑LGBT‑LAW and leave us a message. Please note that we return voicemails on Tuesday and Thursday each week.'],
    ['Need help right now? Call 855‑LGBT‑LAW.', 'If you aren’t able to complete this form, you can give us a call at 855‑LGBT‑LAW and leave us a message. Please note that we return voicemails on Tuesday and Thursday each week.'],
  ],
};

function expectedMain(rec) {
  const src = sourcePages.find((p) => p.wp_path === rec.path);
  const html = readFileSync(join(root, 'source', src.content_file), 'utf8');
  const { document } = parseHTML(`<div id="r">${html}</div>`);
  const r = document.getElementById('r');
  for (const el of [...r.querySelectorAll('[data-expires]')]) if (el.getAttribute('data-expires') < TODAY) el.remove();
  return { src, html: r.innerHTML, dom: r };
}

async function fetchPage(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  assert.equal(res.status, 200, `${path} should answer 200 (got ${res.status})`);
  const html = await res.text();
  const { document } = parseHTML(html);
  const main = document.querySelector('main#main');
  assert.ok(main, `${path}: one <main id="main">`);
  return { html, document, main };
}

for (const rec of registry) {
  test(`parity ${rec.path}`, async () => {
    const { src, html: expHtml, dom: expDom } = expectedMain(rec);
    const { document, main } = await fetchPage(rec.path);

    // 1. Visible text of <main>.
    let expected = visibleText(expHtml);
    let actual = visibleText(main.innerHTML);
    for (const [from, to] of ALLOWED[rec.path] || []) {
      expected = expected.map((l) => l.replace(from, to));
    }
    // The hidden form-success blocks and the new-tab notes are script states; both sides carry them identically.
    assert.deepEqual(actual, expected, `${rec.path}: visible text differs`);

    // 2. Outline.
    const heads = [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => [Number(h.tagName[1]), h.textContent.replace(/\s+/g, ' ').trim()]);
    const expHeads = [...expDom.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => [Number(h.tagName[1]), h.textContent.replace(/\s+/g, ' ').trim()]);
    assert.deepEqual(heads, expHeads, `${rec.path}: headings differ`);
    assert.equal(document.querySelectorAll('h1').length, 1, `${rec.path}: exactly one h1 on the page`);
    let prev = 1;
    for (const [lvl] of heads) { assert.ok(lvl <= prev + 1, `${rec.path}: heading level skipped (${prev} → ${lvl})`); prev = lvl; }

    // 3. Anchors.
    // Every id the source still has (ids inside dropped expired blocks are gone with them).
    const expIds = [...expDom.querySelectorAll('[id]')].map((e) => e.id);
    for (const id of expIds) assert.ok(main.querySelector(`#${CSS_escape(id)}`), `${rec.path}: missing anchor #${id}`);
    for (const id of src.anchor_ids) if (expIds.includes(id)) assert.ok(main.querySelector(`#${CSS_escape(id)}`));

    // 4. Links: same external URLs with rel/target; internal links in trailing-slash form.
    const extActual = [...main.querySelectorAll('a[href^="http"]')].map((a) => a.getAttribute('href')).filter((h) => !h.startsWith(BASE)).sort();
    const extExpected = [...expDom.querySelectorAll('a[href^="http"]')].map((a) => a.getAttribute('href')).sort();
    assert.deepEqual(extActual, extExpected, `${rec.path}: external links differ`);
    for (const a of main.querySelectorAll('a[href^="http"]')) {
      if (a.getAttribute('href').startsWith(BASE)) continue;
      assert.equal(a.getAttribute('target'), '_blank', `${rec.path}: ${a.getAttribute('href')} target`);
      assert.match(a.getAttribute('rel') || '', /noopener/, `${rec.path}: ${a.getAttribute('href')} rel`);
    }
    for (const a of main.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (/^(https?:|mailto:|tel:|#)/.test(href)) {
        if (/^tel:/.test(href)) assert.match(href, /^tel:\+1\d{10}$/, `${rec.path}: ${href}`);
        continue;
      }
      const u = new URL(href, BASE);
      assert.ok(u.pathname === '/' || u.pathname.endsWith('/'), `${rec.path}: internal link without trailing slash: ${href}`);
      assert.ok(!u.pathname.endsWith('.html'), `${rec.path}: .html link ${href}`);
    }
    // Staging notes carry the one class.
    const notes = main.querySelectorAll('.eo-staging-note').length;
    assert.equal(notes, (src.staging_copy_lines || []).length, `${rec.path}: ${notes} staging notes marked, ${src.staging_copy_lines.length} expected`);
  });
}

test('internal links answer 200 without a redirect', async () => {
  const seen = new Set();
  const problems = [];
  for (const rec of registry) {
    const { main } = await fetchPage(rec.path);
    for (const a of main.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (/^(https?:|mailto:|tel:|#)/.test(href) && !href.startsWith(BASE)) continue;
      const u = new URL(href, BASE);
      if (seen.has(u.pathname)) continue;
      seen.add(u.pathname);
      const res = await fetch(u.origin + u.pathname, { redirect: 'manual' });
      if (res.status !== 200) problems.push(`${rec.path} → ${u.pathname}: ${res.status}`);
    }
  }
  assert.deepEqual(problems, []);
});

function CSS_escape(s) { return s.replace(/([^a-zA-Z0-9_-])/g, '\\$1'); }
