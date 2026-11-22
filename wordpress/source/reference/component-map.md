# Component Map: Source Classes to WordPress Blocks

The source has one component stylesheet, `eo-site.css`, and the pages use its classes consistently. Counts below are uses in the 29 page bodies (`inventory/inventory.json` has the full list).

The approach that keeps both promises — same site, editable by staff:

1. Keep `eo-site.css` as it is and enqueue it on the front end and in the editor.
2. Express each component as core blocks that carry the source class, wrapped as a pattern so staff insert the whole component at once.
3. Put every WordPress-specific adjustment in one new file, `eo-wp.css`. WordPress wraps things differently (a button is a `div` around an `a`; a link inside a paragraph cannot carry its own class), and that file is where the difference is absorbed.
4. Use a raw HTML block only where no core block fits, keep a list of each one, and report the list.

These are recommendations to prove in the editor, not settled facts. Where a row says "verify", the behavior depends on what the block editor keeps on save.

## Layout

| Source | Uses | Block approach |
|---|---|---|
| `.section`, `.section--soft` | 79, 29 | Group rendered as `<section>`, full width. "Soft" as a block style |
| `.container`, `.container--narrow` | 127, 16 | Either an inner Group with the class, or the section's own constrained layout at 1160px. Choose one and use it on every page |
| `.section__head` with `.eyebrow` and a heading | 42 | Pattern "Section Heading": Paragraph styled as eyebrow, then Heading |
| `.eyebrow` | 96 | Paragraph block style. It is a label, never a heading |
| `.split`, `.split--center` | 18 | Columns, or Group with a two-column grid |
| `.card-grid--1` to `--4` | 31 | Group with grid layout; the column count as a block style |
| `.band` | 19 | Group as `<section>`, block style "Band". Text and buttons inside use the on-dark variants |
| `.center`, `.lede`, `.hint`, `.mt-0` to `.mt-3` | 17, 10, 29 | Utility classes through "Additional CSS class"; `.lede` and `.hint` are better as Paragraph block styles |

## Hero

| Source | Uses | Block approach |
|---|---|---|
| `.hero` (home page) | 1 | Locked pattern: eyebrow, H1, lede, two buttons, logo art |
| `.hero--interior` | 28 | Locked pattern: eyebrow, H1, lede |

The H1 lives in the page content. It is not the WordPress page title: `/about/` has the H1 "Who we are", the menu label "Mission & Values" and the browser title "About Us — Equality Ohio". Page templates must not print the post title, or every page gets two H1s.

## Cards

| Source | Uses | Block approach |
|---|---|---|
| `.card` and `.card--flat` | 138, 6 | Group with block style "Card" |
| `.card--path` with `is-blue` or `is-green` | 28 | Block style variations of the card |
| `.card__kicker` | 51 | Paragraph block style |
| `.card__link` | 53 | In the source the class sits on the `<a>`, and a card that has one is clickable as a whole. A link inside a Paragraph may not keep its own class (verify), so put the class on the Paragraph and restyle `p.card__link > a` in `eo-wp.css` |
| `.news-card` | 8 | Pattern: colored media area with a pill, date, title, summary, link |
| `.person-card` | 57 | Pattern: initials avatar, name, role. 18 on leadership, 15 on staff, 12 on legacy, 12 on the voters guide. On the staff page each card needs its HTML anchor |
| `.tier-card` | 3 | Pattern, used once for the three giving tiers on `/give/` |

## Content

| Source | Uses | Block approach |
|---|---|---|
| `.btn` with `--primary` (18), `--outline` (11), `--on-dark` (16), `--gold` (3), `--lg` (23) | 48 | Button block with four registered block styles; size as a class. Focus outlines must survive the mapping |
| `.value-row` | 21 | Pattern: number, heading, text |
| `.timeline` | 2 lists, 14 entries | Each entry is a year, an H3 and a paragraph inside a list item. A List block item cannot hold a heading, so build grouped rows, or keep the list as raw HTML on the allow-list if list semantics matter more |
| `.stat-grid` | 3 grids, 12 stats | Group grid of number and label pairs |
| `.quote-block` | 7 | Paragraph block style, or Quote |
| `.resource-links` | 10 | List block style. `.ext` (32) is a small label inside the link text, such as "Guide"; verify the span survives a save |
| `.pill` and variants | 10 | A label inside the news-card media area. Part of that pattern |
| `.sr-only` | 14 | Mostly spans inside link text that name the link's target. Verify they survive an editor save |

## Legal Clinic

| Source | Uses | Block approach |
|---|---|---|
| `.callout--clinic` | 7 | Pattern. Five carry a bare `data-cta` attribute that the help-bar script watches; give the pattern a class the script can use instead |
| Phone help bar | 3 pages | A template part included by a "Legal Clinic Guide" page template: `/legal-clinic/`, the family law guide and the trans rights guide |

## Forms

| Source | Uses | Block approach |
|---|---|---|
| `.form-shell`, `.form-grid`, `.choice` tiles, `.form-legend-note`, `.newsletter` | 6 shells, 14 choice tiles | One raw HTML block per preview form, inside a pattern. Core has no form block to rely on, and each of these is replaced by a real service in Phase 5 |
| `.form-note` | 14 | The staging-note pattern. Every preview notice uses it |
| `.form-success` | 6 | Part of the preview form; it is what the script reveals after a valid submit |

## Images

Three images appear in page bodies: the logo art in the home hero, the Legal Clinic mark, and the scorecard banner (home, inside an expired block, and `/votersguide/`). The source serves AVIF and WebP through `<picture>`. An Image block with WordPress's own responsive sizes is an acceptable trade; keep `width`, `height` and the alt text exactly.

## Attributes Core Blocks Do Not Keep

| Source attribute | Where | What to do |
|---|---|---|
| `id` on sections, cards and headings | 94 ids | Use the block's HTML anchor. All of them fit |
| `data-cta` | 5 callouts | Class hook, and update the selector in the script |
| `data-expires` | 4 blocks, all expired | Nothing to port today. If you keep the convention, carry the date as a class such as `expires-2026-11-04` and check it in a script |
| `data-mock`, `data-error` | The 6 preview forms | They live inside raw HTML blocks, so they are kept |
| `<time datetime>` | 7 | Inline HTML inside a Paragraph; verify it survives a save |
| `style=""` | 111 | Convert to classes or block settings |
