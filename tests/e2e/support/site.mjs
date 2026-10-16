/**
 * tests/e2e/support/site.mjs
 * --------------------------
 * What the specs test, derived from the repo so new pages and redirects are
 * covered without editing a list:
 *
 *   PAGES / SITE_PAGES   lib/static-pages.mjs (SITE_PAGES excludes the gate)
 *   redirectCases()      next.config.mjs redirects(), each with a concrete
 *                        sample path and the Location it must answer
 *   legacyGroups()       docs/legacy-sitemap-urls.txt, grouped by family
 *   MOCK_FORM_PAGES      pages that carry a form[data-mock="true"]
 *
 * plus the page helpers the specs share (scrolling, settling, axe output).
 */
import { readFileSync } from 'node:fs';
import { staticPages } from '../../../lib/static-pages.mjs';
import { find, findAll, parseHtml } from '../../../scripts/check-links.mjs';
import {
  applyParams,
  loadRedirects,
  normalizeLegacyPath,
  readSnapshot,
  samplePath,
  statusFor,
} from '../../../scripts/check-redirects.mjs';

export const PAGES = staticPages();
export const SITE_PAGES = PAGES.filter((p) => p.url !== '/gate');
export const NOT_FOUND_PATH = '/this-page-does-not-exist';

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1280, height: 800 };
export const VIEWPORTS = [PHONE, DESKTOP];

/** The pages with a mock form, and that form's accessible label. */
export const MOCK_FORM_PAGES = PAGES.flatMap((p) => {
  const doc = parseHtml(readFileSync(p.abs, 'utf8'));
  const forms = findAll(doc, (el) => el.name === 'form' && el.attrs['data-mock'] === 'true');
  return forms.map((form, index) => ({ url: p.url, index, label: form.attrs['aria-label'] || `form ${index + 1}` }));
});

/** Ids present in a static page's HTML (for #anchor checks on redirects). */
export function pageHasId(url, id) {
  const page = PAGES.find((p) => p.url === url);
  if (!page) return false;
  return Boolean(find(parseHtml(readFileSync(page.abs, 'utf8')), (el) => el.attrs.id === id));
}

/**
 * Every redirect rule as a request to make and the answer to expect:
 *   { source, request, status, location: { pathname, hash } }
 */
export async function redirectCases() {
  const rules = await loadRedirects();
  return rules.map((rule, i) => {
    const { path, params } = samplePath(rule.source);
    const dest = new URL(applyParams(rule.destination, params), 'http://placeholder.invalid');
    return {
      n: i + 1,
      source: rule.source,
      request: path,
      status: statusFor(rule),
      external: /^https?:\/\//i.test(rule.destination),
      destination: rule.destination,
      location: { pathname: dest.pathname, hash: dest.hash, search: dest.search },
    };
  });
}

/**
 * The live sitemap snapshot grouped into families for readable failures.
 * The two big generated families (municipal-map, worship-database) are
 * sampled; everything else is exercised in full.
 */
export function legacyGroups({ sampleBig = 6 } = {}) {
  const { paths } = readSnapshot();
  const groups = new Map();
  for (const raw of paths) {
    const segments = normalizeLegacyPath(raw).split('/').filter(Boolean);
    const family = segments.length <= 1 ? '(top level)' : `/${segments[0]}/*`;
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(raw);
  }
  for (const [family, list] of groups) {
    // Only the generated directory families (one page per city or
    // congregation, all on one rule) are sampled; every other path is
    // requested.
    if (family !== '(top level)' && list.length > 40) {
      const step = Math.ceil(list.length / sampleBig);
      groups.set(family, list.filter((_, i) => i % step === 0));
    }
  }
  return groups;
}

/* ---------------------------------------------------------------------------
 * Page helpers
 * ------------------------------------------------------------------------- */

/** Scroll top to bottom in steps (lets scroll-reveal observers fire). */
export async function scrollThrough(page, { step = 0.6, pause = 60 } = {}) {
  await page.evaluate(
    async ({ step, pause }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const by = Math.max(200, Math.round(window.innerHeight * step));
      for (let y = 0; y <= document.documentElement.scrollHeight; y += by) {
        window.scrollTo(0, y);
        await wait(pause);
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await wait(pause);
    },
    { step, pause },
  );
}

/** Fonts loaded and every finite animation or transition finished. */
export async function settle(page, { timeout = 5_000 } = {}) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => {
          const end = a.effect?.getComputedTiming?.().endTime;
          return a.playState !== 'running' || end === Infinity;
        }),
      null,
      { timeout, polling: 100 },
    )
    .catch(() => {});
}

/** axe violations as readable text, one block per rule with its nodes. */
export function describeViolations(violations) {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 12)
        .map((node) => {
          const summary = (node.failureSummary || '').replace(/\n/g, '\n        ');
          return `    target: ${node.target.join(' ')}\n      html: ${node.html.slice(0, 160)}\n        ${summary}`;
        })
        .join('\n');
      const more = v.nodes.length > 12 ? `\n    ... and ${v.nodes.length - 12} more node(s)` : '';
      return `${v.id} [${v.impact ?? 'n/a'}] ${v.help} (${v.nodes.length} node(s))\n  ${v.helpUrl}\n${nodes}${more}`;
    })
    .join('\n\n');
}

/** Parse a Content-Security-Policy header into { directive: [tokens] }. */
export function parseCsp(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const [name, ...tokens] = part.trim().split(/\s+/);
    if (name) out[name.toLowerCase()] = tokens;
  }
  return out;
}
