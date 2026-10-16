/**
 * tests/e2e/routes.spec.mjs
 * -------------------------
 * HTTP behavior of a running build, request by request (no browser, no
 * redirect following unless a test follows hops itself):
 *
 *   static pages   every page answers 200 with the strict page headers:
 *                  Content-Security-Policy script-src exactly 'self',
 *                  frame-ancestors 'none', object-src 'none', base-uri 'self';
 *                  X-Robots-Tag noindex unless the server under test may be
 *                  indexed (support/env.mjs INDEXABLE); no X-Powered-By. The
 *                  trailing-slash spelling 308s to the clean URL.
 *   redirects      every rule in next.config.mjs redirects() (params filled
 *                  with sample values) answers its status (308 permanent,
 *                  307 temporary) with the right Location, signed out, since
 *                  redirects run before the gate
 *   legacy URLs    the live-sitemap snapshot (docs/legacy-sitemap-urls.txt),
 *                  requested as the live site spells it, lands on a 200 page
 *                  and its #anchor
 *   plumbing       /robots.txt (Disallow: / unless INDEXABLE, which only a
 *                  launched production build is), /sitemap.xml,
 *                  /manifest.webmanifest and the branded 404
 *   staging gate   redirects, open paths (exact files only: a missing file
 *                  under an open directory is gated), login, the
 *                  open-redirect defenses (incl. dot segments and every
 *                  spelling of the gate), wrong password, malformed body,
 *                  forged cookie
 *   launched       pages answer signed out and /api/gate is a 404
 *
 * When testing a deployment (PLAYWRIGHT_BASE_URL), a Vercel preview may add
 * https://vercel.live to script-src for the toolbar; that one host is
 * accepted there and nowhere else.
 */
import { randomInt } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
import { OPEN_FILES } from '../../lib/open-files.generated.mjs';
import { isGatePath } from '../../lib/preview-gate.mjs';
import { OPEN_EXACT as OPEN_EXACT_SET, OPEN_PREFIXES } from '../../lib/preview-gate-paths.mjs';
import { LAUNCHED, SITE_URL } from '../../lib/site.mjs';
import { EXTERNAL, GATE_PASSWORD, INDEXABLE, UNAUTHENTICATED } from './support/env.mjs';
import {
  NOT_FOUND_PATH,
  PAGES,
  legacyGroups,
  pageHasId,
  parseCsp,
  redirectCases,
} from './support/site.mjs';

/** `anon`: a request context with no cookies (a first-time visitor). */
const test = base.extend({
  anon: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ storageState: UNAUTHENTICATED });
    await use(context);
    await context.dispose();
  },
});

const seo = await import('../../lib/seo.mjs').catch(() => null);
const isNoindex = (url) => (seo?.pageFor ? Boolean(seo.pageFor(url)?.noindex) : url === '/gate');

const REDIRECTS = await redirectCases();
const STAGING_ROBOTS = 'noindex, nofollow, noarchive';
const resolve = (location, baseURL) => new URL(location, baseURL);
const setCookies = (res) => res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);

function expectPageHeaders(res, label) {
  const headers = res.headers();
  const csp = parseCsp(headers['content-security-policy']);
  const allowed = new Set(["'self'", ...(EXTERNAL ? ['https://vercel.live'] : [])]);
  expect(headers['content-security-policy'], `${label}: Content-Security-Policy`).toBeTruthy();
  expect(csp['script-src'], `${label}: script-src`).toContain("'self'");
  expect(csp['script-src'].filter((t) => !allowed.has(t)), `${label}: script-src must be exactly 'self'`).toEqual([]);
  expect(csp['frame-ancestors'], `${label}: frame-ancestors`).toEqual(["'none'"]);
  expect(csp['object-src'], `${label}: object-src`).toEqual(["'none'"]);
  expect(csp['base-uri'], `${label}: base-uri`).toEqual(["'self'"]);
  expect(headers['x-content-type-options'], `${label}: X-Content-Type-Options`).toBe('nosniff');
  expect(headers['x-powered-by'], `${label}: X-Powered-By must not be sent`).toBeUndefined();
  if (INDEXABLE) expect(headers['x-robots-tag'], `${label}: no X-Robots-Tag on an indexable build`).toBeUndefined();
  else expect(headers['x-robots-tag'], `${label}: X-Robots-Tag (staging, or not production)`).toBe(STAGING_ROBOTS);
}

