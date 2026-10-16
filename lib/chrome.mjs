/* =============================================================================
 * lib/chrome.mjs: the site header and footer, rendered once at build time.
 *
 * The header (skip link, preview ribbon, equality bar, dropdown nav) and the
 * footer used to be injected by public/js/eo-site-template.js after
 * DOMContentLoaded. That left the served HTML with no navigation, no skip link
 * and no footer for anything that did not run JavaScript, shifted the whole
 * page down when the header arrived, and trapped the sticky header inside its
 * mount div (a sticky box cannot leave its parent, so it scrolled away).
 *
 * Now the markup is written into every page between region markers by
 * scripts/build-pages.mjs, and server-rendered into the branded 404 by
 * pages/404.js. The browser script only wires behavior.
 *
 *   headerHTML(pageId)  skip link, ribbon, equality bar and <header>, emitted
 *                       as DIRECT children of <body> so position: sticky
 *                       is bounded by the body, not by a wrapper div
 *   footerHTML(pageId)  the phone help bar (pages in HELP_BAR_PAGES only),
 *                       then the <footer>
 *
 * pageId is the page's <body data-page="..."> value; it decides which nav
 * item carries aria-current. KNOWN_PAGE_IDS is every valid value, so a typo
 * in data-page fails `npm run check:pages` instead of silently losing the
 * current-page highlight.
 *
 * Editing the nav or footer: change this file, then run `npm run pages:build`.
 * The generated regions in public/**\/*.html are never edited by hand.
 * ========================================================================== */

import { LAUNCHED, ORG } from './site.mjs';

/* -- Navigation model -------------------------------------------------------
 * `page` matches <body data-page="...">. A section header is marked current
 * when its own page or any child's page matches. */
export const NAV_ITEMS = [
  {
    label: 'Legal Clinic', href: '/legal-clinic', page: 'legal-clinic',
    children: [
      { href: '/legal-clinic',                             page: 'legal-clinic',           label: 'About the Clinic' },
      { href: '/legal-clinic/intake',                      page: 'legal-clinic-intake',    label: 'Start an Intake' },
      { href: '/legal-clinic/ohio-lgbtq-family-law-guide', page: 'family-law-guide',       label: 'Ohio LGBTQ+ Family Law Guide' },
      { href: '/legal-clinic/trans-know-your-rights',      page: 'trans-know-your-rights', label: 'Trans Know Your Rights' },
      { href: '/legal-clinic/legal-network',               page: 'legal-network',          label: 'Legal Network for Attorneys' },
    ],
  },
  {
    label: 'Our Work', href: '/our-work', page: 'our-work',
    children: [
      { href: '/our-work',                     page: 'our-work',       label: 'What We Do' },
      { href: '/our-work/local',               page: 'our-work-local', label: 'Local Progress' },
      { href: '/our-work/local/municipal-map', page: 'municipal-map',  label: 'Municipal Equality Map' },
      { href: '/our-work/business',            page: 'business',       label: 'Business Engagement' },
      { href: '/our-work/legacy-of-equality',  page: 'legacy',         label: 'Legacy of Equality' },
      { href: '/votersguide',                  page: 'votersguide',    label: 'Voters Guide' },
    ],
  },
  {
    label: 'Get Involved', href: '/get-involved', page: 'get-involved',
    children: [
      { href: '/get-involved',           page: 'get-involved', label: 'Ways to Get Involved' },
      { href: '/get-involved/volunteer', page: 'volunteer',    label: 'Volunteer' },
      { href: '/get-involved/events',    page: 'events',       label: 'Events' },
      { href: '/stories',                page: 'stories',      label: 'Share Your Story' },
      { href: '/newsletter',             page: 'newsletter',   label: 'Newsletter' },
    ],
  },
  {
    label: 'About', href: '/about', page: 'about',
    children: [
      { href: '/about',                  page: 'about',      label: 'Mission & Values' },
      { href: '/about/history',          page: 'history',    label: 'Our History' },
      { href: '/about/leadership',       page: 'leadership', label: 'Board of Directors' },
      { href: '/about/staff-interns',    page: 'staff',      label: 'Staff & Interns' },
      { href: '/about/jobs-internships', page: 'jobs',       label: 'Jobs & Internships' },
      { href: '/contact',                page: 'contact',    label: 'Contact' },
    ],
  },
  { label: 'News & Policy', href: '/news', page: 'news' },
];

