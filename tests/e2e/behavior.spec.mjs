/**
 * tests/e2e/behavior.spec.mjs
 * ---------------------------
 * The behavior contract for the site chrome and pages, in a real browser:
 *
 *   mobile nav (<=900px)  button.nav-toggle[aria-controls="site-nav"]
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
 *                         valid submit shows .form-success.show
 *   help bar              aside.help-bar with a tel: link on the three legal
 *                         guide pages at phone width, hidden at >=768px
 *   sticky header         .site-header top is 0 after scrolling 1500px
 *   reveal                after scrolling to the bottom, nothing in <main>
 *                         is still hidden by the scroll-reveal
 *   no JavaScript         the prerendered header nav links are there
 *   reduced motion        html scroll-behavior is auto
 *   overflow              no horizontal scroll at 320px and 390px
 */
import { expect, test } from '@playwright/test';
import { DESKTOP, MOCK_FORM_PAGES, PHONE, SITE_PAGES, scrollThrough } from './support/site.mjs';

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

  test('the site has mock forms to test', () => {
    expect(MOCK_FORM_PAGES.length, 'pages with a form[data-mock="true"]').toBeGreaterThan(0);
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
        await scrollThrough(page, { step: 0.5, pause: 80 });
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
