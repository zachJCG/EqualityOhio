/**
 * tests/e2e/behavior.spec.mjs
 * ---------------------------
 * The behavior contract for the site chrome and pages, in a real browser:
 *
 *   mobile nav (<=900px)  served as a.nav-toggle[href="#footer-nav"] (works
 *                         if the behaviors script fails), upgraded to
 *                         button.nav-toggle[aria-controls="site-nav"]
 *                         [aria-expanded]; open = nav#site-nav.open,
 *                         body.nav-open, main#main and footer.site-footer
 *                         inert; Escape closes and returns focus to the
 *                         toggle; aria-expanded mirrors the state
 *   desktop nav (>=901px) each section has button.sub-toggle[aria-expanded]
 *                         [aria-controls]; click opens its .sub-menu; Escape
 *                         closes and returns focus to that button; a click
 *                         outside closes; opening one closes the others
 *   mock forms            an empty submit shows no .form-success but a
 *                         focused .error-summary (tabindex="-1", role="alert"
 *                         or a heading) linking to each invalid field; each
 *                         invalid field has aria-invalid="true" and an
 *                         aria-describedby naming a visible error message; a
 *                         valid submit shows .form-success.show; fixing a
 *                         field updates the summary silently (role="group")
 *                         and the next submit makes it an alert again
 *   help bar              aside.help-bar with a tel: link on the three legal
 *                         guide pages at phone width, hidden at >=768px; it
 *                         stays shown once it rests above the footer, even
 *                         with the closing callout on screen; Tab stops
 *                         clear it (scroll-padding-bottom)
 *   staging gate          signed out, /gate renders fully styled: every
 *                         stylesheet, font and image it asks for loads (only
 *                         the real files under the open directories are let
 *                         through without the cookie)
 *   sticky header         .site-header top is 0 after scrolling 1500px
 *   reveal                after scrolling to the bottom, nothing in <main>
 *                         is still hidden by the scroll-reveal
 *   no JavaScript         the prerendered header nav links are there
 *   reduced motion        html scroll-behavior is auto; no animation delay
 *                         (the hero never paints at its start offset)
 *   short viewports       at 400% zoom (320x200) the header and help bar
 *                         scroll with the page
 *   print                 buttons print as ink, not pale grey
 *   overflow              no horizontal scroll at 320px and 390px, and none
 *                         at 320px under the WCAG 1.4.12 text spacing
 */
import { expect, test } from '@playwright/test';
import { LAUNCHED } from '../../lib/site.mjs';
import { UNAUTHENTICATED } from './support/env.mjs';
import { DESKTOP, MOCK_FORM_PAGES, PHONE, SITE_PAGES, revealEverything } from './support/site.mjs';

const HELP_BAR_PAGES = ['/legal-clinic', '/legal-clinic/trans-know-your-rights', '/legal-clinic/ohio-lgbtq-family-law-guide'];

/* ---------------------------------------------------------------------------
 * Mobile navigation
 * ------------------------------------------------------------------------- */