/* ------------------------------------------------------------------------- */

test.describe('static pages', () => {
  for (const p of PAGES) {
    test(`${p.url} answers 200 with the strict page headers`, async ({ request, baseURL }) => {
      const res = await request.get(p.url, { maxRedirects: 0 });
      expect(res.status(), `GET ${p.url}`).toBe(200);
      expect(res.headers()['content-type'], `${p.url}: content type`).toMatch(/^text\/html/);
      expectPageHeaders(res, p.url);
      expect(await res.text(), `${p.url}: <html lang="en">`).toMatch(/<html[^>]*\blang="en"/i);

      if (p.url !== '/') {
        const slashed = await request.get(`${p.url}/`, { maxRedirects: 0 });
        expect(slashed.status(), `GET ${p.url}/`).toBe(308);
        expect(resolve(slashed.headers().location, baseURL).pathname, `${p.url}/ Location`).toBe(p.url);
      }
    });
  }
});

test.describe('redirects from next.config.mjs', () => {
  for (const r of REDIRECTS) {
    test(`#${r.n} ${r.request} -> ${r.destination} (${r.status})`, async ({ anon, baseURL }) => {
      const res = await anon.get(r.request, { maxRedirects: 0 });
      expect(res.status(), `GET ${r.request} (rule ${r.source})`).toBe(r.status);
      const location = res.headers().location;
      expect(location, `Location for ${r.request}`).toBeTruthy();
      if (r.external) {
        expect(location).toBe(r.destination);
        return;
      }
      const to = resolve(location, baseURL);
      expect(to.origin, `Location for ${r.request} stays on the site`).toBe(new URL(baseURL).origin);
      expect(to.pathname + to.hash, `Location for ${r.request}`).toBe(r.location.pathname + r.location.hash);
      expect(to.search, `Location query for ${r.request}`).toBe(r.location.search);
    });
  }
});

