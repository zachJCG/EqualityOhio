# Launch checklist: equalityohio.org cutover

Everything that is true only of the staging preview, and everything that
must happen before the redesign can serve equalityohio.org. Updated
2026-10-16.

**The tests carry the core of this list.** While `LAUNCHED` is `false`,
`npm test` prints two warning blocks from `tests/site-rules.test.mjs` with
the current file and line of every item:

```
npm test 2>&1 | grep -A50 '\[site-rules\]'
```

With `LAUNCHED = true` in `lib/site.mjs`, both become failures, so the
launch commit cannot pass CI until sections B and C below are clear. On
2026-10-16 that is 12 self-links, 32 lines of staging-only copy (29 in pages,
3 in the 404) and 6 mock forms; with `LAUNCHED` flipped and the pages
regenerated, `npm test` fails exactly those two tests and nothing else.

## A. Decisions EO must make

| Decision | Where | Notes |
|---|---|---|
| Privacy policy and text-messaging terms fit the new stack | `public/privacy-policy.html`, `public/terms-conditions.html` | Live text verbatim (Last Updated September 18, 2026; terms 2026-09-20). EO counsel to confirm before launch, especially once forms collect data on this stack. |
| News archive | `public/news.html`, `lib/legacy-post-paths.mjs` | The six "Read more" links go to live post URLs that this build 308s to `/news`, so at launch each loops back to the page it is on. Choose: import the posts as `/news/<slug>` pages (then drop those slugs from the redirect list) or link titles nowhere and keep summaries only. |
| Forms (Phase 2) | see section C | Wire each mock form to its real service or replace it with an outbound link. A legal intake must never silently go nowhere. |
| Family Law Guide PDF | `public/legal-clinic.html`, `public/legal-clinic/ohio-lgbtq-family-law-guide.html` | Both link `bit.ly/FamilyLawGuide_2025`, which resolves to `/wp-content/uploads/2025/05/Family-Law-Guide-May-2025-3.pdf` on WordPress. At 25 MB it is over the deployment's 15 MB per-file limit, so EO must host it elsewhere (or supply a compressed copy to mirror in `public/assets/docs/` with a redirect like the other three) and repoint the bit.ly. The test does not see this one: bit.ly is not a self-link. |
| HSTS scope | `next.config.mjs` (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) | On the apex this forces HTTPS on every subdomain for a year. `shop.equalityohio.org` serves HTTPS; EO's IT must confirm every other subdomain (mail, email-platform tracking, legacy hosts) does too, or drop `includeSubDomains`. Add `preload` only on a firm commitment. |
| Assets still owed | `docs/site-map.md` "Pending" | Official logo files and GuideStar badge artwork, licensed photography and headshots, voters-guide grade data, know-your-rights videos, the new Trans Know Your Rights PDF when the clinic publishes it. |

## B. Links back to the WordPress site (fail at launch)

At launch equalityohio.org is this site, so each of these becomes a loop or a
404. Rule: `self-links to equalityohio.org and WordPress media are resolved
before launch`.

| File | Links | Resolve by |
|---|---|---|
| `public/news.html` | 6 post "Read more" links | The news-archive decision (section A) |
| `public/newsletter.html` | 2 links to the live signup page | Wiring the newsletter form |
| `public/our-work.html` | the live worship database | The congregation directory (Supabase phase) or removing the link |
| `public/our-work/legacy-of-equality.html` | the 2025 honorees press release | The news-archive decision |
| `public/our-work/local/municipal-map.html` | the live interactive map | Rebuilding the map (Supabase phase) or removing the link |
| `public/stories.html` | the live story archive | Importing the stories or removing the link |

## C. Staging-only copy and mock forms (fail at launch)

Rule: `staging-only copy and mock forms are gone before launch`. It matches
"Design preview", "this/the preview", "in the real build", "production build"
and "pending embed/asset" outside comments and generated regions, every
`form[data-mock="true"]`, and the preview wording of the 404.

