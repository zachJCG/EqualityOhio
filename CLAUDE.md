# CLAUDE.md: Equality Ohio website redesign

The redesign of equalityohio.org, built by Joseph Carter Group for Equality
Ohio (EO). Today it is a **password-gated staging preview** on Vercel. Every
page stays `noindex` until the one launch switch is flipped.

Read `README.md` first, then `docs/authoring-conventions.md` before touching a
page, `docs/site-map.md` before touching a URL, and `docs/launch-checklist.md`
before anything launch-related.

## Source of truth

- **Code:** `github.com/zachJCG/EqualityOhio` (the remote of this checkout).
  Treat it as public: never commit a secret, a real password or a `.env`
  file.
- **Copy:** the live equalityohio.org only. Every sentence, name, date,
  program and figure on these pages comes from EO's own site, verbatim or
  tightened. Nothing is invented.
- **URLs:** `docs/legacy-sitemap-urls.txt` is the snapshot of the live
  WordPress sitemaps (553 paths, re-checked 2026-10-16). Every one of them
  must keep working.

## Architecture

- **Next.js 15.5, React 19, Node 22, JavaScript only** (no TypeScript), on
  Vercel. There are no App Router pages yet: `app/` holds only route
  handlers and metadata routes (`api/gate`, `robots.js`, `sitemap.js`,
  `manifest.js`). There is deliberately no `app/layout.js`.
- **Every page is static HTML under `public/`** and answers on its clean URL
  (`public/about/history.html` is `/about/history`). `lib/static-pages.mjs`
  walks `public/` once; `next.config.mjs`, the generator, the sitemap and the
  tests all use that walk. The rewrites are `afterFiles`, so the day a page
  becomes `app/<path>/page.js` the real route wins. When you delete a static
  page for a port, add its URL to `PORTED` in `next.config.mjs`.
- **Generated regions. Never hand edit inside them.** `npm run pages:build`
  (`scripts/build-pages.mjs`) rewrites three regions in every page:
  - `<!-- seo:start -->` … `<!-- seo:end -->` in `<head>`: robots, title,
    description, canonical (launched only), Open Graph and Twitter tags,
    theme color, icons, manifest, font preloads, the three stylesheets and
    JSON-LD. Source: `lib/seo.mjs` (`PAGES`, one entry per URL).
  - `<!-- chrome:header:start -->` … `:end -->`, first thing in `<body>`: skip
    link, preview ribbon, equality bar and the sticky header with the nav.
  - `<!-- chrome:footer:start -->` … `:end -->`, after `</main>`: the phone
    help bar (Legal Clinic pages only) and the footer. Source for both:
    `lib/chrome.mjs` (`NAV_ITEMS`, footer columns, `HELP_BAR_PAGES`).

  To change the nav, footer, a title or a description, edit `lib/*.mjs` and
  run `npm run pages:build`. `npm run check:pages` (in `npm test`) fails on
  drift.
- **One launch switch:** `LAUNCHED` in `lib/site.mjs`. It drives the robots
  meta, canonical, `og:site_name`, the preview ribbon and footer credit (via
  the generator), the gate (`middleware.js` becomes a pass-through),
  `X-Robots-Tag` (`next.config.mjs`) and `/robots.txt` (`app/robots.js`).
  Static HTML cannot read env, so flipping it means a `pages:build` and a
  commit. Indexing is allowed only when `LAUNCHED` and
  `VERCEL_ENV=production`, so previews stay out of search after launch too.
- **Organization facts** (phones, email, socials, EINs) live in `ORG` in
  `lib/site.mjs`. Add only facts the site already prints.
- **Staging gate:** `middleware.js` + `lib/preview-gate.mjs` +
  `app/api/gate/route.js` + `public/gate.html` + `public/js/eo-gate.js`. A
  soft gate that keeps the preview out of casual view and out of search, not
  a security boundary. Password `STAGING_PASSWORD`, falling back to `EO2026`;
  the cookie is an HMAC of the password, so rotating it signs everyone out.
  Ten failed attempts per address per 15 minutes (in memory, per instance,
  `lib/rate-limit.mjs`). `npm run dev` is gated too.
- **CSP:** every static page is served with `script-src 'self'`. No inline
  `<script>` (JSON-LD data blocks are fine) and no `on*=` attributes, ever;
  behavior lives in `public/js/`. Next-rendered routes get a baseline policy
  with `'unsafe-inline'` scripts. Any third-party embed (EveryAction,
  Lawmatics, YouTube) needs the directives listed in `next.config.mjs`.