test.describe('mobile navigation (390px)', () => {
  test.use({ viewport: PHONE });

  test('the menu toggle opens, makes the page inert, and Escape closes it back to the toggle', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('button.nav-toggle');
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAttribute('aria-controls', 'site-nav');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const nav = page.locator('nav#site-nav');
    const main = page.locator('main#main');
    const footer = page.locator('footer.site-footer');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toHaveClass(/\bopen\b/);
    await expect(nav).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/\bnav-open\b/);
    await expect(main, 'main#main is inert while the menu is open').toHaveAttribute('inert', /.*/);
    await expect(footer, 'footer.site-footer is inert while the menu is open').toHaveAttribute('inert', /.*/);

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).not.toHaveClass(/\bopen\b/);
    await expect(page.locator('body')).not.toHaveClass(/\bnav-open\b/);
    await expect(main).not.toHaveAttribute('inert', /.*/);
    await expect(footer).not.toHaveAttribute('inert', /.*/);
    await expect(toggle, 'focus returns to the menu button').toBeFocused();
  });

  test('if the behaviors script fails, Menu is a link to the footer navigation', async ({ page }) => {
    await page.route('**/js/eo-site-template.js', (route) => route.abort());
    await page.goto('/about');
    const toggle = page.locator('.nav-toggle');
    await expect(toggle).toBeVisible();
    expect(await toggle.evaluate((el) => el.tagName)).toBe('A');
    await expect(toggle).toHaveAttribute('href', '#footer-nav');
    await expect(toggle).toHaveAccessibleName('Menu');
    await toggle.click();
    await expect(page).toHaveURL(/#footer-nav$/);
    await expect(page.locator('#footer-nav nav a[href="/legal-clinic"]').first()).toBeInViewport();
  });

  test('with the script, the served Menu link becomes the sheet button in the same box', async ({ page, context }) => {
    const box = (p) =>
      p.locator('.nav-toggle').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, box: [r.x, r.y, r.width, r.height].map(Math.round) };
      });
    const served = await context.newPage();
    await served.route('**/js/eo-site-template.js', (route) => route.abort());
    await served.goto('/about');
    const before = await box(served);
    await served.close();

    await page.goto('/about');
    await expect(page.locator('button.nav-toggle')).toHaveCount(1);
    const after = await box(page);
    expect(before.tag).toBe('A');
    expect(after.tag).toBe('BUTTON');
    expect(after.box, 'the toggle box is the same as a link and as a button').toEqual(before.box);
  });

  test('aria-expanded mirrors the state when the toggle is clicked twice', async ({ page }) => {
    await page.goto('/about');
    const toggle = page.locator('button.nav-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('nav#site-nav')).toHaveClass(/\bopen\b/);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('nav#site-nav')).not.toHaveClass(/\bopen\b/);
    await expect(page.locator('main#main')).not.toHaveAttribute('inert', /.*/);
  });
});

/* ---------------------------------------------------------------------------
 * Desktop navigation
 * ------------------------------------------------------------------------- */

