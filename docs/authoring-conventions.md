# Page authoring conventions — Equality Ohio redesign

Every static page under `public/` follows the same pattern. `public/give.html`
is the reference exemplar for an interior page; `public/index.html` for the
home page. Read one before writing a new page.

## Skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- STAGING: keep noindex until production launch -->
    <meta name="robots" content="noindex, nofollow" />
    <title>Page Name — Equality Ohio</title>
    <meta name="description" content="..." />
    <meta name="theme-color" content="#5A3F99" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Equality Ohio — Design Preview" />
    <meta property="og:title" content="Page Name — Equality Ohio" />
    <meta property="og:description" content="..." />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='95' fill='%230093D0'/%3E%3Crect x='55' y='78' width='90' height='16' fill='white'/%3E%3Crect x='55' y='108' width='90' height='16' fill='white'/%3E%3C/svg%3E" />
    <link rel="stylesheet" href="/css/eo-fonts.css" />
    <link rel="stylesheet" href="/css/eo-site.css" />
  </head>
  <body data-page="PAGE-ID">
    <div data-site-header></div>
    <main id="main">
      <!-- sections -->
    </main>
    <div data-site-footer></div>
    <script src="/js/eo-site-template.js" defer></script>
  </body>
</html>
```

(Copy the favicon line exactly from an existing page — do not retype it.)

- `data-page` must match the page's id in the nav model in
  `public/js/eo-site-template.js` (that is what highlights the current nav
  item). Header, footer, and preview ribbon are injected by that script —
  never hand-write them into a page.
- Interior pages open with `<section class="hero hero--interior">` containing
  `.eyebrow` + `<h1>` + `.hero__lede`.

## Components available (css/eo-site.css)

`.section` / `.section--soft` (alt background) / `.band` (purple CTA band) ·
`.container` · `.section__head` · `.card-grid--2/--3/--4` + `.card`
(`.card__kicker`, `.card__link`, `.card--path is-blue/is-green`) ·
`.tier-card` (giving) · `.news-card` · `.person-card` (avatar initials — no
photography anywhere) · `.value-row` · `.timeline` (`.timeline__year`) ·
`.stat-grid` (`.stat__num`, `.stat__label`) · `.callout--clinic` ·
`.form-shell`, `.form-grid`, `.form-note`, `.form-success` · `.newsletter` ·
`.quote-block` · `.resource-links` (link list with `.ext` annotation) ·
`.pill--breaking/--policy/--program` · `.btn--primary/--outline/--gold/--on-dark/--lg` ·
`.split` · `.lede` · `.center` · `.mt-0/1/2/3` · `.eyebrow--on-dark`.

## Brand rules (WCAG AA — computed, do not re-derive)

- Purple `var(--eo-purple)` is the primary; white text on it is safe.
- `--eo-blue` on white: LARGE text and graphics only. Small links use
  `--eo-blue-ink`.
- `--eo-green`: decorative bars/icons ONLY, never text.
- Gold pills take `--eo-ink` text, never white.
- Photography is intentionally absent (nothing licensed yet) — brand-color
  art blocks hold those slots.

## Content rules

- **Copy comes from equalityohio.org only.** Fetch the live page(s) and reuse
  Equality Ohio's actual language (tightened for the new layout is fine).
  Never invent programs, statistics, names, dates, or eligibility rules.
- **Nothing expired gets ported.** Old campaigns, past events, and stale
  template pages stay behind — they are 301s in `next.config.mjs`, not pages.
  Events pages include only events dated today or later; each event block is
  self-contained so it can be deleted in one cut when it passes.
- **Forms are visual only**: `data-mock="true"`, a `.form-success` block
  explaining nothing was transmitted, and a route to a real channel
  (855-LGBT-LAW for clinic matters, info@equalityohio.org otherwise).
- **Embeds that can't be recreated yet** (interactive maps, video players,
  EveryAction/NGP giving forms, Mailchimp/EveryAction signup embeds): render
  a `.form-note` block that names the pending embed, and link out to the live
  equalityohio.org page in the meantime (`rel="noopener" target="_blank"`).
- **Donations link out to EveryAction (NGP)** — direct `secure.everyaction.com`
  URLs, opened in a new tab. Never a fake donation form.
- Internal links use clean URLs (`/legal-clinic/intake`, never `.html`).
- External links: `rel="noopener"` and `target="_blank"`.
- Phone links: `tel:` URIs (855-LGBT-LAW is `tel:18555428529`).
- Escape entities in copy: `&rsquo;` `&amp;` `&mdash;` etc.; non-breaking
  hyphen `&#8209;` in "855&#8209;LGBT&#8209;LAW".

## Canonical URL map (internal links must use these)

`/` · `/about` · `/about/history` · `/about/leadership` ·
`/about/staff-interns` · `/about/jobs-internships` · `/legal-clinic` ·
`/legal-clinic/intake` · `/legal-clinic/intake/thank-you` ·
`/legal-clinic/ohio-lgbtq-family-law-guide` ·
`/legal-clinic/trans-know-your-rights` · `/legal-clinic/legal-network` ·
`/get-involved` · `/get-involved/volunteer` · `/get-involved/events` ·
`/our-work` · `/our-work/local` · `/our-work/local/municipal-map` ·
`/our-work/business` · `/our-work/legacy-of-equality` · `/votersguide` ·
`/stories` · `/newsletter` · `/jim-obergefell-john-arthur-society` · `/give`
(anchors: `#one-time` `#defenders` `#society` `#daf` `#stock` `#legacy`
`#in-kind`) · `/news` · `/contact`
