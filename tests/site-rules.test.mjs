/**
 * tests/site-rules.test.mjs
 * -------------------------
 * The authoring conventions (docs/authoring-conventions.md) as tests, over
 * every static page under public/ (lib/static-pages.mjs). No server.
 *
 *   - <body data-page> names a known page id (lib/chrome.mjs KNOWN_PAGE_IDS)
 *   - exactly one <h1>
 *   - every <img> has alt, width and height (no layout shift)
 *   - no inline executable <script> and no third-party script: the static
 *     pages are served with script-src 'self' (JSON-LD data blocks are fine)
 *   - no inline event handler attributes (onclick=...)
 *   - every form[data-mock="true"] has its .form-success; any other form
 *     posts somewhere explicit
 *   - the generated regions are in place: the seo region in <head>; the
 *     chrome header region first in <body> (header a direct child of body,
 *     so it can stick) and the footer region (public/gate.html: seo only)
 *   - self-links to equalityohio.org and /wp-content/ media: listed as a
 *     warning while lib/site.mjs LAUNCHED is false, a failure once it is
 *     true (at launch those URLs are this site, so each one is a loop or a
 *     404 unless it has been replaced)
 *   - every tel: and mailto: (pages and chrome) is an organization fact from
 *     lib/site.mjs ORG or on the explicit allowlist below, and a tel: link
 *     whose text is a phone number dials that number (keypad letters count:
 *     855-LGBT-LAW is 18555428529)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { KNOWN_PAGE_IDS, footerHTML, headerHTML } from '../lib/chrome.mjs';
import { LAUNCHED, ORG } from '../lib/site.mjs';
import { staticPages } from '../lib/static-pages.mjs';
import {
  cleanText,
  elements,
  find,
  findAll,
  hasClass,
  parseHtml,
  refsOf,
} from '../scripts/check-links.mjs';

/* ---------------------------------------------------------------------------
 * Allowlists, declared from the pages as they stand on 2026-10-16. Anything
 * new must be added here on purpose (or, for EO's own numbers and inboxes,
 * to lib/site.mjs ORG).
 * ------------------------------------------------------------------------- */

/** Third-party numbers the guides refer people to (digits, leading 1). */
const TEL_ALLOWLIST = new Map([
  ['18774872778', 'U.S. Department of State passport information (trans-know-your-rights)'],
  ['18888747793', 'U.S. Department of State TDD/TTY (trans-know-your-rights)'],
  ['16144662531', 'Ohio BMV (trans-know-your-rights)'],
  ['18667086446', 'Trans Care Warmline, 866-70-TOHIO (trans-know-your-rights)'],
  ['18666878683', 'Election Protection Hotline, 866-OUR-VOTE (votersguide)'],
]);

/** Equality Ohio inboxes printed on the pages besides ORG.email. */
const MAILTO_ALLOWLIST = new Map([
  ['developmentstaff@equalityohio.org', 'Development team (contact, give, society, events, legacy)'],
  ['advocacy@equalityohio.org', 'Advocacy team (our-work/local)'],
  ['legalclinic@equalityohio.org', 'Legal Clinic inbox (trans-know-your-rights)'],
  ['paralegal@equalityohio.org', 'Clinic paralegal (intake thank-you)'],
  ['kim@equalityohio.org', 'Kim Welter, staff card (staff-interns)'],
  ['mary@equalityohio.org', 'Mary Zaller, staff card (staff-interns)'],
]);

const NO_CHROME = new Set(['/gate']);

/* ------------------------------------------------------------------------- */

const pages = staticPages().map((p) => {
  const html = readFileSync(p.abs, 'utf8');
  return { ...p, html, doc: parseHtml(html), where: `public${p.file}` };
});
const chromeDocs = [
  { where: 'lib/chrome.mjs headerHTML()', doc: parseHtml(headerHTML('')) },
  { where: 'lib/chrome.mjs footerHTML()', doc: parseHtml(footerHTML()) },
];

const digitsOf = (tel) => tel.replace(/^tel:/i, '').replace(/\D/g, '');
const normalizeTel = (digits) => (digits.length === 10 ? `1${digits}` : digits);
const ORG_TELS = new Map([
  [normalizeTel(digitsOf(ORG.phone.tel)), `ORG.phone (${ORG.phone.display})`],
  [normalizeTel(digitsOf(ORG.clinicPhone.tel)), `ORG.clinicPhone (${ORG.clinicPhone.display})`],
]);
const ORG_EMAILS = new Set([ORG.email.toLowerCase()]);

