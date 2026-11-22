# Equality Ohio — Next.js to WordPress Handoff

Prepared 2026-11-20 by Joseph Carter Group for a Claude Code session. Source pinned at commit `ee60763` (2026-10-16).

Read this file first. `CLAUDE.md` in this folder repeats the ground rules. Everything else is reference data, and `tools/` can rebuild it from the source.

---

## 1. The Job

Equality Ohio's redesigned website exists today as a Next.js app on Vercel. It is the reference for look, content and accessibility, and it is on the wrong platform: Equality Ohio (EO) runs WordPress, their staff edit in WordPress, and JCG's delivery-path review landed on a custom WordPress block theme.

Your job is to rebuild that site as a WordPress block theme plus its 29 pages, so that:

1. A visitor sees the same site at the same URLs — same words, same layout, same keyboard and screen-reader behavior.
2. EO staff can open any page in the block editor and change the text without touching code.
3. The result installs on any WordPress host, because it will be staged on WordPress.com and is expected to go to production on EO's own WordPress install.

You are done with this pass when Phases 0–3 below pass their checks on a local WordPress, and Phase 4 is either complete or stopped at the plan decision with a clear note for Zach. Phase 5 is out of scope and listed only so you do not start it.

---

## 2. Where Things Stand (Checked 2026-11-20)

### The Source: Next.js App

| | |
|---|---|
| Repository | `github.com/zachJCG/EqualityOhio` (public). Snapshot in `source/nextjs/` |
| Branch and commit | `claude/equalityohio-site-migration-asaaa7` at `ee60763`. `main` is older (`7da1f00`) |
| Staging | `https://equality-ohio.vercel.app`, behind a soft password gate, `noindex`. Latest deployment is ready and answering |
| Stack | Next.js 15.5, React 19, Node 22, plain JavaScript |
| What it really is | 29 hand-written static HTML pages under `public/`, plus a generated header, footer and `<head>`. No React pages, no database, no API beyond the gate |
| Design system | `eo-brand-tokens.css` (7.6 KB, the only file with color values), `eo-site.css` (47.6 KB of components), ten self-hosted `woff2` fonts |
| Behavior | One script, `eo-site-template.js` (27 KB): phone menu sheet, desktop dropdowns, phone help bar, scroll reveal, new-tab announcements, form validation |
| Content | About 14,700 words, written to the rule that every sentence comes from equalityohio.org. Section 4 lists the known exceptions |
| Quality bar it was built to | Zero axe WCAG 2.1 A/AA violations at 390 and 1280 px on every page and state; no sideways scroll at 320 px; navigation works with JavaScript off. Its Playwright suite enforces this; the suite was not run for this brief |

Three things about the source are true only of a preview, and matter to you:

- **Six forms send nothing.** They validate in the browser and show a note saying so (`reference/forms.md`).
- **33 lines of staging-only copy on 20 pages**, and 12 links back to equalityohio.org (`reference/launch-blockers.md`).
- **Four election blocks expired on 2026-11-04** and are still in the source. By the repo's own freshness rule, `npm test` fails from November 5 on. The four blocks were confirmed present; the suite was not run.

### The Target: WordPress.com Site

| | |
|---|---|
| Address | `https://zach364b94579cd.wordpress.com` (site ID `258848468`) |
| Title | Equality Ohio (renamed today from "My Site") |
| State | Created 2026-11-20. Coming Soon, not launched. Admin email zach@josephcartergroup.com |
| Plan | Free. Platform type "Simple" |
| Theme | Assembler (stock). Ten stock templates, three template parts |
| Content | One default page, "About" (ID 1, slug `about`), and one navigation menu (ID 4) |
| Settings to fix | Timezone unset (UTC). Tagline empty. Posts use date-based permalinks. Front page shows latest posts |

**The free plan cannot take this build.** Per WordPress.com's plan data for this site, custom theme upload, plugins, SFTP/SSH, GitHub deployments and custom styles all start at the Personal plan, after its hosting features are activated. Permalink settings and staging sites are listed under Business and Commerce only. Details and prices: `reference/wpcom-site.md`.

### The Live Site: equalityohio.org