/* Page ids that are not in the nav model but are valid data-page values:
 * the home page, the Donate CTA (give), the footer's legal pages (privacy,
 * terms), the staging gate, and the 404. */
const EXTRA_PAGE_IDS = ['home', 'give', 'privacy', 'terms', 'gate', 'not-found'];

export const KNOWN_PAGE_IDS = new Set([
  ...NAV_ITEMS.flatMap((item) => [item.page, ...(item.children || []).map((c) => c.page)]),
  ...EXTRA_PAGE_IDS,
]);

/* -- Brand marks --------------------------------------------------------------
 * Official Equality Ohio logo artwork (from equalityohio.org). The footer
 * reuses the same file, inverted to white via CSS filter. */
const LOGO_IMG =
  '<img class="brand-lockup__img" src="/assets/logo/equality-ohio-logo.png" alt="Equality Ohio" width="400" height="174" />';
const LOGO_IMG_WHITE =
  '<img class="brand-lockup__img brand-lockup__img--invert" src="/assets/logo/equality-ohio-logo.png" alt="Equality Ohio" width="400" height="174" />';

/* Official GuideStar Silver Transparency 2021 seal (from equalityohio.org). */
const GUIDESTAR_BADGE =
  '<img src="/assets/logo/guidestar-silver-2021.png" alt="GuideStar Silver Transparency 2021" width="54" height="54" loading="lazy" />';

const CARET =
  '<svg width="10" height="7" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M1 1.5 L5 5.5 L9 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '</svg>';

const MENU_ICON =
  '<svg class="icon-menu" width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<rect width="22" height="2.5" rx="1.25" fill="currentColor"/>' +
  '<rect y="6.75" width="22" height="2.5" rx="1.25" fill="currentColor"/>' +
  '<rect y="13.5" width="22" height="2.5" rx="1.25" fill="currentColor"/>' +
  '</svg>';

/* Shown instead of MENU_ICON while the phone menu is open (CSS swaps them on
 * the toggle's aria-expanded). */
const CLOSE_ICON =
  '<svg class="icon-close" width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M5 2 L17 14 M17 2 L5 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
  '</svg>';

/* Visually hidden, so screen-reader users hear that a link leaves the tab.
 * The same span (class new-tab-note) is what /js/eo-site-template.js adds to
 * page links, and it skips any link that already has one. */
export const NEW_TAB_NOTE = '<span class="sr-only new-tab-note"> (opens in a new tab)</span>';

/** Escape text for an HTML text node or a double-quoted attribute. */
const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Join [depth, html] pairs into indented lines (two spaces per level). */
const block = (rows) => rows.map(([depth, html]) => '  '.repeat(depth) + html).join('\n');

function isCurrent(item, page) {
  if (item.page === page) return true;
  return (item.children || []).some((c) => c.page === page);
}

/* -- Header -------------------------------------------------------------------
 * Line breaks fall only between elements whose parent is a block or flex
 * container, so the whitespace they add renders as nothing: the markup paints
 * exactly like the old single-string injection. */
