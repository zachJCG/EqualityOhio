/**
 * tests/freshness.test.mjs
 * ------------------------
 * Nothing expired ships (docs/authoring-conventions.md, "Content rules"):
 *
 *   - every <!-- EVENT: --> block on /get-involved/events is dated today or
 *     later in America/New_York; with no blocks left, the empty-state
 *     callout is on the page
 *   - no element anywhere under public/ carries a data-expires date in the
 *     past
 *
 * These are date-based on purpose: a quiet day with no code change can turn
 * them red, and that is the signal to delete the passed content. Set
 * EO_TODAY=YYYY-MM-DD to check a future day (for example launch day).
 *
 * The first group pins the rules themselves with an injected "today".
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { staticPages } from '../lib/static-pages.mjs';
import {
  EMPTY_STATE_MARKUP,
  contentToday,
  eventBlocks,
  eventProblems,
  expiryProblems,
  hasEmptyState,
  isRealDate,
  todayInNewYork,
} from './support/freshness.mjs';

const EVENTS_FILE = fileURLToPath(new URL('../public/get-involved/events.html', import.meta.url));

const event = (name, date) => `
      <!-- EVENT: ${name} — ${date}. Delete this entire <article> once the date has passed. -->
      <article class="card"><h3>${name}</h3><p><time datetime="${date}">A day</time></p>
      <p>Doors at <time datetime="2099-01-01T18:00">6 PM</time></p></article>
      <!-- /EVENT -->`;
const EMPTY_STATE = `
    <div class="callout center">
      <h3>No upcoming events right now</h3>
      <p>Sign up for the newsletter.</p>
    </div>`;
const page = (inner) => `<!doctype html><html lang="en"><body><main id="main">${inner}</main></body></html>`;

describe('freshness rules (injected today)', () => {
  const today = '2026-10-16';

  test('todayInNewYork uses the America/New_York calendar day', () => {
    // 03:30 UTC on Oct 17 is still the evening of Oct 16 in Ohio (EDT, UTC-4).
    assert.equal(todayInNewYork(new Date('2026-10-17T03:30:00Z')), '2026-10-16');
    assert.equal(todayInNewYork(new Date('2026-10-17T04:30:00Z')), '2026-10-17');
    // EST in winter (UTC-5).
    assert.equal(todayInNewYork(new Date('2027-01-01T04:59:00Z')), '2026-12-31');
  });

  test('EO_TODAY overrides the clock and must be a real date', () => {
    assert.equal(contentToday({ EO_TODAY: '2026-11-03' }), '2026-11-03');
    assert.equal(contentToday({}, new Date('2026-10-16T12:00:00Z')), '2026-10-16');
    assert.throws(() => contentToday({ EO_TODAY: '2026-02-30' }), /not a YYYY-MM-DD date/);
    assert.equal(isRealDate('2028-02-29'), true);
    assert.equal(isRealDate('2026-13-01'), false);
  });

  test('a past event fails, an event today or later passes', () => {
    assert.deepEqual(eventProblems(page(event('Today', today) + event('Later', '2026-12-01')), today), []);
    const problems = eventProblems(page(event('Gone', '2026-10-15')), today);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /EVENT "Gone" .* was on 2026-10-15, before 2026-10-16/);
  });

  test('only the first <time> of a block dates it', () => {
    const [block] = eventBlocks(page(event('Early', '2026-01-01')));
    assert.equal(block.date, '2026-01-01');
    assert.equal(block.name, 'Early');
  });

  test('a block with no or a malformed datetime fails', () => {
    const noTime = page('<!-- EVENT: Mystery --><article><h3>Mystery</h3></article><!-- /EVENT -->');
    assert.match(eventProblems(noTime, today)[0], /has no <time datetime/);
    const badTime = page('<!-- EVENT: Bad --><time datetime="soon">Soon</time><!-- /EVENT -->');
    assert.match(eventProblems(badTime, today)[0], /unreadable datetime "soon"/);
    const open = page('<!-- EVENT: Open --><time datetime="2027-01-01">x</time>');
    assert.match(eventProblems(open, today).join('\n'), /no closing <!-- \/EVENT -->/);
  });

  test('no events left requires the uncommented empty-state callout', () => {
    const [missing] = eventProblems(page('<div class="card-grid"></div>'), today);
    assert.match(missing, /empty-state callout is missing/);
    assert.ok(missing.includes(EMPTY_STATE_MARKUP), 'the failure carries the exact markup to restore');
    assert.deepEqual(eventProblems(page(EMPTY_STATE_MARKUP), today), [], 'the markup it names satisfies the rule');
    assert.match(eventProblems(page(`<!-- EMPTY STATE: un-comment ${EMPTY_STATE} -->`), today)[0], /empty-state callout is missing/);
    assert.deepEqual(eventProblems(page(EMPTY_STATE), today), []);
    assert.equal(hasEmptyState(page(EMPTY_STATE)), true);
  });

  test('data-expires fails the day after its date and rejects bad dates', () => {
    const job = (date) => page(`<article id="extern" data-expires="${date}">Fall legal extern</article>`);
    assert.deepEqual(expiryProblems(job(today), today), []);
    assert.deepEqual(expiryProblems(job('2027-01-01'), today), []);
    assert.match(expiryProblems(job('2026-10-15'), today)[0], /<article id="extern"> .* expired on 2026-10-15/);
    assert.match(expiryProblems(job('10/31/2026'), today)[0], /not a YYYY-MM-DD date/);
    // Commented-out markup never counts.
    assert.deepEqual(expiryProblems(page('<!-- <p data-expires="2001-01-01">old</p> -->'), today), []);
  });
});

describe('site content is current', () => {
  const today = contentToday();

  test(`/get-involved/events lists only events on or after ${today}`, () => {
    const problems = eventProblems(readFileSync(EVENTS_FILE, 'utf8'), today);
    assert.deepEqual(problems, [], `public/get-involved/events.html:\n  ${problems.join('\n  ')}`);
  });

  test(`no data-expires date before ${today} anywhere under public/`, () => {
    const problems = staticPages().flatMap((p) =>
      expiryProblems(readFileSync(p.abs, 'utf8'), today).map((msg) => `public${p.file}: ${msg}`),
    );
    assert.deepEqual(problems, [], problems.join('\n'));
  });
});