EO's production WordPress, on WP Engine. Read-only for you. Two facts checked today:

- The post sitemap still lists 69 posts, newest dated 2026-09-30, so the legacy post list in the source is current.
- Beyond WordPress's own, its public REST API lists only The Events Calendar and WPBakery post types. The `people`, `job-opening`, `worship-database` and `municipal-map` URLs all have sitemaps but do not appear there, so where those post types are registered is unknown. This matters in Phase 5, not now.

---

## 3. Decisions Zach Owns

Each has a default so you are never blocked. If a default looks wrong once you are in the work, say so in your report rather than switching silently.

| # | Decision | Default for this pass | What changes otherwise |
|---|---|---|---|
| D1 | WordPress.com plan | Build and test locally. Stop at Phase 4 until Zach upgrades | Nothing in Phases 0–3 |
| D2 | Final home of the site | WordPress.com is JCG's staging build; production is EO's existing WordPress on WP Engine | If WordPress.com becomes production, add the full redirect map and a posts import there |
| D3 | News | `/news/` is a normal Page reproducing the designed page. No posts are imported | If EO wants the archive, `/news/` becomes the Posts page and Phase 5 imports posts |
| D4 | Forms | Keep all six as non-submitting previews with their notices, as on Vercel today | Each is swapped for its real service in Phase 5 |
| D5 | Where the code lives | A new private repository, `equality-ohio-wp` | If Zach prefers the existing public repo, use a `wordpress/` folder on a new branch |

**Do not buy a plan, launch the site, or connect a domain.** Those are Zach's actions.

One alternative you may be asked about: WordPress.com has a static-site importer (`wpcom-static-site-import`) that converts finished HTML into a block-based site in minutes. By its own contract it builds onto a private preview site, not a site like this one, replaces everything on whatever preview it targets, and its output has not been through this project's accessibility gate. It is a reasonable throwaway comparison. It is not the deliverable.

---

## 4. Ground Rules

**Content**

- Every word comes from `content/` (which came from equalityohio.org). Do not write, tighten or improve copy. Do not invent programs, statistics, names, dates, eligibility rules or legal guidance.
- Do not port the four expired election blocks. Leave the rest of the election content alone and flag it.
- Carry staging-only notes across as marked staging notes, so one search finds them at launch.
- No photography. Brand-color art and avatar initials hold those slots until EO supplies licensed images.

**Content Items Already Known to Be Open**

| Item | Where | What to do |
|---|---|---|
| Clinic availability | The preview note and success message on `/legal-clinic/intake/` say "If you need legal help today, call…" and "Need help right now? Call…" | JCG's notes record that the live intake page says voicemails are returned on Tuesdays and Thursdays, and that these two lines should say so. The fix never reached the source. Confirm the sentence on the live page and use EO's wording |
| Confidentiality and attorney-client wording | `/legal-clinic/` and `/legal-clinic/intake/` ("does not create an attorney-client relationship", "stays confidential within the clinic team") | JCG's notes mark this as placeholder wording for EO's clinic attorneys to supply. Carry it across, list it as awaiting EO's sign-off, and do not describe it as approved |
| Election-season content | `/votersguide/`, the scorecard cards on `/` and `/news/` | The election was November 3. Whether these stay is EO's call. Flag them |
| Privacy policy and text-messaging terms | `/privacy-policy/`, `/terms-conditions/` | Live text, verbatim. EO's counsel still has to confirm it fits the new site |

**Privacy**

- Legal Clinic intake must never be stored in WordPress — not as form entries, not in logs, not as emailed copies. Intake narratives can include immigration status, HIV status and gender identity. Intake goes straight to Lawmatics.

**Safety**

- equalityohio.org and its WP Engine account are read-only. Public page and API reads are fine. No logins, no writes.
- On the WordPress.com site you may create and edit content, templates, menus and settings. Do not delete the site, change its address, or run the static importer against it.
- Treat every repository as public, including a private one. No secrets, passwords or `.env` files in git.
- After every write to WordPress.com, read the result back and compare. WordPress filters markup on save, and what it stored is not always what you sent.

**Accessibility Is a Release Gate**

