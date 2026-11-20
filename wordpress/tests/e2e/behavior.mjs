/* Behavior contract, adapted from the source's tests/e2e/behavior.spec.mjs:
   phone menu (JS off: the Menu link jumps to the footer nav; JS on: a button
   that traps focus, closes on Escape, returns focus), desktop dropdowns one at
   a time, the help bar hiding while a clinic callout is on screen, the mock
   forms' error summary, new-tab notes, one skip link, landmarks.

     node tests/e2e/behavior.mjs
*/
import { browser, BASE } from './support.mjs';

const b = await browser();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok ' : 'FAIL'} ${msg}`); if (!cond) failures++; };

// 1. JavaScript off: the Menu control is a link to the footer navigation.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  ok(await page.locator('a.nav-toggle[href="#footer-nav"]').count() === 1, 'JS off: Menu is a link to #footer-nav');
  ok(await page.locator('#footer-nav').count() === 1, 'JS off: #footer-nav exists');
  ok(await page.locator('.skip-link').count() === 1, 'exactly one skip link');
  ok(await page.locator('main#main').count() === 1 && await page.locator('header.site-header').count() === 1 && await page.locator('footer.site-footer').count() === 1, 'landmarks: one main, header, footer');
  ok(await page.locator('h1').count() === 1, 'one h1');
  await ctx.close();
}

// 2. Phone menu with JS.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  ok(await page.locator('button.nav-toggle[aria-controls="site-nav"]').count() === 1, 'JS on: Menu is a button controlling #site-nav');
  await page.click('button.nav-toggle');
  await page.waitForSelector('#site-nav.open');
  ok(await page.getAttribute('button.nav-toggle', 'aria-expanded') === 'true', 'menu open: aria-expanded true');
  ok(await page.evaluate(() => document.body.classList.contains('nav-open')), 'menu open: body.nav-open');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.closest('#site-nav') !== null), 'menu open: focus moved into the sheet');
  ok(await page.evaluate(() => document.querySelector('main').hasAttribute('inert')), 'menu open: main is inert');
  // Tab stays inside the header.
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement.closest('.site-header') !== null), 'menu open: Tab stays in the header');
  // A section expands inside the sheet.
  await page.click('#site-nav .has-sub:first-child .sub-toggle');
  ok(await page.getAttribute('#site-nav .has-sub:first-child .sub-toggle', 'aria-expanded') === 'true', 'sheet: section expands');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('site-nav').classList.contains('open'));
  ok(await page.evaluate(() => document.activeElement === document.querySelector('button.nav-toggle')), 'Escape closes and returns focus to the toggle');
  ok(await page.evaluate(() => !document.querySelector('main').hasAttribute('inert')), 'menu closed: main no longer inert');
  await ctx.close();
}

// 3. Desktop dropdowns: one at a time, Escape closes.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const groups = page.locator('#site-nav .has-sub');
  ok(await groups.count() === 4, 'four dropdown sections');
  await groups.nth(0).locator('.sub-toggle').click();
  await groups.nth(1).locator('.sub-toggle').click();
  const open = await page.locator('#site-nav .has-sub.open').count();
  ok(open === 1, `one dropdown open at a time (${open})`);
  ok(await groups.nth(1).getAttribute('class').then((c) => c.includes('open')), 'the second is the open one');
  await page.keyboard.press('Escape');
  ok(await page.locator('#site-nav .has-sub.open').count() === 0, 'Escape closes the dropdown');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('#site-nav .has-sub:nth-child(2) .sub-toggle')), 'Escape returns focus to its button');
  await page.mouse.click(640, 600);
  // Hover opens, leaving closes.
  await groups.nth(2).hover();
  await page.waitForTimeout(50);
  ok(await groups.nth(2).getAttribute('class').then((c) => c.includes('open')), 'hover opens a section');
  await page.mouse.move(640, 700);
  await page.waitForTimeout(300);
  ok(await page.locator('#site-nav .has-sub.open').count() === 0, 'leaving closes a hover-opened section');
  await ctx.close();
}

// 4. Help bar on a Legal Clinic page (phone): hidden while a clinic callout is on screen.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/legal-clinic/', { waitUntil: 'networkidle' });
  ok(await page.locator('.help-bar').count() === 1, 'help bar rendered on /legal-clinic/');
  ok(await page.locator('.help-bar').evaluate((el) => getComputedStyle(el).display !== 'none'), 'help bar shown on phone');
  const cta = page.locator('.clinic-cta').first();
  ok(await cta.count() >= 1, 'clinic callouts carry .clinic-cta');
  await cta.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  ok(await page.getAttribute('.help-bar', 'data-hidden') === 'true', 'help bar hides while a callout is on screen');
  // Scroll to a spot with no callout on screen (the first one sits right under the hero).
  await page.evaluate(() => {
    const ctas = [...document.querySelectorAll('.clinic-cta')].map((el) => { const r = el.getBoundingClientRect(); return [r.top + window.scrollY, r.bottom + window.scrollY]; });
    const h = window.innerHeight; let y = 0;
    while (ctas.some(([t, b]) => b > y - 50 && t < y + h + 50)) y += 200;
    window.scrollTo(0, y);
  });
  await page.waitForTimeout(300);
  ok(await page.getAttribute('.help-bar', 'data-hidden') === 'false', 'help bar returns when no callout is on screen');
  await page.goto(BASE + '/about/', { waitUntil: 'networkidle' });
  ok(await page.locator('.help-bar').count() === 0, 'no help bar on a non-clinic page');
  await ctx.close();
}

// 5. Mock forms: error summary, inline errors, success state; new-tab notes.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/legal-clinic/intake/', { waitUntil: 'networkidle' });
  await page.click('form[data-mock] button[type="submit"]');
  await page.waitForSelector('.error-summary[role="alert"]');
  ok(await page.evaluate(() => document.activeElement.classList.contains('error-summary')), 'error summary focused');
  const links = await page.locator('.error-summary a').count();
  ok(links >= 3, `summary links each invalid field (${links})`);
  ok(await page.locator('[aria-invalid="true"]').count() === links, 'aria-invalid matches the summary');
  await page.click('.error-summary a:first-child');
  ok(await page.evaluate(() => /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)), 'summary link focuses its field');
  await page.goto(BASE + '/contact/', { waitUntil: 'networkidle' });
  await page.fill('#ct-name', 'Test'); await page.fill('#ct-email', 'test@example.com'); await page.fill('#ct-msg', 'Hello');
  await page.click('form[data-mock] button[type="submit"]');
  await page.waitForSelector('.form-success.show');
  ok(await page.locator('.form-success.show').count() === 1, 'valid submit shows the preview success note (nothing sent)');
  ok(await page.locator('.eo-staging-note').count() >= 1, 'staging notes carry .eo-staging-note');
  await page.goto(BASE + '/give/', { waitUntil: 'networkidle' });
  const ext = await page.locator('a[target="_blank"]').count();
  const noted = await page.locator('a[target="_blank"] .new-tab-note').count();
  ok(ext > 0 && ext === noted, `every new-tab link announces it (${noted}/${ext})`);
  await ctx.close();
}

// 6. Short viewport: the header is not sticky below 30em.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 400 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/legal-clinic/', { waitUntil: 'networkidle' });
  ok(await page.locator('.site-header').evaluate((el) => getComputedStyle(el).position) !== 'sticky', 'short viewport: header scrolls with the page');
  await ctx.close();
}

await b.close();
console.log(`\n${failures} failure(s)`);
process.exit(failures ? 1 : 0);