export function headerHTML(pageId = '') {
  const current = String(pageId || '');
  const rows = [];
  rows.push([0, '<a class="skip-link" href="#main">Skip to main content</a>']);
  if (!LAUNCHED) {
    rows.push([0, '<aside class="preview-ribbon" aria-label="Preview notice">Design preview — <strong>staging only</strong>, forms and donations are not live · Prepared by Joseph Carter Group</aside>']);
  }
  rows.push([0, '<div class="equality-bar" aria-hidden="true"></div>']);
  rows.push([0, '<header class="site-header">']);
  rows.push([1, '<div class="nav-inner">']);
  rows.push([2, `<a class="brand-lockup" href="/" aria-label="Equality Ohio home">${LOGO_IMG}</a>`]);
  rows.push([2, `<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${MENU_ICON}${CLOSE_ICON}</button>`]);
  rows.push([2, '<nav class="site-nav" id="site-nav" aria-label="Primary">']);
  rows.push([3, '<ul>']);
  for (const item of NAV_ITEMS) {
    const sectionCurrent = isCurrent(item, current);
    const topCur = sectionCurrent ? ` aria-current="${item.page === current ? 'page' : 'true'}"` : '';
    if (!item.children) {
      rows.push([4, `<li><a href="${item.href}"${topCur}>${esc(item.label)}</a></li>`]);
      continue;
    }
    const subId = `sub-${item.page}`;
    rows.push([4, '<li class="has-sub">']);
    rows.push([5, '<div class="nav-item-row">' +
      `<a href="${item.href}"${topCur}>${esc(item.label)}</a>` +
      `<button class="sub-toggle" type="button" aria-expanded="false" aria-controls="${subId}" aria-label="${esc(item.label)} submenu">${CARET}</button>` +
      '</div>']);
    rows.push([5, `<ul class="sub-menu" id="${subId}">`]);
    for (const c of item.children) {
      const cur = c.page === current ? ' aria-current="page"' : '';
      rows.push([6, `<li><a href="${c.href}"${cur}>${esc(c.label)}</a></li>`]);
    }
    rows.push([5, '</ul>']);
    rows.push([4, '</li>']);
  }
  rows.push([4, `<li class="nav-cta"><a href="/give"${current === 'give' ? ' aria-current="page"' : ''}>Donate</a></li>`]);
  rows.push([3, '</ul>']);
  rows.push([2, '</nav>']);
  rows.push([1, '</div>']);
  rows.push([0, '</header>']);
  return block(rows);
}

/* -- Footer ------------------------------------------------------------------- */
const FOOTER_COLUMNS = [
  {
    heading: 'Legal Clinic',
    links: [
      ['/legal-clinic', 'About the Clinic'],
      ['/legal-clinic/intake', 'Start an Intake'],
      ['/legal-clinic/ohio-lgbtq-family-law-guide', 'Family Law Guide'],
      ['/legal-clinic/trans-know-your-rights', 'Trans Know Your Rights'],
      ['/legal-clinic/legal-network', 'Legal Network'],
      [`tel:${ORG.clinicPhone.tel}`, ORG.clinicPhone.display],
    ],
  },
  {
    heading: 'Our Work',
    links: [
      ['/our-work', 'What We Do'],
      ['/our-work/local', 'Local Progress'],
      ['/our-work/local/municipal-map', 'Municipal Equality Map'],
      ['/our-work/business', 'Business Engagement'],
      ['/our-work/legacy-of-equality', 'Legacy of Equality'],
      ['/votersguide', 'Voters Guide'],
    ],
  },
  {
    heading: 'Get Involved',
    links: [
      ['/give', 'Ways to Give'],
      ['/give#defenders', 'Defenders of Equality'],
      ['/jim-obergefell-john-arthur-society', 'Obergefell–Arthur Society'],
      ['/get-involved/volunteer', 'Volunteer'],
      ['/get-involved/events', 'Events'],
      ['/newsletter', 'Newsletter'],
    ],
  },
  {
    heading: 'About',
    links: [
      ['/about', 'Mission & Values'],
      ['/about/history', 'Our History'],
      ['/about/leadership', 'Board of Directors'],
      ['/about/staff-interns', 'Staff & Interns'],
      ['/about/jobs-internships', 'Jobs & Internships'],
      ['/news', 'News & Policy'],
      ['/contact', 'Contact'],
    ],
  },
];

/* External links open in a new tab with rel="noopener" (authoring
 * conventions), so the social links carry both, plus the visually hidden
 * new-tab note. */
const external = (url, label) =>
  `<a href="${esc(url)}" rel="noopener" target="_blank">${esc(label)}${NEW_TAB_NOTE}</a>`;