- Zero axe WCAG 2.1 A/AA violations at 390 and 1280 px on every page, the 404, the open phone menu, an open dropdown and the intake form after an empty submit.
- No sideways scroll at 320 px, including under WCAG 1.4.12 text spacing.
- One skip link, one `<main>`, one `<h1>`, no skipped heading levels, visible focus, full keyboard operation, all motion off under `prefers-reduced-motion`.

---

## 5. Target Architecture

Two pieces: a theme for presentation, and a small plugin for behavior that must survive a theme change.

```
themes/equality-ohio/
  style.css               Theme header only
  theme.json              Palette, gradients, fonts, sizes, 1160px layout, custom tokens
  functions.php           Enqueues, editor styles, block styles, pattern categories, menu locations
  assets/css/             eo-brand-tokens.css, eo-site.css, eo-wp.css (new: WordPress compatibility layer)
  assets/js/eo-site.js    From eo-site-template.js
  assets/fonts|logo|brand|og|textures|img/
  parts/                  header.html, footer.html, help-bar.html
  templates/              front-page, page, page-legal-guide, index, home, single, archive, search, 404
  patterns/               One per component, plus one per page layout

plugins/eo-site/
  Redirect map            From redirects/redirect-rules.json
  Search and share data   Titles, descriptions, share cards, JSON-LD; steps aside if an SEO plugin is active
  Staging flag            Ribbon, footer credit and og:site_name suffix follow one setting
  Page importer           Creates or updates the 29 pages from files, safely re-runnable
```

### What Carries Over

| Next.js piece | WordPress home | Change needed |
|---|---|---|
| `public/css/eo-brand-tokens.css` | Theme asset | None. Generate the `theme.json` palette from it; do not hand-sync two lists |
| `public/css/eo-site.css` | Theme asset | Two root-relative `url('/assets/textures/…')` become theme-relative. Gate rules go |
| `public/css/eo-fonts.css` | `theme.json` `fontFace` entries | Same ten files. Keep the two preloads (Open Sans 400, Montserrat 800) |
| `public/js/eo-site-template.js` | Theme script, deferred | Selectors that rely on `data-*` attributes need a class fallback (see Traps) |
| `lib/chrome.mjs` header and footer | Template parts | Menus come from WordPress; markup and ARIA stay as in `content/chrome/` |
| `lib/seo.mjs` page registry | Plugin data | `reference/page-map.md` has every title, description and share card |
| `lib/site.mjs` `LAUNCHED` and `ORG` | Plugin setting, theme data | One staging flag. Organization facts in one place |
| `next.config.mjs` redirects | Plugin | 148 rules, already converted (`redirects/`) |
| 29 pages in `public/` | 29 WordPress Pages | Rebuilt from patterns, loaded by the importer |
| `pages/404.js` | `templates/404.html` | Drop the preview wording when the staging flag is off |
| Node and Playwright tests | Adapted suite against a running WordPress | See Phase checks |

### What Does Not Carry Over

| Next.js piece | Why | Replacement |
|---|---|---|
| Password gate (`middleware.js`, `/api/gate`, `gate.html`) | Vercel-only | WordPress.com Coming Soon mode |
| Strict Content-Security-Policy (`script-src 'self'`) | It would break the block editor and the form embeds EO needs | Send the safe headers only: `nosniff`, `Referrer-Policy`, frame protection. Record this as a known step down |
| `app/sitemap.js`, `app/robots.js` | WordPress generates both | Core sitemaps; confirm the thank-you page stays out |
| `scripts/art/` asset generator | Outputs are already committed | Copy the outputs |
| `.html` spelling redirects (30) | No `.html` files exist in WordPress | None |

---

## 6. Work Plan

### Phase 0 — Orient