test.describe('desktop navigation (1280px)', () => {
  test.use({ viewport: DESKTOP });

  /* Park the pointer on the empty page margin so :hover never decides what
   * is open; the tests are about the click and keyboard state. */
  const parkPointer = (page) => page.mouse.move(2, DESKTOP.height - 2);
  const menuFor = async (page, toggle) => page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`);

  test('every section has a sub-toggle wired to its sub-menu', async ({ page }) => {
    await page.goto('/');
    const sections = page.locator('#site-nav .has-sub');
    const count = await sections.count();
    expect(count, 'nav sections with a sub-menu').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const toggle = sections.nth(i).locator('button.sub-toggle');
      await expect(toggle, `section ${i + 1} has one button.sub-toggle`).toHaveCount(1);
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      const menu = await menuFor(page, toggle);
      await expect(menu, `aria-controls of section ${i + 1} names its .sub-menu`).toHaveClass(/\bsub-menu\b/);
      await expect(menu).toBeHidden();
    }
  });

  test('click opens a sub-menu; Escape closes it and returns focus to its button', async ({ page }) => {
    await page.goto('/');
    await parkPointer(page);
    const toggle = page.locator('button.sub-toggle').first();
    await toggle.click();
    await parkPointer(page);
    const menu = await menuFor(page, toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('a click outside closes the open sub-menu', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('button.sub-toggle').first();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.click(2, Math.round(DESKTOP.height / 2));
    await parkPointer(page);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(await menuFor(page, toggle)).toBeHidden();
  });

  test('opening one sub-menu closes the others', async ({ page }) => {
    await page.goto('/');
    const toggles = page.locator('button.sub-toggle');
    expect(await toggles.count()).toBeGreaterThan(1);
    const [first, second] = [toggles.nth(0), toggles.nth(1)];
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await second.click();
    await parkPointer(page);
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(await menuFor(page, second)).toBeVisible();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(await menuFor(page, first)).toBeHidden();
  });
});

/* ---------------------------------------------------------------------------
 * Mock forms
 * ------------------------------------------------------------------------- */

/** Fill every required control in `form` with a valid value. */
async function fillRequired(form) {
  const controls = form.locator('[required]:not([type="hidden"]):not([disabled])');
  const n = await controls.count();
  const radioGroups = new Set();
  for (let i = 0; i < n; i++) {
    const control = controls.nth(i);
    const { tag, type, name, min } = await control.evaluate((el) => ({
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || '').toLowerCase(),
      name: el.getAttribute('name') || '',
      min: el.getAttribute('min'),
    }));
    if (tag === 'select') {
      const value = await control.evaluate((el) => [...el.options].find((o) => o.value && !o.disabled)?.value);
      await control.selectOption(value);
    } else if (type === 'checkbox') {
      await control.check();
    } else if (type === 'radio') {
      if (radioGroups.has(name)) continue;
      radioGroups.add(name);
      await control.check();
    } else if (type === 'email') {
      await control.fill('test@example.com');
    } else if (type === 'tel') {
      await control.fill('6145550100');
    } else if (type === 'url') {
      await control.fill('https://example.com');
    } else if (type === 'number') {
      await control.fill(min ?? '1');
    } else if (type === 'date') {
      await control.fill('2026-11-02');
    } else {
      await control.fill('Test entry');
    }
  }
  return n;
}

test.describe('mock forms', () => {
  test.use({ viewport: DESKTOP });

  /* While staging the forms are mocks, so this guards against the loop
   * below silently testing nothing. At launch every mock form is wired or
   * removed (docs/launch-checklist.md section C), so there is nothing to
   * require. */
  test('the site has mock forms to test', () => {
    test.skip(LAUNCHED || MOCK_FORM_PAGES.length === 0, 'launched: every mock form has been wired or removed');
    expect(MOCK_FORM_PAGES.length, 'pages with a form[data-mock="true"]').toBeGreaterThan(0);
  });

  test('fixing a field updates the error summary silently; the next submit announces it again', async ({ page }) => {
    test.skip(!MOCK_FORM_PAGES.some((f) => f.url === '/legal-clinic/intake'), 'the intake is no longer a mock form');
    await page.goto('/legal-clinic/intake');
    const form = page.locator('form[data-mock="true"]').first();
    await form.locator('[type="submit"]').first().click();
    const summary = form.locator('.error-summary');
    await expect(summary).toHaveAttribute('role', 'alert');
    const before = await summary.locator('li').count();
    const firstText = form.locator('input[required][type="text"], input[required]:not([type])').first();
    await firstText.fill('A');
    await expect(summary.locator('li')).toHaveCount(before - 1);
    await expect(summary, 'no assertive re-read while typing').toHaveAttribute('role', 'group');
    await expect(summary).toHaveAttribute('aria-labelledby', /.+/);
    await form.locator('[type="submit"]').first().click();
    await expect(summary).toHaveAttribute('role', 'alert');
    await expect(summary).toBeFocused();
  });

  for (const { url, index, label } of MOCK_FORM_PAGES) {
    test(`${url} "${label}": an empty submit shows a focused error summary, not success`, async ({ page }) => {
      await page.goto(url);
      const form = page.locator('form[data-mock="true"]').nth(index);
      const required = form.locator('[required]:not([type="hidden"]):not([disabled])');
      expect(await required.count(), 'required fields in the form').toBeGreaterThan(0);

      await form.locator('[type="submit"]').first().click();

      await expect(page.locator('.form-success.show'), 'no success message after an empty submit').toHaveCount(0);
      const summary = page.locator('.error-summary').filter({ visible: true }).first();
      await expect(summary, 'a visible .error-summary').toBeVisible();
      await expect(summary, 'the error summary takes focus').toBeFocused();
      await expect(summary).toHaveAttribute('tabindex', '-1');
      const announced = await summary.evaluate(
        (el) => el.getAttribute('role') === 'alert' || Boolean(el.querySelector('h2, h3, h4, [role="heading"]')),
      );
      expect(announced, '.error-summary has role="alert" or a heading').toBe(true);

      const invalid = form.locator('[aria-invalid="true"]');
      const ids = await invalid.evaluateAll((els) => els.map((el) => el.id));
      expect(ids.length, 'fields marked aria-invalid="true"').toBeGreaterThan(0);
      const requiredIds = await required.evaluateAll((els) => els.map((el) => el.id || el.getAttribute('name')));
      for (const id of requiredIds) expect(ids, `required field ${id} is marked invalid`).toContain(id);

      for (const id of ids) {
        expect(id, 'every invalid field has an id the summary can link to').toBeTruthy();
        await expect(summary.locator(`a[href="#${id}"]`), `the summary links to #${id}`).toHaveCount(1);
        const describedBy = (await form.locator(`[id="${id}"]`).getAttribute('aria-describedby')) || '';
        const visibleMessages = await page.evaluate(
          (refs) =>
            refs.filter((ref) => {
              const el = document.getElementById(ref);
              return el && el.getClientRects().length > 0 && el.textContent.trim().length > 0;
            }),
          describedBy.split(/\s+/).filter(Boolean),
        );
        expect(visibleMessages.length, `#${id} aria-describedby ("${describedBy}") names a visible error message`).toBeGreaterThan(0);
      }
    });

    test(`${url} "${label}": a valid submit shows .form-success`, async ({ page }) => {
      await page.goto(url);
      const form = page.locator('form[data-mock="true"]').nth(index);
      await fillRequired(form);
      await form.locator('[type="submit"]').first().click();
      await expect(page.locator('.form-success.show').first()).toBeVisible();
      await expect(form.locator('[aria-invalid="true"]')).toHaveCount(0);
    });
  }
});

