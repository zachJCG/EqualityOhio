/**
 * tests/support/freshness.mjs
 * ---------------------------
 * Date rules for content that expires, kept pure so tests can inject "today".
 *
 *   EVENT blocks   public/get-involved/events.html wraps each event in
 *                  <!-- EVENT: name, YYYY-MM-DD ... --> ... <!-- /EVENT -->.
 *                  The block's first <time datetime> must be today or later
 *                  in America/New_York (an event on its own day still shows).
 *   empty state    when no EVENT block remains, the page must show the
 *                  "No upcoming events" callout that the EMPTY STATE comment
 *                  in events.html holds ready (un-commented, in place of the
 *                  card grid).
 *   data-expires   any element anywhere with data-expires="YYYY-MM-DD"
 *                  expires at the end of that day: it fails once the date is
 *                  in the past. Use it for job openings, election-cycle copy
 *                  and anything else with an end date.
 */

import { cleanText, elements, find, hasClass, parseHtml } from '../../scripts/check-links.mjs';

export const TIME_ZONE = 'America/New_York';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' for `now` in America/New_York. */
export function todayInNewYork(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * "Today" for the content checks: EO_TODAY=YYYY-MM-DD overrides the clock,
 * so a pre-deploy run can ask "is anything stale on launch day?".
 */
export function contentToday(env = process.env, now = new Date()) {
  const override = env.EO_TODAY?.trim();
  if (override) {
    if (!isRealDate(override)) throw new Error(`EO_TODAY="${override}" is not a YYYY-MM-DD date`);
    return override;
  }
  return todayInNewYork(now);
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isRealDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/**
 * The EVENT blocks of a page: [{ name, line, date, datetime, problem }].
 * `date` is the YYYY-MM-DD of the block's first <time datetime> (null when
 * there is none or it is not a date).
 */
export function eventBlocks(html) {
  const blocks = [];
  const re = /<!--\s*EVENT:([\s\S]*?)-->([\s\S]*?)<!--\s*\/EVENT\s*-->/g;
  for (const m of html.matchAll(re)) {
    const name = m[1].trim().split(/\s[—–-]\s|\.\s/)[0].trim();
    const body = m[2].replace(/<!--[\s\S]*?-->/g, '');
    const time = body.match(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i);
    const datetime = time ? time[1].trim() : null;
    const date = datetime && isRealDate(datetime.slice(0, 10)) ? datetime.slice(0, 10) : null;
    let problem = null;
    if (!datetime) problem = 'has no <time datetime="YYYY-MM-DD">';
    else if (!date) problem = `has an unreadable datetime "${datetime}"`;
    blocks.push({ name, line: lineAt(html, m.index), date, datetime, problem });
  }
  const opens = (html.match(/<!--\s*EVENT:/g) || []).length;
  if (opens !== blocks.length) {
    blocks.push({ name: '(unterminated block)', line: 0, date: null, datetime: null, problem: `${opens - blocks.length} <!-- EVENT: --> block(s) have no closing <!-- /EVENT -->` });
  }
  return blocks;
}

/**
 * Is the empty-state callout on the page, outside comments? It is a
 * .callout element whose text says "No upcoming events".
 */
export function hasEmptyState(html) {
  const doc = parseHtml(html);
  return Boolean(find(doc, (el) => hasClass(el, 'callout') && /no upcoming events/i.test(cleanText(el))));
}

/** Problems for the events page on `today`: strings. */
export function eventProblems(html, today) {
  const problems = [];
  const blocks = eventBlocks(html);
  for (const block of blocks) {
    if (block.problem) problems.push(`EVENT "${block.name}" (line ${block.line}) ${block.problem}`);
    else if (block.date < today) {
      problems.push(`EVENT "${block.name}" (line ${block.line}) was on ${block.date}, before ${today}: delete the whole <!-- EVENT --> block`);
    }
  }
  if (blocks.length === 0 && !hasEmptyState(html)) {
    problems.push('no EVENT blocks remain and the empty-state callout is missing: un-comment the EMPTY STATE block in place of the card grid');
  }
  return problems;
}

/** data-expires problems in one page on `today`: strings. */
export function expiryProblems(html, today) {
  const problems = [];
  for (const el of elements(parseHtml(html))) {
    if (!('data-expires' in el.attrs)) continue;
    const value = el.attrs['data-expires'].trim();
    const what = `<${el.name}${el.attrs.id ? ` id="${el.attrs.id}"` : ''}> (line ${el.line})`;
    if (!isRealDate(value)) problems.push(`${what} has data-expires="${value}", which is not a YYYY-MM-DD date`);
    else if (value < today) problems.push(`${what} expired on ${value} (today is ${today}): remove it or update the date`);
  }
  return problems;
}