- **Behaviors only** in `public/js/eo-site-template.js`: phone menu sheet,
  desktop dropdowns, help bar, scroll reveal, new-tab announcements, mock
  form validation. It never injects markup the page needs to work.
- **Branded 404:** `pages/404.js` (Pages Router, prerendered, no client
  runtime) with `pages/_document.js`, using the same chrome from
  `lib/chrome.mjs`. Do not replace it with an App Router catch-all or
  `app/not-found.js` until real App Router pages exist.
- **Design system:** `public/css/eo-brand-tokens.css` is the only file with
  color literals (palette from the official logo: purple `#5A3F99`, blue
  `#0093D0`, green `#9FCF67`); `eo-site.css` is the component layer;
  `eo-fonts.css` declares the self-hosted fonts in `public/assets/fonts/`.
  The two exceptions that cannot read CSS variables: `THEME_COLOR` in
  `lib/site.mjs` and the manifest's `background_color`.
- **Assets:** `npm run assets` (`scripts/art/`) regenerates the favicons,
  app icons, share cards (`public/assets/og/`), textures and the responsive
  AVIF/WebP images from the logo, tokens and fonts. Outputs are committed.
  Mirrored EO PDFs live in `public/assets/docs/`.
- **Forms are visual only** (`data-mock="true"`) until the Supabase phase.
  Giving links out to EveryAction (NGP) human form URLs.

## Repo layout

```
public/**/*.html          the pages (30, incl. the gate); clean URL = path minus .html
public/css/               eo-brand-tokens.css (tokens), eo-site.css (components), eo-fonts.css
public/js/                eo-site-template.js (site behaviors), eo-gate.js (gate page)
public/assets/            fonts, logo, brand icons, og cards, textures, img (generated sizes), docs (mirrored PDFs)
lib/site.mjs              LAUNCHED, SITE_URL, THEME_COLOR, ORG facts
lib/seo.mjs               PAGES registry, share cards, robots, JSON-LD
lib/chrome.mjs            NAV_ITEMS, KNOWN_PAGE_IDS, header/footer/help-bar markup
lib/static-pages.mjs      the one walk of public/
lib/legacy-post-paths.mjs 69 legacy post URLs that redirect to /news
lib/preview-gate.mjs, lib/rate-limit.mjs, middleware.js, app/api/gate/   the staging gate
app/robots.js, app/sitemap.js, app/manifest.js
pages/404.js, pages/_document.js                                     the branded 404
next.config.mjs           redirects (full legacy map), rewrites, headers, CSP, cache
scripts/build-pages.mjs   the generator (+ --check); scripts/check-*.mjs; scripts/art/ (npm run assets)
tests/*.test.mjs          node tests (npm test); tests/e2e/*.spec.mjs Playwright
docs/                     authoring-conventions, site-map, launch-checklist, legacy-sitemap-urls.txt
```

## Commands

```
npm run dev            local dev server (behind the gate: EO2026)
npm run build          production build; must pass
npm run pages:build    rewrite the generated regions in every page
npm test               node tests: links, redirects + live-sitemap coverage,
                       tokens, generated-region drift, site rules, freshness
npm run test:e2e       Playwright (needs `npm run build` first; starts
                       `next start` on 3100): axe WCAG 2.1 AA at 390 and
                       1280, routes/redirects/headers/gate, behavior
npm run lint:a11y      the axe part only
npm run check:links | check:redirects | check:tokens | check:pages
npm run assets         regenerate icons, share cards, images, textures
EO_TODAY=2026-11-20 npm test     freshness as of a future day
node scripts/check-redirects.mjs --fetch   refresh the live sitemap snapshot
```

In this environment Chromium is preinstalled at `/opt/pw-browsers/chromium`;
never run `playwright install`. If port 3100 already answers, Playwright
reuses that server, so stop a stale `next start` after rebuilding.

## Authoring a page

Follow `docs/authoring-conventions.md`. In short: charset and viewport
metas, the empty marker pairs, `<body data-page="…">` with an id from
`KNOWN_PAGE_IDS` in `lib/chrome.mjs`, one `<main id="main">`, one `<h1>`, no
skipped heading levels, the `eo-site-template.js` script tag; then a `PAGES`
entry in `lib/seo.mjs` (and a nav entry if it belongs in the menu), then
`npm run pages:build`.

## Content rules

- Copy from equalityohio.org only. Never invent programs, statistics, names,
  dates, eligibility rules or legal guidance.