/* ---------------------------------------------------------------------------
 * Phone help bar
 * ------------------------------------------------------------------------- */

test.describe('phone help bar', () => {
  for (const url of HELP_BAR_PAGES) {
    test(`${url} shows aside.help-bar with a phone link on phones, hidden at 768px and up`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(url);
      const bar = page.locator('aside.help-bar');
      await expect(bar, 'one aside.help-bar').toHaveCount(1);
      await expect(bar).toBeVisible();
      await expect(bar.locator('a[href^="tel:"]').first()).toBeVisible();
      for (const viewport of [{ width: 768, height: 1024 }, DESKTOP]) {
        await page.setViewportSize(viewport);
        await expect(bar, `hidden at ${viewport.width}px`).toBeHidden();
      }
    });
  }

  /* Both guides end with a [data-cta] callout right above the footer. With
   * the footer on screen the bar is parked in its slot above it and must
   * stay shown, or that slot is an empty band. */
  for (const url of ['/legal-clinic/ohio-lgbtq-family-law-guide', '/legal-clinic/trans-know-your-rights']) {
    test(`${url}: the help bar stays shown once it rests above the footer`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(url);
      await page.evaluate(() => {
        const footer = document.querySelector('.site-footer');
        window.scrollTo({ top: footer.getBoundingClientRect().top + window.scrollY - 600, behavior: 'instant' });
      });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const cta = await page.evaluate(() => [...document.querySelectorAll('[data-cta]')].some((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      }));
      expect(cta, 'the closing clinic callout is on screen too').toBe(true);
      await expect(page.locator('aside.help-bar')).toHaveAttribute('data-hidden', 'false');
      await expect(page.locator('aside.help-bar')).not.toHaveAttribute('inert', /.*/);
    });
  }

  test('Tab stops on help-bar pages clear the bar (scroll-padding-bottom)', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/legal-clinic/trans-know-your-rights');
    const padding = await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom);
    const barHeight = await page.locator('aside.help-bar').evaluate((el) => el.getBoundingClientRect().height);
    expect(parseFloat(padding), `scroll-padding-bottom ${padding} covers the ${barHeight}px bar`).toBeGreaterThanOrEqual(barHeight);
  });
});

/* ---------------------------------------------------------------------------
 * Sticky header, reveal, no-JS, reduced motion, overflow
 * ------------------------------------------------------------------------- */

