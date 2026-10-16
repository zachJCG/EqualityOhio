# Page authoring conventions: Equality Ohio redesign

Every page is static HTML under `public/`. The page file holds only its own
content: the `<head>` metadata, the header and the footer are generated into
it by `npm run pages:build` (`scripts/build-pages.mjs`). `public/give.html` is
the reference interior page and `public/index.html` the home page; read one
before writing a new page.

## Skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- seo:start -->
    <!-- seo:end -->
  </head>
  <body data-page="PAGE-ID">
    <!-- chrome:header:start -->
    <!-- chrome:header:end -->
    <main id="main">
      <section class="hero hero--interior">
        <div class="container">
          <span class="eyebrow">Section</span>
          <h1>Page title</h1>
          <p class="hero__lede">…</p>
        </div>
      </section>
      <!-- sections -->
    </main>
    <!-- chrome:footer:start -->
    <!-- chrome:footer:end -->
    <script src="/js/eo-site-template.js" defer></script>
  </body>
</html>
```

Then:

1. **`data-page`** must be one of `KNOWN_PAGE_IDS` in `lib/chrome.mjs`: a
   `page` in `NAV_ITEMS` (that is what marks the current nav item with
   `aria-current`) or one of the extras (`home`, `give`, `privacy`, `terms`,
   `gate`, `not-found`). A new section of the site gets a `NAV_ITEMS` entry.
   Add the page to `HELP_BAR_PAGES` only if it is a Legal Clinic guide people
   read in a hurry.
2. **Add a `PAGES` entry in `lib/seo.mjs`**: `url`, `title` (`Page — Equality
   Ohio`), `description` (EO's own words, at most 160 characters), `section`
   (which share card) and the sitemap `priority` / `changefreq`, or
   `noindex: true` for pages that stay out of search.
3. **Run `npm run pages:build`**, then `npm test`. `check:pages` fails on a
   missing or orphaned registry entry, an unknown `data-page`, more or fewer
   than one `<h1>`, a skipped heading level, a missing `<main id="main">`, an
   inline script or handler, or a stale region.

Never type anything between the markers: the next build overwrites it.
Outside them, the generator also removes any hand-written tag it owns
(title, description, robots, `og:`/`twitter:` metas, canonical, icons,
manifest, font preloads, the site stylesheets, JSON-LD), so a duplicate
cannot linger. Page-scoped `<style>` blocks stay where they are.

## Page rules

- One `<h1>`; headings never skip a level. When a card title must look small
  under an `<h2>` section, keep it an `<h2>` or `<h3>` in the outline and use
  `.h3` for the look.
- Interior pages open with `<section class="hero hero--interior">` holding
  `.eyebrow` + `<h1>` + `.hero__lede`.
- Every `<img>` has `alt`, `width` and `height`.
- **No inline `<script>` and no `on*=` attributes.** The static pages are
  served with `script-src 'self'`; behavior goes in `public/js/`. JSON-LD is
  generated.
- **No color literals.** Colors come from `var(--eo-*)` in
  `public/css/eo-brand-tokens.css`, including in `style=""` and SVG paint
  (`currentColor` works). `npm run check:tokens` fails otherwise.
- Prefer component classes and the `.mt-*` utilities over `style=""`.

## Components (`public/css/eo-site.css`)

**Layout** `.container` (`--narrow`) · `.section` / `.section--soft` · `.band`
(purple band, `.eyebrow--on-dark`, `.btn--on-dark`) · `.section__head` ·
`.split` (`--center`) · `.card-grid--1/--2/--3/--4` · `.center` · `.lede` ·
`.mt-0/1/2/3` · `.sr-only`

**Hero** `.hero`, `.hero--interior`, `.hero__lede`, `.hero__ctas`,
`.hero__art`, `.hero__split`

**Cards** `.card` (`.card__kicker`, `.card__link`, `.card__phone`); a card
with a `.card__link` lifts and is clickable as a whole unless it is
`.card--flat` · `.card--path` with `is-blue` / `is-green` · `.news-card`
(`__media` with `alt-a/b/c`, `__body`, `__date`, `__title`,
`.news-card--feature`) · `.person-card` (`__avatar` initials, `__role`; no
photography) · `.tier-card` (`--featured`, `__flag`, `__price`, `__cadence`,
`__per`) with `.perk-list`

**Content** `.value-row` (`__num`) · `.timeline` (`__year`) · `.stat-grid`
(`.stat__num`, `.stat__label`) · `.quote-block` · `.resource-links` (with an
`.ext` note) · `.pill--breaking/--policy/--program/--on-media`, plus
`.pill--as-written` where case matters (501(c)(3)) ·
`.btn--primary/--outline/--gold/--on-dark/--lg`

**Legal Clinic** `.callout--clinic` (`__text`, `__body`, `__phone`) marked
`data-cta`, so the phone **help bar** (generated on `HELP_BAR_PAGES`) slides
away while the callout is on screen.

**Forms** `.form-shell` (`--narrow`, `__title`) · `.form-grid` with `.full`
rows · `.req` (visible asterisk, `aria-hidden`) and `.optional` in labels ·
`.hint` tied to its field with `aria-describedby` · `.form-legend-note`
(“*” indicates required fields) · `.choice` tiles (44px; a checkbox or radio
plus its label, inside a `<fieldset>` with a `<legend>`; `.choice-grid` for
two columns) · `.newsletter` (inline signup row) · `.form-note` (preview or
pending-embed notice) · `.form-success` (shown after a valid mock submit).
The **error summary** (`.error-summary`) and inline **field errors**
(`.field-error`) are created by the script; give a control `data-error="…"`
when the default message would not read well.

## Mock forms

```html
<p class="form-note">Design preview — this form isn&rsquo;t connected yet and nothing you type is saved or sent. …</p>
<form data-mock="true" aria-label="Contact form">
  … every control has an id and a <label for>; required ones carry `required` …
  <button class="btn btn--primary" type="submit">Send Message</button>