- House style: entities in markup (`&rsquo;` `&amp;` `&mdash;`),
  `855&#8209;LGBT&#8209;LAW` with non-breaking hyphens, clean internal URLs
  (never `.html`, never a trailing slash), external links with
  `rel="noopener" target="_blank"`, `tel:+1…` links.
- Nothing expired ships. Events appear only while upcoming; dated content
  carries `data-expires`.
- Mock forms say nothing was sent and route people to a real channel
  (855-LGBT-LAW for clinic matters, info@equalityohio.org otherwise).
- Embeds not rebuilt yet get a `.form-note` naming the pending embed and a
  link to the live page. Donations always link out to EveryAction.
- No photography until licensed; brand-color art and avatar initials hold
  the slots.

## Accessibility and motion (release gate)

- Zero axe WCAG 2.1 A/AA violations at 390 and 1280 on every page, the 404,
  the gate, the open phone menu, an open dropdown and the intake after an
  empty submit (`npm run lint:a11y`).
- Skip link, landmarks, one `h1`, no skipped levels, visible focus (a solid
  outline: purple on light, gold on dark), keyboard-operable nav and forms.
- Contrast rules are computed in the tokens file header: `--eo-blue` is for
  large text and graphics only (small links use `--eo-blue-ink`),
  `--eo-green` is decorative only, gold takes ink text.
- Forms: visible required markers, hints tied with `aria-describedby`, a
  focused error summary linking each invalid field, inline errors with
  `aria-invalid`. Checkbox and radio rows are 44px `.choice` tiles.
- Motion: name the property, use the `--eo-dur-*` tokens, animate only
  `transform` and `opacity`. All durations collapse to 0 under
  `prefers-reduced-motion`; smooth scrolling is off there too. Scroll reveal
  runs only on desktop with motion allowed, hides only what starts below the
  fold, and never on print.
- No horizontal scroll at 320 or 390.

## Redirects and legacy coverage

All redirects live in `next.config.mjs`, documented row by row in
`docs/site-map.md` (keep the two in step). `permanent: true` is 308,
`permanent: false` is 307 (used where EO may want a path back).
`npm run check:redirects` proves every one of the 553 live paths lands on a
page and its anchor, with no chains, loops or unreachable rules; the
Playwright routes spec requests every rule and every legacy family.

## Freshness tests (they fail on a date, by design)

- Every `<!-- EVENT: … -->` block on `/get-involved/events` must be today or
  later (America/New_York); with none left, the empty-state callout must be
  on the page.
- Any `data-expires="YYYY-MM-DD"` in the past fails. The 2026 election
  content on `/`, `/votersguide` and `/news` expires 2026-11-04, so
  `npm test` turns red on 2026-11-05 until it is removed.
- The footer prints the build year, so on January 1 `check:pages` reports
  drift; run `npm run pages:build` and commit.

## Definition of done for a PR

`npm run pages:build` is a no-op, `npm test` and `npm run build` pass,
`npm run test:e2e` passes. Visual changes come with screenshots at 390 and
1280 (and a reduced-motion check for new animation). No color literal
outside the tokens file. `docs/site-map.md` updated with any URL change.

## Before launch

`docs/launch-checklist.md` is the list. The tests enforce the core of it:
with `LAUNCHED = true`, `npm test` fails on any self-link to
equalityohio.org or `/wp-content/`, any staging-only copy ("Design preview",
"in the real build", "pending embed", the 404's preview wording) and any
`form[data-mock="true"]`.

## Things to never do

- Never invent copy, figures, names, dates, eligibility or legal guidance.
- Never edit inside a generated region; never hand-write a `<head>` block,
  header or footer into a page.
- Never add an inline script or `on*=` handler to a static page.
- Never add a color literal outside `eo-brand-tokens.css`.
- Never link internally with `.html` or a trailing slash.
- Never build a fake donation form or link the EveryAction `/v1/Forms/` JSON
  endpoint; link the human `secure.everyaction.com/<formId>` page.
- Never remove `noindex`, the gate or the ribbon by hand; flip `LAUNCHED`.
- Never commit `.env*` files, `STAGING_PASSWORD` values or
  `tests/e2e/.auth/`.
- Never add `public/robots.txt` or `public/sitemap.xml` (they would shadow
  the generated routes), a top-level `app/layout.js` with pages, or an App
  Router catch-all for 404s without re-checking the 404 behavior.
- Never ship expired content: delete passed event blocks and expired
  `data-expires` sections instead of re-dating them.
- Never run `playwright install` here.