for (const viewport of [PHONE, DESKTOP]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const url of ['/', '/legal-clinic/trans-know-your-rights']) {
      test(`${url}: the header sticks to the top after scrolling 1500px`, async ({ page }) => {
        await page.goto(url);
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(height, 'page is long enough to scroll 1500px').toBeGreaterThan(1500 + viewport.height);
        await page.evaluate(() => window.scrollTo(0, 1500));
        await page.waitForFunction(() => Math.abs(window.scrollY - 1500) < 2);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const top = await page.locator('.site-header').evaluate((el) => el.getBoundingClientRect().top);
        expect(Math.abs(top), `.site-header top after scrollTo(0, 1500) is ${top}px`).toBeLessThanOrEqual(1);
      });
    }

    for (const p of SITE_PAGES) {
      test(`${p.url}: nothing in <main> stays hidden by the scroll reveal`, async ({ page }) => {
        await page.goto(p.url);
        // Every reveal target is brought into view and observed in turn, so
        // a busy machine that skips a frame cannot leave one unseen.
        await revealEverything(page);
        await page.waitForTimeout(1_000);
        const hidden = await page.evaluate(() => {
          const describe = (el) =>
            `<${el.tagName.toLowerCase()}${el.className ? ` class="${String(el.className).trim()}"` : ''}> "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)}"`;
          const out = [];
          for (const el of document.querySelectorAll('main *')) {
            const pending = el.classList.contains('reveal') && !el.classList.contains('in-view');
            const style = getComputedStyle(el);
            const transparent =
              Boolean(el.closest('.reveal')) &&
              style.opacity === '0' &&
              style.visibility !== 'hidden' &&
              el.getClientRects().length > 0;
            if (pending || transparent) out.push(`${describe(el)}${pending ? ' (reveal without in-view)' : ' (opacity 0)'}`);
          }
          return out;
        });
        expect(hidden, `hidden after scrolling to the bottom:\n  ${hidden.join('\n  ')}`).toEqual([]);
      });
    }
  });
}

/* ---------------------------------------------------------------------------
 * Staging gate page
 * ------------------------------------------------------------------------- */

test.describe('the gate page, signed out', () => {
  test.use({ storageState: UNAUTHENTICATED, viewport: DESKTOP });

  test('renders fully styled: every stylesheet, font and image it asks for loads', async ({ page, baseURL }) => {
    const origin = new URL(baseURL).origin;
    const bad = [];
    page.on('response', (res) => {
      const url = new URL(res.url());
      if (url.origin !== origin || url.pathname === '/gate') return;
      if (res.status() !== 200) bad.push(`${res.status()} ${url.pathname}${res.headers().location ? ` -> ${res.headers().location}` : ''}`);
    });
    page.on('requestfailed', (req) => bad.push(`failed ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`));

    const response = await page.goto('/gate', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const state = await page.evaluate(() => {
      const sheets = [...document.styleSheets].map((sheet) => ({
        href: sheet.href ? new URL(sheet.href).pathname : '(inline)',
        rules: (() => {
          try {
            return sheet.cssRules.length;
          } catch {
            return -1;
          }
        })(),
      }));
      const logo = document.querySelector('.gate-card__logo');
      const button = document.querySelector('.gate-form .btn--primary');
      return {
        sheets,
        fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
        logo: logo ? logo.naturalWidth : 0,
        cardMaxWidth: getComputedStyle(document.querySelector('.gate-card')).maxWidth,
        buttonBackground: button ? getComputedStyle(button).backgroundColor : '',
      };
    });
    expect(bad, `gate page requests that did not load:\n  ${bad.join('\n  ')}`).toEqual([]);
    for (const sheet of ['/css/eo-fonts.css', '/css/eo-brand-tokens.css', '/css/eo-site.css']) {
      const found = state.sheets.find((s) => s.href === sheet);
      expect(found?.rules ?? 0, `${sheet} loaded with rules`).toBeGreaterThan(0);
    }
    expect(state.fonts, 'a self-hosted font loaded').toContain('Open Sans');
    expect(state.logo, 'the logo image loaded').toBeGreaterThan(0);
    expect(state.cardMaxWidth, '.gate-card is styled by eo-site.css').toBe('420px');
    expect(state.buttonBackground, 'the primary button has its brand fill').not.toMatch(/^(?:transparent|rgba\(0, 0, 0, 0\))$/);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('desktop: the prerendered header nav links are visible', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    for (const href of ['/legal-clinic', '/our-work', '/get-involved', '/about', '/news', '/give']) {
      await expect(page.locator(`nav#site-nav a[href="${href}"]`).first(), `nav link ${href}`).toBeVisible();
    }
    await expect(page.locator('footer.site-footer a[href="/contact"]')).toHaveCount(1);
    await expect(page.locator('main#main h1')).toBeVisible();
  });

  test('phone: the nav links are in the served HTML and the content is visible', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/legal-clinic');
    expect(await page.locator('nav#site-nav a[href]').count(), 'nav links in the markup').toBeGreaterThan(5);
    await expect(page.locator('main#main h1')).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('smooth scrolling is off (html scroll-behavior is auto)', async ({ page }) => {
    await page.goto('/');
    const behavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(behavior).toBe('auto');
  });

  test('no animation waits on a delay, so the hero never paints at its start offset', async ({ page }) => {
    await page.goto('/about');
    const delayed = await page.evaluate(() =>
      [...document.querySelectorAll('.hero .container > *')]
        .map((el) => ({ el: el.tagName.toLowerCase(), delay: getComputedStyle(el).animationDelay }))
        .filter((d) => d.delay.split(',').some((v) => parseFloat(v) !== 0)),
    );
    expect(delayed).toEqual([]);
  });
});

test.describe('short viewports (400% zoom: 1280x800 is 320x200 CSS px)', () => {
  test.use({ viewport: { width: 320, height: 200 } });

  test('the header and the help bar scroll with the page instead of sticking', async ({ page }) => {
    await page.goto('/legal-clinic/trans-know-your-rights');
    const positions = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector('.site-header')).position,
      bar: getComputedStyle(document.querySelector('.help-bar')).position,
    }));
    expect(positions).toEqual({ header: 'relative', bar: 'static' });
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
    const top = await page.locator('.site-header').evaluate((el) => el.getBoundingClientRect().bottom);
    expect(top, 'the header has scrolled away').toBeLessThanOrEqual(0);
  });
});

