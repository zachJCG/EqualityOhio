/**
 * tests/e2e/a11y.spec.mjs
 * -----------------------
 * WCAG 2.1 A and AA audit (axe: wcag2a, wcag2aa, wcag21a, wcag21aa) at a
 * phone (390x844) and a desktop (1280x800) width:
 *
 *   - every static page (lib/static-pages.mjs) except the gate
 *   - the branded 404 (HTTP 404)
 *   - /gate and /gate?error=1, signed out
 *   - interactive states a page load never shows: the mobile menu open, a
 *     desktop dropdown open, and the legal clinic intake form after an
 *     empty submit
 *
 * Each page is scrolled top to bottom first so scroll-reveal content is in
 * its final state, then fonts and transitions settle before axe runs.
 * Violations are attached to the test (readable text and raw JSON) and
 * printed in the failure message. Release gate: zero violations.
 *
 *   npm run lint:a11y
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { UNAUTHENTICATED } from './support/env.mjs';
import {
  DESKTOP,
  NOT_FOUND_PATH,
  PHONE,
  SITE_PAGES,
  VIEWPORTS,
  describeViolations,
  scrollThrough,
  settle,
} from './support/site.mjs';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const slug = (text) => text.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'home';

async function expectNoViolations(page, label, testInfo, { scroll = true } = {}) {
  if (scroll) {
    await scrollThrough(page);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const details = describeViolations(results.violations);
  if (results.violations.length) {
    const name = `axe-${slug(label)}-${page.viewportSize()?.width}`;
    await testInfo.attach(`${name}.txt`, { body: details, contentType: 'text/plain' });
    await testInfo.attach(`${name}.json`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
  }
  expect(
    results.violations.map((v) => `${v.id} (${v.nodes.length})`),
    `axe violations on ${label} at ${page.viewportSize()?.width}px:\n${details}`,
  ).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(`axe at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const p of SITE_PAGES) {
      test(`${p.url} has no WCAG 2.1 AA violations`, async ({ page }, testInfo) => {
        const response = await page.goto(p.url, { waitUntil: 'load' });
        expect(response?.status(), `status for ${p.url}`).toBe(200);
        await expectNoViolations(page, p.url, testInfo);
      });
    }

    test('the branded 404 has no WCAG 2.1 AA violations', async ({ page }, testInfo) => {
      const response = await page.goto(NOT_FOUND_PATH, { waitUntil: 'load' });
      expect(response?.status(), `status for ${NOT_FOUND_PATH}`).toBe(404);
      await expectNoViolations(page, '404 page', testInfo);
    });

    test('the legal clinic intake form after an empty submit has no WCAG 2.1 AA violations', async ({ page }, testInfo) => {
      const response = await page.goto('/legal-clinic/intake', { waitUntil: 'load' });
      expect(response?.status()).toBe(200);
      const form = page.locator('form[data-mock="true"]').first();
      await form.locator('[type="submit"]').first().click();
      // The error UI is asserted in behavior.spec.mjs; here, audit whatever renders.
      await page.locator('.error-summary').first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
      await expectNoViolations(page, '/legal-clinic/intake after an empty submit', testInfo, { scroll: false });
    });

    test.describe('signed out', () => {
      test.use({ storageState: UNAUTHENTICATED });

      for (const path of ['/gate', '/gate?error=1']) {
        test(`${path} has no WCAG 2.1 AA violations`, async ({ page }, testInfo) => {
          const response = await page.goto(path, { waitUntil: 'load' });
          expect(response?.status(), `status for ${path}`).toBe(200);
          await expectNoViolations(page, path, testInfo, { scroll: false });
        });
      }
    });
  });
}

test.describe('interactive states', () => {
  test.describe('phone', () => {
    test.use({ viewport: PHONE });

    test('the mobile menu, open, has no WCAG 2.1 AA violations', async ({ page }, testInfo) => {
      await page.goto('/', { waitUntil: 'load' });
      await page.locator('button.nav-toggle').click();
      await expect(page.locator('nav#site-nav')).toHaveClass(/\bopen\b/);
      await expect(page.locator('nav#site-nav')).toBeVisible();
      await expectNoViolations(page, 'mobile menu open', testInfo, { scroll: false });
    });
  });

  test.describe('desktop', () => {
    test.use({ viewport: DESKTOP });

    test('a desktop dropdown, open, has no WCAG 2.1 AA violations', async ({ page }, testInfo) => {
      await page.goto('/', { waitUntil: 'load' });
      const toggle = page.locator('button.sub-toggle').first();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const menuId = await toggle.getAttribute('aria-controls');
      await expect(page.locator(`[id="${menuId}"]`)).toBeVisible();
      await expectNoViolations(page, 'desktop dropdown open', testInfo, { scroll: false });
    });
  });
});