1. Read `source/nextjs/CLAUDE.md`, then `docs/authoring-conventions.md` and `docs/site-map.md` there. They explain why the source is built the way it is.
2. Start a local WordPress. `npx @wp-playground/cli@latest server --auto-mount` (Node 20.18 or newer) runs one without Docker; a Blueprint file makes the setup repeatable for tests. Use wp-env or Studio instead if you need MySQL.
3. Optional but useful: WordPress's own agent skills, `npx skills add WordPress/agent-skills --skill wp-block-themes wp-playground`.
4. Connect the WordPress.com MCP server and confirm you can read site `258848468`. The publicly listed command is `claude mcp add wordpress-com --transport http https://public-api.wordpress.com/wpcom/v2/mcp/v1`, followed by an OAuth sign-in; Zach's MCP settings are at `https://my.wordpress.com/me/preferences/mcp`. Re-check the site's plan; it may have changed since this was written.
5. Re-check the live site for changes since 2026-10-16: post count (69 today), the home page lead, `/votersguide/`, `/get-involved/events/`.

**Check:** you can state the plan status of the WordPress.com site and whether live content has moved.

### Phase 1 — Theme Foundation

Tokens, type, header, footer, 404, and the behaviors script, on an otherwise empty site.

The header's markup and its behavior were tested as a unit. Rendering that same markup from a WordPress menu keeps the work; swapping in the core Navigation block replaces it and means redoing the behavior checks. Prefer the first unless you find a reason not to, and say which you chose.

**Checks**

- The rendered header and footer contain the same landmarks, links and order as `content/chrome/header.html` and `footer.html` (`content/chrome/site-data.json` is the data behind them).
- With JavaScript off, the phone Menu control jumps to the footer navigation. With it on, the sheet traps focus, closes on Escape and returns focus; dropdowns open one at a time. `source/nextjs/tests/e2e/behavior.spec.mjs` is the contract.
- Exactly one skip link. Block themes add their own; keep one.
- No color value outside the tokens file and the generated palette.
- axe: zero violations at 390 and 1280 px, including the open menu and an open dropdown.

### Phase 2 — Patterns and the 29 Pages

