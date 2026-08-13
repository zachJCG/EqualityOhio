# Equality Ohio — Website Redesign

Next.js app for the equalityohio.org redesign, prepared by Joseph Carter Group.
Staging build — deploys to a **password-gated** Vercel URL (`EO2026` unless the
`STAGING_PASSWORD` env var overrides it) and stays `noindex` until launch.

## Architecture

Same platform pattern as the JCG nonprofit stack:

- **Every page is static HTML under `public/`**, answering on its clean URL
  (`public/about/history.html` → `/about/history`). Clean URLs, the legacy
  redirect map, and headers are generated in `next.config.mjs` by walking
  `public/`. A page ported to a real `app/<path>/page.js` route wins
  automatically (the rewrites are `afterFiles`).
- **Shared chrome is injected client-side** by `public/js/eo-site-template.js`
  (header with dropdown nav, footer, preview ribbon) into
  `<div data-site-header>` / `<div data-site-footer>` mounts; pages declare
  themselves via `<body data-page="...">`.
- **Design system**: `public/css/eo-brand-tokens.css` is the single source of
  truth for brand variables (canonical palette per the official logo artwork:
  purple `#5A3F99`, blue `#0093D0`, green `#9FCF67`); `eo-site.css` is the
  component layer; fonts are self-hosted in `public/assets/fonts/`.
- **Staging gate**: root `middleware.js` + `public/gate.html` +
  `app/api/gate/route.js`. Remove all three (and the `X-Robots-Tag` header in
  `next.config.mjs`, and `public/robots.txt`'s disallow) at launch.
- **Forms are visual-only** (`data-mock="true"`) until the Supabase phase.
  Donations link out to Equality Ohio's live EveryAction (NGP) pages.

## Commands

```
npm run dev          # local dev
npm run build        # must pass before a PR lands
npm run check:links  # every internal link + anchor resolves
```

## Authoring a page

Follow `docs/authoring-conventions.md`. The full live-site → new-site URL
mapping (and the pending links/embeds/assets list) is `docs/site-map.md`.

## Pre-deploy checklist

- Re-verify every event on `/get-involved/events` is still upcoming; delete
  passed blocks (they are self-contained).
- Confirm openings on `/about/jobs-internships` are still open.
- Regenerate `lib/legacy-post-paths.mjs` from the live post sitemap.
- Set `STAGING_PASSWORD` on Vercel if EO2026 needs rotating.