| Page | What to replace |
|---|---|
| `/` (`public/index.html`) | Newsletter signup mock form and its success note |
| `/contact` | Contact mock form and its success note |
| `/newsletter` | E-news signup mock form, its preview note and success note |
| `/get-involved/volunteer` | Volunteer mock form (live form: EveryAction `wmSqb0UnU0-23sWMyhoAQg2`), preview note, "All states will be listed…" hint, success note |
| `/legal-clinic/intake` | Intake mock form, preview note, "All 88 counties will be listed…" hint, success note |
| `/legal-clinic/intake/thank-you` | The "Design preview" note |
| `/legal-clinic/legal-network` | Interest mock form (live form: Lawmatics `2563c615-…`), preview note, success note |
| `/legal-clinic/ohio-lgbtq-family-law-guide` | "Pending asset" note (with the PDF decision) |
| `/about/history` | "Pending embed" note for the 2014 Gay Games video |
| `/get-involved/events` | "Pending embed" note for the EveryAction calendar |
| `/give`, `/jim-obergefell-john-arthur-society` | "In the production build, giving flows are embedded" notes |
| `/news` | "Mockup shows six recent posts… Production build includes the full archive" |
| `/our-work` | Congregation directory "pending data migration" note |
| `/our-work/local/municipal-map` | "Interactive map coming to this preview" and the organizing-help note |
| `/stories` | "Pending embed" note for the story archive |
| `/votersguide` | "Design preview" note about portraits and grade badges |
| 404 (`pages/404.js`, `NOT_FOUND` in `lib/seo.mjs`) | "This page isn't part of the preview yet", "The full production build covers every page…", and the description "That page isn't part of this preview." |

## D. Staging artifacts that `LAUNCHED` flips

Set `LAUNCHED = true`, run `npm run pages:build`, commit the regenerated
pages. Nothing here is edited by hand.

| Artifact | Source | Launched behavior |
|---|---|---|
| `<meta name="robots" content="noindex, nofollow">` on every page | `lib/seo.mjs` `robotsContent()` | `index, follow, max-image-preview:large`; `noindex, follow` on `/legal-clinic/intake/thank-you` |
| No `<link rel="canonical">` | `scripts/build-pages.mjs` | Canonical `https://equalityohio.org/<path>` on indexable pages |
| `og:site_name` "Equality Ohio — Design Preview" | `lib/seo.mjs` `OG_SITE_NAME` | "Equality Ohio" |
| Preview ribbon | `lib/chrome.mjs` `headerHTML()` | Gone |
| Footer "Design preview by Joseph Carter Group" | `lib/chrome.mjs` `footerHTML()` | Gone |
| Staging gate | `middleware.js` | Pass-through |
| `X-Robots-Tag: noindex, nofollow, noarchive` | `next.config.mjs` | Only on non-production deployments (previews stay out of search) |
| `/robots.txt` `Disallow: /` | `app/robots.js` | On production: allow all but `/api/`, with `Sitemap:` |
| `/sitemap.xml` | `app/sitemap.js` | Unchanged (28 indexable URLs); now referenced from robots |
| Playwright gate tests | `tests/e2e/routes.spec.mjs` | Skip; the `launched` test runs |

## E. Launch day, in order

1. **Freshness on the day:** `EO_TODAY=<launch date> npm test`. The 2026
   election sections (`/`, `/votersguide`, `/news`) expire after 2026-11-04;
   delete them, do not re-date them. Delete passed events.
2. **Legacy URLs:** regenerate `lib/legacy-post-paths.mjs` from
   `https://equalityohio.org/post-sitemap.xml` (see its header), then
   `node scripts/check-redirects.mjs --fetch` to refresh
   `docs/legacy-sitemap-urls.txt` and re-check coverage of every live path.
3. **Documents:** re-pull the three mirrored PDFs in `public/assets/docs/`
   from their `/wp-content/` URLs in case EO revised them. Confirm the
   BambooHR posting on `/about/jobs-internships` is still open.
4. **Flip:** `LAUNCHED = true` in `lib/site.mjs`, `npm run pages:build`,
   then `npm test` (must pass with no `[site-rules]` warnings left),
   `npm run build`, `npm run test:e2e`. Commit and merge.
5. **Domain:** on Vercel, serve the apex `equalityohio.org` as the primary
   domain with `www` redirecting to it (the live site canonicalizes to the
   apex, and every canonical and sitemap URL here uses it). Cut DNS over.
6. **Verify production:**
   `PLAYWRIGHT_BASE_URL=https://equalityohio.org npm run test:e2e`; confirm
   `/robots.txt` lists the sitemap, responses carry no `X-Robots-Tag`, and a
   preview deployment still does.
7. **Remove the gate** in a cleanup PR: `middleware.js`,
   `lib/preview-gate.mjs`, `lib/rate-limit.mjs` (gate-only today),
   `app/api/gate/`, `public/gate.html`, `public/js/eo-gate.js`, the
   `.gate-*` rules in `public/css/eo-site.css`, the `/gate` entry in
   `lib/seo.mjs` `PAGES`, `gate` in `EXTRA_PAGE_IDS` (`lib/chrome.mjs`),
   `NO_CHROME` in `scripts/build-pages.mjs` and `tests/site-rules.test.mjs`,
   the gate and signed-out tests in `tests/e2e/`, the `STAGING_PASSWORD` line
   in `.env.example`, the CI env and secret, the Vercel env var, and the gate
   sections of `README.md` and `CLAUDE.md`.