Start with `/give/` (the source's reference interior page), then the home page, then section by section. `reference/component-map.md` maps each component to a block approach.

Build pages as files in the repository and load them with the importer. Do not hand-build pages in an admin screen: the same content has to load into your local site, WordPress.com and later EO's staging.

**Checks, per page**

1. **Text parity.** The visible text of the rendered `<main>` equals `content/text/<page>.txt`, minus the expired blocks. List and justify every difference.
2. **Outline parity.** Headings match `pages.json` `headings` by level and text. One `<h1>`.
3. **Anchors.** Every `id` that a link or a redirect targets still exists. That includes all 15 staff-card ids on `/about/staff-interns/`, which match the live site's people slugs.
4. **Links.** The same external URLs (40 distinct, plus the 12 links back to equalityohio.org), each with `rel="noopener"` and `target="_blank"`. Internal links in trailing-slash form, answering 200 with no redirect.
5. **Editor round trip.** The page opens in the block editor with no "unexpected or invalid content" warning. Raw HTML blocks are allowed only on a short list you report, with the reason for each.
6. **Accessibility.** axe zero at both widths; no sideways scroll at 320 px.
7. **Looks the same.** Screenshots at 390 and 1280 px beside the Vercel staging page (gate password: see the source README). Explain any visible difference.

### Phase 3 — Site Wiring

- Page tree with the slugs and parents in `reference/page-map.md`. On WordPress.com, reuse the existing About page (ID 1); do not create `about-2`.
- Static front page. `/news/` per D3.
- Menus: five top-level items with their children, the Donate button, four footer columns.
- Titles, descriptions, share cards and structured data per `reference/page-map.md`. Everything `noindex` while staging; `/legal-clinic/intake/thank-you/` stays `noindex` after launch.
- Redirect map installed and tested.
- Timezone `America/New_York`. Leave the tagline empty unless the live site states one.
- The three mirrored PDFs go into the Media Library so EO can replace them, and their links are updated.

**Checks**

- Every row of `redirects/legacy-url-map.csv` behaves as listed: 25 live paths answer 200 at the same path, 528 reach their listed page in one hop with the listed code. No chains, no loops.
- No internal link on any page passes through a redirect.
- The sitemap lists the 28 indexable pages and nothing else.

### Phase 4 — Put It on WordPress.com (Needs D1)

Stop here if the site is still on the free plan, and tell Zach which plan the work needs and why.

Once a paid plan is active with hosting features on: upload and activate the theme, install the plugin, run the importer, set menus and settings, upload media. Keep Coming Soon on. Verify with the same checks where you can reach the site; say which checks you could not run remotely.

### Phase 5 — Not in This Pass

Needs EO: wiring real forms and embeds, importing news posts, licensed photography, rollout to EO's WP Engine staging, and launch. `source/nextjs/docs/launch-checklist.md` sections A to C list what launch requires; most of it still applies.

---

## 7. Traps

**WordPress filters what you save.** Core blocks do not keep arbitrary attributes. The source uses `data-cta` (5 clinic callouts the help bar watches), `data-expires`, `data-error` and `<time datetime>`. Use class hooks and update the script, or small custom blocks. Do not assume an attribute survived; read it back.

**111 inline `style=""` attributes.** A core block whose saved markup carries a style its attributes do not describe is flagged invalid in the editor. Turn them into utility classes or block settings.

**Screen-reader-only text inside links.** Card links read "Read more" plus a hidden `<span class="sr-only">` naming the article. Confirm those spans survive a save in the editor. If they do not, find another way to keep each link's name unique.

**WordPress's own layout CSS.** Block gap, flow margins and `wp-block-*` wrappers will fight `eo-site.css`. Keep that file intact and put every adjustment in `eo-wp.css`, so the two can be compared.

**The H1 is not the page title.** `/about/` has the H1 "Who we are", the menu label "Mission & Values" and the browser title "About Us — Equality Ohio". Keep the H1 in the page content and keep page templates from printing the post title, or every page gets two H1s.

**Trailing slashes.** Source links have none (`/legal-clinic/intake`). WordPress and the live site use them. Convert on the way in or every internal link costs a redirect.

**Root-relative asset paths.** `/assets/…` exists on Vercel, not in WordPress. Images and textures resolve through the theme; PDFs through the Media Library.

**Phone links.** 16 `tel:` links in the page bodies lack the leading `+` that the source's own convention requires (`tel:18555428529` beside `tel:+18555428529`). Normalize them.

**The redirect map is written for a fresh install.** 69 rules send old post URLs to `/news/`. On EO's real install those posts exist, and the rules would hide them. Each rule in `redirects/redirect-rules.json` has a `family` so you can ship the right subset.

**The logged-in view lies.** The admin bar shifts the sticky header and the editor loads extra CSS. Run every check logged out.

**Footer year.** The source prints the build year into the footer and fails a test each New Year until someone rebuilds. In WordPress, print the current year.

---

## 8. What Is in This Package

| Path | What it is |
|---|---|
| `HANDOFF.md`, `CLAUDE.md` | This brief, and the short rules Claude Code loads automatically |
| `reference/page-map.md` | The 29 pages: path, slug, parent, H1, title, description, share card |
| `reference/component-map.md` | Every component class, how often it is used, and a block approach |
| `reference/forms.md` | The six forms: fields, live-site service, where each should go |
| `reference/launch-blockers.md` | Expired blocks, staging-only lines, links back to the live site |
| `reference/wpcom-site.md` | The WordPress.com site's state, plans, limits and tools |
| `content/pages.json` | One record per page: headings, anchors, links, forms, images, text hash |
| `content/main/*.html` | Each page's `<main>` content, nothing generated |
| `content/text/*.txt` | Each page's visible text, for diffing |
| `content/chrome/` | Header, footer, help bar and `<head>` exactly as served, plus navigation and organization data |
| `redirects/` | All 553 live paths resolved, and the 148 rules in CSV and JSON |
| `inventory/` | Raw inventory and a dump of the app's registries |
| `source/nextjs/` | The full app at `ee60763`, including its tests and docs |
| `tools/` | The scripts that produced `content/`, `redirects/` and `reference/`. Re-run them if the source changes |

---

## 9. Reporting Back

At the end of each phase, send Zach a short note:

1. What now works, with the evidence: check counts, not adjectives.
2. What you could not verify, and why.
3. Each place you departed from this brief or from a default, and the reason.
4. Decisions you need, with your recommendation.

If the source, the live site and this brief disagree, stop and say what disagrees. Do not pick one quietly.