test.describe('legacy equalityohio.org URLs land on a page', () => {
  for (const [family, paths] of legacyGroups()) {
    test(`${family} (${paths.length} paths from the live sitemap)`, async ({ request, baseURL }) => {
      const failures = [];
      for (const start of paths) {
        let url = start;
        let hash = '';
        const hops = [];
        let res;
        for (let hop = 0; hop < 5; hop++) {
          res = await request.get(url, { maxRedirects: 0 });
          if (![301, 302, 303, 307, 308].includes(res.status())) break;
          const next = resolve(res.headers().location, new URL(url, baseURL));
          if (next.hash) hash = next.hash.slice(1);
          hops.push(`${res.status()} ${next.pathname}${next.hash}`);
          url = next.pathname + next.search;
        }
        const trail = [start, ...hops].join(' -> ');
        if (res.status() !== 200) failures.push(`${trail}: ends ${res.status()}`);
        else if (hops.length > 2) failures.push(`${trail}: ${hops.length} hops (want at most the trailing-slash 308 plus one rule)`);
        else if (hash && !pageHasId(new URL(url, baseURL).pathname, hash)) failures.push(`${trail}: #${hash} is not on the page`);
      }
      expect(failures, `legacy URLs that do not land:\n  ${failures.join('\n  ')}`).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------------- */

test.describe('robots, sitemap, manifest', () => {
  /* Same rule as app/robots.js: only a launched production build may be
   * crawled. A launched build anywhere else (CI, a local `next start`, a
   * preview deployment) still disallows everything. */
  test(`/robots.txt matches the indexing switch (${INDEXABLE ? 'indexable' : 'Disallow: /'})`, async ({ anon }) => {
    const res = await anon.get('/robots.txt', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^text\/plain/);
    const body = await res.text();
    expect(body).toMatch(/^User-Agent: \*$/im);
    if (INDEXABLE) {
      expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
      expect(body).not.toMatch(/^Disallow: \/\s*$/m);
    } else {
      expect(body).toMatch(/^Disallow: \/\s*$/m);
      expect(body).not.toMatch(/^Allow:/m);
      expect(body).not.toMatch(/^Sitemap:/m);
    }
  });

  test('/sitemap.xml lists every indexable page as an absolute URL', async ({ anon }) => {
    const res = await anon.get('/sitemap.xml', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
    const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    const expected = PAGES.filter((p) => !isNoindex(p.url)).map((p) => new URL(p.url, SITE_URL).href);
    const known = new Set(PAGES.map((p) => new URL(p.url, SITE_URL).href));
    expect(locs.filter((l) => !l.startsWith(`${SITE_URL}/`)), 'locs not on SITE_URL').toEqual([]);
    expect(expected.filter((u) => !locs.includes(u)), 'indexable pages missing from the sitemap').toEqual([]);
    expect(locs.filter((l) => !known.has(l)), 'sitemap URLs that are not pages').toEqual([]);
    expect(locs, 'the gate is never in the sitemap').not.toContain(new URL('/gate', SITE_URL).href);
    expect(new Set(locs).size, 'duplicate sitemap entries').toBe(locs.length);
  });

  test('/manifest.webmanifest names Equality Ohio and its icons resolve', async ({ anon }) => {
    const res = await anon.get('/manifest.webmanifest', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toBe('Equality Ohio');
    expect(Array.isArray(manifest.icons) && manifest.icons.length, 'manifest icons').toBeTruthy();
    for (const icon of manifest.icons) {
      const img = await anon.get(icon.src, { maxRedirects: 0 });
      expect(img.status(), `icon ${icon.src}`).toBe(200);
      expect(img.headers()['content-type'], `icon ${icon.src}`).toMatch(/^image\//);
    }
  });
});

test.describe('unknown URLs', () => {
  for (const path of [NOT_FOUND_PATH, '/legal-clinic/no-such-page', '/about/history/extra/segments']) {
    test(`${path} is a branded, server-rendered 404`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `GET ${path}`).toBe(404);
      const headers = res.headers();
      expect(headers['x-powered-by']).toBeUndefined();
      if (INDEXABLE) expect(headers['x-robots-tag']).toBeUndefined();
      else expect(headers['x-robots-tag']).toBe(STAGING_ROBOTS);
      const html = await res.text();
      expect(html).toMatch(/<html[^>]*\blang="en"/i);
      expect(html.match(/<main\b[^>]*\bid="main"/gi)?.length ?? 0, 'exactly one <main id="main">').toBe(1);
      expect(html.match(/<main\b/gi)?.length ?? 0, 'exactly one <main>').toBe(1);
      expect(html).toMatch(/<h1\b/i);
      expect(html, 'site header').toMatch(/<header\b[^>]*class="[^"]*\bsite-header\b/i);
      expect(html, 'site footer').toMatch(/<footer\b[^>]*class="[^"]*\bsite-footer\b/i);
      expect(html, 'noindex robots meta').toMatch(/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i);
    });
  }
});

/* ------------------------------------------------------------------------- */

/* Contract 6: reachable without the cookie. The exact open paths (GET
 * /api/gate is checked separately: it only takes a POST) and every real file
 * under the open directories (lib/open-files.generated.mjs); nothing else
 * under those directories. */
const OPEN_EXACT = [...OPEN_EXACT_SET].filter((p) => p !== '/api/gate');
/* Missing files, probes and encoded traversals under the open directories:
 * each must go to the gate, never to the branded 404 and its site chrome. */
const MISSING_UNDER_OPEN = [
  '/css/x',
  '/css/does-not-exist.css',
  '/assets/og/x',
  '/assets/fonts/x.woff2',
  '/assets/logo/x.png',
  '/assets/brand/x.svg',
  '/assets/textures/nothing.svg',
  '/css/%2E%2E%2Fjs/eo-site-template.js',
  '/css/..%2fabout',
  '/assets/og/..%2Fimg%2Fcandidate-scorecard-2026-banner.png',
];

test.describe('staging gate', () => {
  test.skip(LAUNCHED, 'lib/site.mjs LAUNCHED is true: the gate is a pass-through');

  const expectGateRedirect = (res, baseURL, from) => {
    expect([302, 303, 307, 308], `status ${res.status()} is a redirect`).toContain(res.status());
    const to = resolve(res.headers().location, baseURL);
    expect(to.origin).toBe(new URL(baseURL).origin);
    expect(to.pathname).toBe('/gate');
    expect(to.searchParams.get('from')).toBe(from);
  };

  test('signed out, / and every page redirect to /gate?from=<path>', async ({ anon, baseURL }) => {
    expectGateRedirect(await anon.get('/', { maxRedirects: 0 }), baseURL, null);
    const about = await anon.get('/about', { maxRedirects: 0 });
    expectGateRedirect(about, baseURL, '/about');
    expect(about.headers().location).toContain('from=%2Fabout');
    expect(about.headers()['cache-control'] || '', 'the gate redirect is never cached').toMatch(/no-store/);
    expectGateRedirect(await anon.get('/legal-clinic/intake?ref=email', { maxRedirects: 0 }), baseURL, '/legal-clinic/intake?ref=email');
    expectGateRedirect(await anon.get(NOT_FOUND_PATH, { maxRedirects: 0 }), baseURL, NOT_FOUND_PATH);
    for (const p of PAGES.filter((pg) => pg.url !== '/gate' && pg.url !== '/')) {
      expectGateRedirect(await anon.get(p.url, { maxRedirects: 0 }), baseURL, p.url);
    }
  });

  test('signed out, non-open files stay behind the gate', async ({ anon, baseURL }) => {
    for (const path of ['/js/eo-site-template.js', '/assets/img/candidate-scorecard-2026-banner.png', '/CSS/eo-site.css']) {
      expectGateRedirect(await anon.get(path, { maxRedirects: 0 }), baseURL, path);
    }
  });

  test('signed out, the open paths and every real open file are reachable', async ({ anon }) => {
    for (const prefix of OPEN_PREFIXES) {
      expect([...OPEN_FILES].some((f) => f.startsWith(prefix)), `no file under public${prefix} in lib/open-files.generated.mjs`).toBe(true);
    }
    for (const path of [...OPEN_EXACT, ...OPEN_FILES]) {
      const res = await anon.get(path, { maxRedirects: 0 });
      expect(res.status(), `GET ${path} signed out`).toBe(200);
    }
    const api = await anon.get('/api/gate', { maxRedirects: 0 });
    expect(api.headers().location || '', 'GET /api/gate is not sent to the gate').not.toMatch(/\/gate\?/);
  });

  test('signed out, a missing file under an open directory goes to the gate, not the site chrome', async ({ anon, baseURL }) => {
    for (const path of MISSING_UNDER_OPEN) {
      const res = await anon.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 308], `GET ${path} signed out: status ${res.status()} is a redirect`).toContain(res.status());
      const to = resolve(res.headers().location, baseURL);
      expect(to.origin, `GET ${path} redirect stays on the site`).toBe(new URL(baseURL).origin);
      expect(to.pathname, `GET ${path} goes to the gate`).toBe('/gate');
      const body = await res.text();
      expect(body, `GET ${path}: no site header`).not.toMatch(/site-header|site-nav|preview-ribbon/);
    }
  });

  test('the right password sets an HttpOnly cookie and lands on "from"', async ({ anon, baseURL }) => {
    const res = await anon.post('/api/gate', { form: { password: GATE_PASSWORD, from: '/about/history' }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers()['x-powered-by']).toBeUndefined();
    const to = resolve(res.headers().location, baseURL);
    expect(to.origin).toBe(new URL(baseURL).origin);
    expect(to.pathname).toBe('/about/history');
    const cookie = setCookies(res).find((c) => c.startsWith('eo_preview='));
    expect(cookie, 'Set-Cookie eo_preview').toBeTruthy();
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*Path=\//i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    // The cookie now unlocks the site in this context.
    expect((await anon.get('/about/history', { maxRedirects: 0 })).status()).toBe(200);
  });

  const HOSTILE_FROM = [
    '/\\evil.example',
    '/%5Cevil.example',
    '/%5C%5Cevil.example',
    '//evil.example',
    '///evil.example',
    '/%09/evil.example',
    '/\t/evil.example',
    '/\\/evil.example',
    'https://evil.example/',
    'javascript:alert(1)',
    // URL parsing removes dot segments, so each of these parses to the
    // protocol-relative "//evil.example".
    '/.//evil.example',
    '/..//evil.example',
    '/a/..//evil.example',
    '/%2e%2e//evil.example',
    '/%2E//evil.example',
    '/%2e%2e/%2e%2e//evil.example/phish',
    // Every spelling that serves the gate.
    '/gate',
    '/gate/',
    '/GATE',
    '/gate.html',
    '/%67ate',
    '/api/gate',
    '/api/gate/',
  ];
  test('"from" can never send a signed-in visitor off the site (open-redirect attempts)', async ({ anon, baseURL }) => {
    const origin = new URL(baseURL).origin;
    for (const from of HOSTILE_FROM) {
      const res = await anon.post('/api/gate', { form: { password: GATE_PASSWORD, from }, maxRedirects: 0 });
      expect(res.status(), `from=${JSON.stringify(from)}`).toBe(303);
      const location = res.headers().location;
      expect(location, `Location for from=${JSON.stringify(from)}`).toBeTruthy();
      expect(location, `raw Location for from=${JSON.stringify(from)} has no backslash or control character`).not.toMatch(/[\\\u0000-\u001f]/);
      expect(location, `raw Location for from=${JSON.stringify(from)} is not protocol-relative`).not.toMatch(/^\s*\/\//);
      const to = resolve(location, baseURL);
      expect(to.origin, `from=${JSON.stringify(from)} stays on ${origin}`).toBe(origin);
      expect(isGatePath(to.pathname), `from=${JSON.stringify(from)} never loops back into the gate (landed on ${to.pathname})`).toBe(false);
    }
  });

  test('a wrong password goes back to /gate?error=1 without a cookie', async ({ anon, baseURL }) => {
    // A fresh documentation-range address (2001:db8::/32) per attempt keeps
    // each run in its own rate-limit bucket wherever the server honors
    // forwarded headers, so rerunning against one long-lived server
    // (reuseExistingServer, --repeat-each) never trips the limit.
    const ip = `2001:db8::${randomInt(1, 0xffff).toString(16)}:${randomInt(1, 0xffff).toString(16)}`;
    const headers = { 'x-real-ip': ip, 'x-forwarded-for': ip };
    const res = await anon.post('/api/gate', { form: { password: 'not-the-password', from: '/about' }, headers, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    const to = resolve(res.headers().location, baseURL);
    expect(to.pathname).toBe('/gate');
    expect(to.searchParams.get('error')).toBe('1');
    expect(setCookies(res).filter((c) => c.startsWith('eo_preview=') && !/Max-Age=0/i.test(c))).toEqual([]);
    const after = await anon.get('/about', { maxRedirects: 0 });
    expect(after.status(), 'still signed out').not.toBe(200);
  });

  test('a malformed body is a 400', async ({ anon }) => {
    const res = await anon.post('/api/gate', {
      headers: { 'content-type': 'application/json' },
      data: '{"password": "EO20',
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
    expect(setCookies(res).some((c) => c.startsWith('eo_preview='))).toBe(false);
  });

  test('a forged cookie does not unlock anything', async ({ anon, baseURL }) => {
    for (const value of ['1', 'true', '0'.repeat(64), 'EO2026']) {
      const res = await anon.get('/about', { headers: { cookie: `eo_preview=${value}` }, maxRedirects: 0 });
      expectGateRedirect(res, baseURL, '/about');
    }
  });
});

test.describe('launched', () => {
  test.skip(!LAUNCHED, 'staging: the gate is on');
  test('signed out visitors reach pages directly', async ({ anon }) => {
    expect((await anon.get('/about', { maxRedirects: 0 })).status()).toBe(200);
  });
  test('/api/gate is dead: a 404 with no cookie and no redirect', async ({ anon }) => {
    const res = await anon.post('/api/gate', { form: { password: GATE_PASSWORD, from: '/.//evil.example' }, maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(res.headers().location).toBeUndefined();
    expect(setCookies(res).some((c) => c.startsWith('eo_preview='))).toBe(false);
  });
});