test.describe('print', () => {
  test('buttons print as ink on paper, not white on a dropped fill', async ({ page }) => {
    await page.goto('/legal-clinic/ohio-lgbtq-family-law-guide');
    await page.emulateMedia({ media: 'print' });
    const offInk = () =>
      page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--eo-ink)';
        document.body.appendChild(probe);
        const ink = getComputedStyle(probe).color;
        probe.remove();
        const buttons = [...document.querySelectorAll('main .btn')];
        if (!buttons.length) return ['no main .btn on the page'];
        return buttons.map((b) => getComputedStyle(b).color).filter((c) => c !== ink).map((c) => `${c} (ink is ${ink})`);
      });
    // Polled: .btn transitions its color, so the print value lands after
    // --eo-dur-fast.
    await expect.poll(offInk, { message: 'button text colors in print' }).toEqual([]);
  });
});

/* The WCAG 1.4.12 text-spacing bookmarklet's overrides. */
const TEXT_SPACING_CSS = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }`;

test.describe('no horizontal overflow at 320px under WCAG 1.4.12 text spacing', () => {
  test.use({ viewport: { width: 320, height: 800 } });

  test('every page fits 320px with the text-spacing overrides', async ({ page }) => {
    test.setTimeout(180_000);
    const wide = [];
    for (const p of SITE_PAGES) {
      await page.goto(p.url);
      await page.addStyleTag({ content: TEXT_SPACING_CSS });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      if (scrollWidth > innerWidth) wide.push(`${p.url}: scrollWidth ${scrollWidth} > ${innerWidth}`);
    }
    expect(wide).toEqual([]);
  });
});

for (const width of [320, 390]) {
  test.describe(`no horizontal overflow at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const p of SITE_PAGES) {
      test(`${p.url} fits ${width}px`, async ({ page }) => {
        await page.goto(p.url);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const result = await page.evaluate(() => {
          const vw = window.innerWidth;
          const wide = [...document.querySelectorAll('body *')]
            .filter((el) => el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== 'fixed')
            .filter((el) => ![...el.children].some((c) => c.getBoundingClientRect().right > vw + 1))
            .slice(0, 5)
            .map((el) => `<${el.tagName.toLowerCase()} class="${String(el.className)}"> right=${Math.round(el.getBoundingClientRect().right)}`);
          return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, wide };
        });
        expect(
          result.scrollWidth,
          `scrollWidth ${result.scrollWidth} > innerWidth ${result.innerWidth}; widest elements:\n  ${result.wide.join('\n  ')}`,
        ).toBeLessThanOrEqual(result.innerWidth);
      });
    }
  });
}