</form>
<div class="form-success"><h2>…</h2><p>…</p></div>
```

The script validates on submit: an empty or invalid submit focuses the error
summary (each entry links to its field, each field gets `aria-invalid` and an
inline message); a valid submit disables the form and shows `.form-success`,
which says nothing was transmitted and routes to a real channel. The success
block sits in the form's parent, or anywhere with `data-success="id"` on the
form. Mock forms are launch blockers: `npm test` fails on any
`form[data-mock="true"]` once `LAUNCHED` is true.

## Brand, accessibility and motion

- Purple (`--eo-purple`) is the primary; white text on it is safe.
- `--eo-blue` on white is for **large** text and graphics only; small links
  and avatar initials use `--eo-blue-ink`.
- `--eo-green` is decorative (bars, icons), never text.
- Gold backgrounds take `--eo-ink` text, never white.
- Focus is a solid outline (purple on light, gold on dark), never removed.
- Targets: at least 24px everywhere (desktop dropdown toggles), 44px for
  the menu button, the phone dropdown toggles and the choice tiles.
- Motion uses the `--eo-dur-*` and `--eo-ease-*` tokens and animates only
  `transform` and `opacity`. Under `prefers-reduced-motion` the durations are
  0 and smooth scrolling is off. Scroll reveal is automatic (desktop, below
  the fold only); never add your own hidden-until-scrolled styles.
- Phone numbers never wrap (`a[href^="tel:"]`), long addresses do; nothing
  may scroll sideways at 320px.
- Photography is intentionally absent (nothing licensed yet).

## Content rules

- **Copy comes from equalityohio.org only.** Reuse Equality Ohio's own
  language (tightened for the layout is fine). Never invent programs,
  statistics, names, dates, eligibility rules or legal guidance.
- **Nothing expired ships.** Old campaigns, past events and template pages
  are redirects in `next.config.mjs`, not pages. On
  `/get-involved/events`, each event `<article>` sits between
  `<!-- EVENT: name — YYYY-MM-DD -->` and `<!-- /EVENT -->`, and its first
  `<time datetime>` dates it; with none left, the "There are no upcoming
  events." callout shows (the comment in the page explains the swap). Anything else with an end date carries
  `data-expires="YYYY-MM-DD"` (election content: `2026-11-04`). `npm test`
  fails the day after.
- **Embeds that can't be recreated yet** (maps, video, EveryAction or
  Lawmatics forms, story feeds): a `.form-note` naming the pending embed and
  a link to the live page or the live form host.
- **Donations link out to EveryAction (NGP)**: the human
  `https://secure.everyaction.com/<formId>` page, in a new tab. Never a fake
  donation form, never the `/v1/Forms/` JSON endpoint. Form ids:
  `docs/site-map.md`.
- Internal links use clean URLs (`/legal-clinic/intake`): never `.html`,
  never a trailing slash, anchors must exist.
- External links: `rel="noopener"` and `target="_blank"`. The script adds
  the screen-reader "(opens in a new tab)" note.
- Phone links: `tel:+1…` (855-LGBT-LAW is `tel:+18555428529`). Every `tel:`
  and `mailto:` must be an `ORG` fact in `lib/site.mjs` or on the allowlist
  in `tests/site-rules.test.mjs`.
- Entities in copy: `&rsquo;` `&amp;` `&mdash;`; non-breaking hyphens in
  `855&#8209;LGBT&#8209;LAW`.

## Canonical URL map (internal links must use these)

`/` · `/about` · `/about/history` · `/about/leadership` ·
`/about/staff-interns` · `/about/jobs-internships` · `/contact` ·
`/legal-clinic` · `/legal-clinic/intake` · `/legal-clinic/intake/thank-you` ·
`/legal-clinic/ohio-lgbtq-family-law-guide` ·
`/legal-clinic/trans-know-your-rights` · `/legal-clinic/legal-network` ·
`/get-involved` · `/get-involved/volunteer` · `/get-involved/events` ·
`/stories` · `/newsletter` · `/our-work` · `/our-work/local` ·
`/our-work/local/municipal-map` · `/our-work/business` ·
`/our-work/legacy-of-equality` · `/votersguide` · `/give` (anchors:
`#one-time` `#defenders` `#society` `#daf` `#stock` `#legacy` `#in-kind`) ·
`/jim-obergefell-john-arthur-society` · `/news` · `/privacy-policy` ·
`/terms-conditions`
