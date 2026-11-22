# Equality Ohio on WordPress

The equalityohio.org redesign (the Next.js app at the root of this repository) rebuilt as a WordPress block theme, a companion plugin and 29 pages loaded from files. Brief: `source/HANDOFF.md`. Report for this pass: `docs/report.md`.

```
themes/equality-ohio/      block theme: theme.json (generated from the tokens), templates, parts,
                           42 patterns (generated), assets (tokens, eo-site.css, eo-wp.css, fonts, logo…)
plugins/eo-site/           redirect map (148 rules), titles/descriptions/share cards/JSON-LD, staging
                           flag, safe headers, the eo/text block, the importer, WP-CLI commands
plugins/eo-site/content/   the 29 pages as block markup (generated) + data/pages.json registry
source/                    the handoff data the generators read (content, redirects, reference, tools)
tools/                     generators: build-theme-json, html-to-blocks, build-patterns, local-wp, package
tests/                     node tests (generated files; parity + redirects against a running site)
tests/e2e/                 Playwright: block validity, editor round trip, axe, behavior, screenshots
docs/                      report, conversion report, reference screenshots
```

## Generated, never hand-edited

| Output | Source | Command |
|---|---|---|
| `themes/equality-ohio/theme.json` | `assets/css/eo-brand-tokens.css` | `npm run theme:json` |
| `plugins/eo-site/content/pages/*.html`, `data/pages.json`, `assets/css/eo-utilities.css`, `docs/conversion-report.md` | `source/content/` | `npm run pages:build` |
| `themes/equality-ohio/patterns/*.php` | the page files | `npm run pages:build` |

`npm test` fails if any of them is stale. Edit the tokens or the source content and rerun; do not edit the outputs.

## Run it locally

```
npm install
sh tools/local-wp.sh                  # WordPress + SQLite + WP-CLI into .local-wp/, theme and plugin linked, pages imported
php -S localhost:8080 -t .local-wp/wordpress .local-wp/router.php
```

Admin at `/wp-admin/` (`admin` / `admin`, local only). Tools → Equality Ohio has the importer, the staging flag and the redirect families; the same via WP-CLI:

```
wp eo import [--dry-run]          create/update the 29 pages, PDFs, menus, settings (safe to rerun)
wp eo staging on|off|status       the one launch switch (ribbon, footer credit, noindex, sitemap, 404 wording)
wp eo redirect /people/jen-kuhn/  where a legacy path lands
```

## Checks

```
npm test            generated files current; no color literal outside the tokens; no inline script, .html link or bare tel:
npm run test:site   text/outline/anchor/link parity for all 29 pages; all 553 legacy paths (needs the local site)
npm run test:e2e    editor validity and save round trip (29 pages), axe WCAG 2.1 A/AA at 390 and 1280 incl. states, behaviors
npm run screenshots every page at 390 and 1280 beside the source (serve source/nextjs/public on :8090 first)
```

Run the site checks logged out (the admin bar changes the layout). The e2e scripts log in only for the editor checks.

## Where it is

Staging: https://zach364b94579cd.wpcomstaging.com (WordPress.com, Personal plan, Coming Soon on; site ID 258848468). The theme and plugin were uploaded through the WordPress.com API and the plugin imported the pages on activation. The plugin publishes three WordPress Abilities an agent connected through WordPress.com can run: `eo-site/import`, `eo-site/staging`, `eo-site/verify` (read-only).

## Install on a WordPress host

`sh tools/package.sh` writes `dist/equality-ohio.zip` and `dist/eo-site.zip`. Upload and activate both; the importer runs once on activation when the site has no imported page yet, and can be rerun from Tools → Equality Ohio, `wp eo import`, the `eo-site/import` ability or `POST /wp-json/eo-site/v1/import`. The importer matches pages by path, so an existing `about` page is updated, not duplicated. On an install where the old posts still exist, switch off the `legacy-post`, `post-taxonomy` and `events-calendar` redirect families.

Staging is on by default. `wp eo staging off` is the launch switch.