/* "Legal Clinic" -> "legal-clinic", for the footer heading ids. */
const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* -- Phone help bar ------------------------------------------------------------
 * Pages (by <body data-page>) that get the sticky Legal Clinic help bar on
 * phones: the clinic page and the two long guides people read in a hurry.
 * Not the intake (it is the destination) and not the attorney network page.
 * The bar is prerendered with the footer, so it works without JavaScript;
 * /js/eo-site-template.js only slides it away while an on-page clinic
 * callout ([data-cta]) is on screen, and makes it inert while the phone menu
 * is open. Both labels are the site's existing ones. */
export const HELP_BAR_PAGES = new Set(['legal-clinic', 'trans-know-your-rights', 'family-law-guide']);

export function helpBarHTML() {
  const call = ORG.clinicPhone.display.replace(/-/g, '&#8209;');
  return block([
    [0, '<aside class="help-bar" aria-label="Legal Clinic quick help">'],
    [1, `<a class="help-bar__call" href="tel:${ORG.clinicPhone.tel}">Call ${call}</a>`],
    [1, '<a class="btn btn--on-dark" href="/legal-clinic/intake">Start an Intake</a>'],
    [0, '</aside>'],
  ]);
}

export function footerHTML(pageId = '') {
  const year = new Date().getFullYear();
  const rows = [];
  if (HELP_BAR_PAGES.has(String(pageId || ''))) rows.push([0, helpBarHTML()]);
  rows.push([0, '<footer class="site-footer">']);
  rows.push([1, '<div class="equality-bar" aria-hidden="true"></div>']);
  rows.push([1, '<div class="footer-main">']);
  rows.push([2, '<div class="footer-brand">']);
  rows.push([3, `<a class="brand-lockup" href="/" aria-label="Equality Ohio home">${LOGO_IMG_WHITE}</a>`]);
  rows.push([3, '<p class="mt-1">Ohio’s statewide LGBTQ+ advocacy and legal aid organization — working toward an Ohio where justice, dignity, and self-determination belong to everyone.</p>']);
  rows.push([3, '<ul class="footer-contact">']);
  rows.push([4, `<li><a href="tel:${ORG.phone.tel}">${ORG.phone.display}</a></li>`]);
  rows.push([4, `<li><a href="mailto:${ORG.email}">${ORG.email}</a></li>`]);
  if (ORG.socials.length) {
    rows.push([4, `<li class="footer-social">${ORG.socials.map((s) => external(s.url, s.label)).join(' · ')}</li>`]);
  }
  rows.push([3, '</ul>']);
  rows.push([2, '</div>']);
  /* Each column is a navigation landmark named by its heading. The headings
   * are h2s (page content never goes deeper than the footer starts), styled
   * as small labels by .footer-heading. */
  for (const col of FOOTER_COLUMNS) {
    const id = `footer-${slug(col.heading)}`;
    rows.push([2, `<nav class="footer-col" aria-labelledby="${id}">`]);
    rows.push([3, `<h2 class="footer-heading" id="${id}">${esc(col.heading)}</h2>`]);
    rows.push([3, '<ul>']);
    for (const [href, label] of col.links) rows.push([4, `<li><a href="${href}">${esc(label)}</a></li>`]);
    rows.push([3, '</ul>']);
    rows.push([2, '</nav>']);
  }
  rows.push([1, '</div>']);
  rows.push([1, '<div class="footer-legal">']);
  rows.push([2, '<div class="footer-legal__inner">']);
  rows.push([3, `<span class="footer-badge">${GUIDESTAR_BADGE}` +
    `<span>${esc(ORG.c3.name)} is a 501(c)(3) — EIN ${ORG.c3.ein} · ${esc(ORG.c4.name)} is a 501(c)(4) — EIN ${ORG.c4.ein}</span>` +
    '</span>']);
  const credit = LAUNCHED ? '' : ' · Design preview by Joseph Carter Group';
  rows.push([3, `<span>© ${year} Equality Ohio · <a href="/privacy-policy">Privacy Policy</a> · <a href="/terms-conditions">Terms &amp; Conditions</a>${credit}</span>`]);
  rows.push([2, '</div>']);
  rows.push([1, '</div>']);
  rows.push([0, '</footer>']);
  return block(rows);
}