/* Phone keypad letters, for vanity numbers. */
const KEYPAD = Object.fromEntries(
  ['ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'].flatMap((letters, i) =>
    [...letters].map((ch) => [ch, String(i + 2)]),
  ),
);
/** Digits a phone-number link text dials, or null when the text is not a number. */
function dialedDigits(text) {
  const t = text.replace(/[‐-―−]/g, '-').trim();
  if (!/^[\s()+.\-0-9A-Z]+$/.test(t) || (t.match(/\d/g) || []).length < 3) return null;
  return normalizeTel([...t].map((ch) => (/\d/.test(ch) ? ch : KEYPAD[ch] || '')).join(''));
}

function report(problems) {
  assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}`);
}

/* ------------------------------------------------------------------------- */

test('every page declares a known <body data-page>', () => {
  const problems = [];
  for (const p of pages) {
    const body = find(p.doc, (el) => el.name === 'body');
    if (!body) problems.push(`${p.where}: no <body>`);
    else if (!('data-page' in body.attrs)) problems.push(`${p.where}: <body> has no data-page`);
    else if (!KNOWN_PAGE_IDS.has(body.attrs['data-page'])) {
      problems.push(`${p.where}: data-page="${body.attrs['data-page']}" is not in lib/chrome.mjs KNOWN_PAGE_IDS`);
    }
  }
  report(problems);
});

test('every page has exactly one <h1>', () => {
  const problems = [];
  for (const p of pages) {
    const h1s = findAll(p.doc, (el) => el.name === 'h1');
    if (h1s.length !== 1) problems.push(`${p.where}: ${h1s.length} <h1> elements (lines ${h1s.map((h) => h.line).join(', ') || 'none'})`);
    else if (!cleanText(h1s[0])) problems.push(`${p.where}: the <h1> (line ${h1s[0].line}) is empty`);
  }
  report(problems);
});

test('every <img> has alt, width and height', () => {
  const problems = [];
  for (const p of [...pages, ...chromeDocs]) {
    for (const img of findAll(p.doc, (el) => el.name === 'img')) {
      const missing = ['alt', 'width', 'height'].filter((a) => !(a in img.attrs));
      const bad = ['width', 'height'].filter((a) => a in img.attrs && !/^\d+$/.test(img.attrs[a]));
      if (missing.length) problems.push(`${p.where} line ${img.line}: <img src="${img.attrs.src}"> has no ${missing.join(', ')}`);
      if (bad.length) problems.push(`${p.where} line ${img.line}: <img src="${img.attrs.src}"> ${bad.join(', ')} must be whole pixels`);
    }
  }
  report(problems);
});

test("no inline or third-party scripts (pages are served with script-src 'self')", () => {
  const problems = [];
  const DATA_TYPES = new Set(['application/ld+json', 'application/json']);
  for (const p of [...pages, ...chromeDocs]) {
    for (const script of findAll(p.doc, (el) => el.name === 'script')) {
      const type = (script.attrs.type || '').trim().toLowerCase();
      if ('src' in script.attrs) {
        if (!script.attrs.src.startsWith('/') || script.attrs.src.startsWith('//')) {
          problems.push(`${p.where} line ${script.line}: <script src="${script.attrs.src}"> is not same-origin`);
        }
        const body = script.children.map((c) => c.text || '').join('').trim();
        if (body) problems.push(`${p.where} line ${script.line}: <script src> with inline content`);
      } else if (!DATA_TYPES.has(type)) {
        problems.push(`${p.where} line ${script.line}: inline <script${type ? ` type="${type}"` : ''}> is blocked by script-src 'self'; move it to /js/`);
      }
    }
  }
  report(problems);
});

test('no inline event handler attributes', () => {
  const problems = [];
  for (const p of [...pages, ...chromeDocs]) {
    for (const el of elements(p.doc)) {
      const handlers = Object.keys(el.attrs).filter((a) => /^on[a-z]+$/.test(a));
      if (handlers.length) problems.push(`${p.where} line ${el.line}: <${el.name} ${handlers.join(' ')}> (wire it in /js/ instead)`);
    }
  }
  report(problems);
});

test('every mock form has its .form-success, and real forms post somewhere explicit', () => {
  const problems = [];
  let mockForms = 0;
  for (const p of pages) {
    for (const form of findAll(p.doc, (el) => el.name === 'form')) {
      const label = `${p.where} line ${form.line}: <form${form.attrs['aria-label'] ? ` aria-label="${form.attrs['aria-label']}"` : ''}>`;
      if (form.attrs['data-mock'] !== 'true') {
        if (!form.attrs.action) problems.push(`${label} is neither data-mock="true" nor has an action`);
        continue;
      }
      mockForms += 1;
      const targetId = form.attrs['data-success'];
      if (targetId) {
        const target = find(p.doc, (el) => el.attrs.id === targetId);
        if (!target || !hasClass(target, 'form-success')) problems.push(`${label} data-success="${targetId}" is not a .form-success element`);
        continue;
      }
      // Same lookup as the site script: form.parentElement.querySelector('.form-success').
      if (!find(form.parent, (el) => hasClass(el, 'form-success'))) {
        problems.push(`${label} has no .form-success in its parent (or a data-success="id" target)`);
      }
    }
  }
  assert.ok(mockForms > 0, 'expected at least one form[data-mock="true"] on the site');
  report(problems);
});

test('every page carries the generated regions (seo; chrome header first in <body>, footer)', () => {
  const problems = [];
  const once = (html, marker) => html.split(marker).length - 1;
  for (const p of pages) {
    const { html, where } = p;
    const headStart = html.search(/<head\b/i);
    const headEnd = html.search(/<\/head>/i);
    const seoStart = html.indexOf('<!-- seo:start -->');
    const seoEnd = html.indexOf('<!-- seo:end -->');
    if (once(html, '<!-- seo:start -->') !== 1 || once(html, '<!-- seo:end -->') !== 1) {
      problems.push(`${where}: want exactly one <!-- seo:start --> ... <!-- seo:end --> region`);
    } else if (!(headStart < seoStart && seoStart < seoEnd && seoEnd < headEnd)) {
      problems.push(`${where}: the seo region is not inside <head>`);
    }

    const markers = ['header:start', 'header:end', 'footer:start', 'footer:end'].map((m) => `<!-- chrome:${m} -->`);
    const legacyMount = /<div\s+data-site-(?:header|footer)\b/i.test(html.replace(/<!--[\s\S]*?-->/g, ''));
    if (legacyMount) problems.push(`${where}: legacy <div data-site-header/footer> mount left in the page (run npm run pages:build)`);

    if (NO_CHROME.has(p.url)) {
      if (markers.some((m) => html.includes(m))) problems.push(`${where}: carries chrome regions, but it is a no-chrome page`);
      continue;
    }
    if (markers.some((m) => once(html, m) !== 1)) {
      problems.push(`${where}: want exactly one of each chrome region marker (${markers.join(' ')})`);
      continue;
    }
    const [hs, he, fs, fe] = markers.map((m) => html.indexOf(m));
    const bodyOpen = html.match(/<body\b(?:[^>"']|"[^"]*"|'[^']*')*>/i);
    if (!bodyOpen) {
      problems.push(`${where}: no <body>`);
      continue;
    }
    const between = html.slice(bodyOpen.index + bodyOpen[0].length, hs);
    if (between.trim()) problems.push(`${where}: the chrome header region is not the first thing in <body> (found ${JSON.stringify(between.trim().slice(0, 40))})`);
    if (!(hs < he && he < fs && fs < fe)) problems.push(`${where}: chrome regions are out of order`);
    const mainClose = html.search(/<\/main>/i);
    if (mainClose === -1 || fs < mainClose) problems.push(`${where}: the footer region does not follow </main>`);

    const header = find(p.doc, (el) => el.name === 'header' && hasClass(el, 'site-header'));
    if (!header) problems.push(`${where}: no <header class="site-header"> in the page`);
    else if (header.parent?.name !== 'body') problems.push(`${where}: <header class="site-header"> is inside <${header.parent?.name}>, not a direct child of <body> (position: sticky would be trapped)`);
    const footer = find(p.doc, (el) => el.name === 'footer' && hasClass(el, 'site-footer'));
    if (!footer) problems.push(`${where}: no <footer class="site-footer"> in the page`);
  }
  report(problems);
});

test('self-links to equalityohio.org and WordPress media are resolved before launch', (t) => {
  const SELF = /^https?:\/\/(?:www\.)?equalityohio\.org(?=[/?#]|$)/i;
  const WORDPRESS = /\/wp-content\/|wpengine\.com/i;
  const hits = [];
  for (const p of [...pages, ...chromeDocs]) {
    for (const [el, attr, value] of refsOf(p.doc)) {
      if (el.name === 'link' && /\bcanonical\b/i.test(el.attrs.rel || '')) continue;
      if (SELF.test(value) || WORDPRESS.test(value)) hits.push(`${p.where} line ${el.line}: <${el.name} ${attr}="${value}">`);
    }
  }
  if (!LAUNCHED) {
    if (hits.length) {
      console.warn(
        `\n[site-rules] ${hits.length} link(s) to the live WordPress site; they must be replaced before LAUNCHED = true ` +
          `(at launch equalityohio.org is this site, so each becomes a loop or a 404):\n  ${hits.join('\n  ')}\n`,
      );
      t.diagnostic(`${hits.length} self-link(s) to equalityohio.org or /wp-content/ (warning until launch)`);
    }
    return;
  }
  report(hits);
});

test('every tel: and mailto: is an organization fact or allowlisted, and tel: text matches its number', () => {
  const problems = [];
  const usedTel = new Set();
  const usedMail = new Set();
  for (const p of [...pages, ...chromeDocs]) {
    for (const a of findAll(p.doc, (el) => (el.name === 'a' || el.name === 'area') && 'href' in el.attrs)) {
      const href = a.attrs.href.trim();
      const at = `${p.where} line ${a.line}`;
      if (/^tel:/i.test(href)) {
        const digits = normalizeTel(digitsOf(href));
        usedTel.add(digits);
        if (!ORG_TELS.has(digits) && !TEL_ALLOWLIST.has(digits)) {
          problems.push(`${at}: ${href} is neither an ORG phone in lib/site.mjs nor on the TEL_ALLOWLIST in this test`);
        }
        const text = cleanText(a);
        const dialed = dialedDigits(text);
        if (dialed && dialed !== digits) problems.push(`${at}: link text "${text}" dials ${dialed} but the href is ${href}`);
      } else if (/^mailto:/i.test(href)) {
        let addresses;
        try {
          addresses = decodeURIComponent(href.slice(7).split('?')[0]).split(',').map((s) => s.trim().toLowerCase());
        } catch {
          problems.push(`${at}: ${href} is not valid percent-encoding`);
          continue;
        }
        for (const address of addresses) {
          usedMail.add(address);
          if (!ORG_EMAILS.has(address) && !MAILTO_ALLOWLIST.has(address)) {
            problems.push(`${at}: ${address} is neither ORG.email in lib/site.mjs nor on the MAILTO_ALLOWLIST in this test`);
          }
        }
        const text = cleanText(a);
        if (/^[^\s@]+@[^\s@]+$/.test(text) && !addresses.includes(text.toLowerCase())) {
          problems.push(`${at}: link text "${text}" does not match ${href}`);
        }
      }
    }
  }
  const stale = [
    ...[...TEL_ALLOWLIST.keys()].filter((d) => !usedTel.has(d)).map((d) => `tel ${d} (${TEL_ALLOWLIST.get(d)})`),
    ...[...MAILTO_ALLOWLIST.keys()].filter((m) => !usedMail.has(m)).map((m) => `mailto ${m}`),
  ];
  if (stale.length) console.warn(`\n[site-rules] allowlist entries no longer used on any page (remove them):\n  ${stale.join('\n  ')}\n`);
  report(problems);
});

test('the help-bar and chrome contact links use the ORG facts', () => {
  // The footer prints ORG.phone, ORG.clinicPhone and ORG.email: if those are
  // edited in lib/site.mjs, the prerendered footer must follow.
  const footer = footerHTML();
  for (const tel of [ORG.phone.tel, ORG.clinicPhone.tel]) assert.ok(footer.includes(`tel:${tel}`), `footer has no tel:${tel}`);
  assert.ok(footer.includes(`mailto:${ORG.email}`), `footer has no mailto:${ORG.email}`);
  for (const p of pages) {
    for (const bar of findAll(p.doc, (el) => el.name === 'aside' && hasClass(el, 'help-bar'))) {
      const tels = findAll(bar, (el) => el.name === 'a' && /^tel:/i.test(el.attrs.href || ''));
      assert.ok(tels.length > 0, `${p.where} line ${bar.line}: aside.help-bar has no tel: link`);
    }
  }
});
