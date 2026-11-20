# Redirects: The Live Site's 553 URLs on the New Site

The source app promises that no live equalityohio.org URL will 404. Its `next.config.mjs` holds 148 redirect rules, and its tests check them against a snapshot of every path in the live WordPress sitemaps (553 paths, taken 2026-10-16).

This folder is that promise converted for WordPress and re-checked on 2026-11-20: all 553 paths resolve, none chain, and every target anchor exists on its page.

| File | What it holds |
|---|---|
| `legacy-url-map.csv` | All 553 live paths. Each either keeps its path (25) or redirects (528), with the code and the landing page. This is your test oracle |
| `redirect-rules.json` | The 148 rules in order, with match type, a ready regex, the WordPress-style target, the code and a family |
| `redirect-rules.csv` | The same rules as four columns, `source,target,regex,code`, for a redirect plugin's CSV import. Confirm the plugin's expected format before importing; families and order are in the JSON |
| `summary.json` | Counts behind the tables below |

## What Changed in the Conversion

- **Targets end in a slash** (`/give/#daf`), matching WordPress and the live site. The Next.js app used none.
- **Codes are 301 and 302.** The app used 308 and 307; the six temporary rules stay temporary because EO may want those paths back.
- **Order matters.** The first matching rule wins. Exact rules for 33 people slugs come before the `/people/…` catch-all.
- **Three media rules need new targets.** They point at `/assets/docs/…pdf` on Vercel. In WordPress those PDFs live in the Media Library, so point each rule at the uploaded file's address.
- **The 30 `.html` spelling rules are gone.** They only existed because the app's pages were files.

## Rules by Family

Ship the families that fit the install. On a fresh site (WordPress.com) every family applies. On EO's existing install the posts, events and taxonomy archives still exist, so `legacy-post`, `post-taxonomy` and `events-calendar` would hide real content there and must be left out.

| Family | Rules | What it covers |
|---|---|---|
| `legacy-post` | 69 | The 69 posts in the live post sitemap, all sent to `/news/` |
| `people-cpt` | 39 | Staff and board profile pages and the people taxonomy archives |
| `retired-page` | 19 | Old giving, volunteer, newsletter, template and campaign pages |
| `events-calendar` | 5 | The Events Calendar URLs (`/events/`, `/event/<slug>/`, category archives) |
| `jobs-cpt` | 4 | Job openings and the job taxonomy archive |
| `worship-database-cpt` | 3 | The affirming-congregations directory (108 entries), temporary |
| `media` | 3 | Three PDFs that moved from `/wp-content/uploads/` to mirrored copies |
| `municipal-map-cpt` | 2 | The per-city municipal map pages (257), temporary |
| `post-taxonomy` | 2 | Post category and tag archives |
| `round-1-mockup` | 2 | Flat URLs from the first mockup round; safe to drop |

Where the 528 redirected live paths land:

| Lands on | Live paths |
|---|---|
| `/our-work/local/municipal-map/` | 258 |
| `/our-work/#faith` | 109 |
| `/news/` | 93 |
| `/about/leadership/` | 20 |
| `/get-involved/events/` | 7 |
| `/about/staff-interns/` | 5 |
| `/give/` | 4 |
| `/about/jobs-internships/` | 4 |
| `/get-involved/volunteer/` | 2 |
| `/our-work/legacy-of-equality/#honorees` | 1 |
| `/about/leadership/#governance` | 1 |
| `/give/#society` | 1 |
| `/give/#one-time` | 1 |
| `/give/#daf` | 1 |
| `/give/#in-kind` | 1 |
| `/legal-clinic/trans-know-your-rights/` | 1 |
| `/our-work/business/#ohio-business-competes` | 1 |
| `/about/staff-interns/#becca-alexander` | 1 |
| `/about/staff-interns/#dwayne-steward` | 1 |
| `/about/staff-interns/#jen-kuhn` | 1 |
| `/about/staff-interns/#jessi-sadaka` | 1 |
| `/about/staff-interns/#joseph-soza` | 1 |
| `/about/staff-interns/#josh-meeks` | 1 |
| `/about/staff-interns/#justin-joseph` | 1 |
| `/about/staff-interns/#kate-mozynski` | 1 |
| `/about/staff-interns/#kim-welter-2` | 1 |
| `/about/staff-interns/#leandrah-alexis` | 1 |
| `/about/staff-interns/#mary-zaller-2` | 1 |
| `/about/staff-interns/#paul-peters` | 1 |
| `/about/staff-interns/#serah-munroe` | 1 |
| `/about/staff-interns/#sheena-barnes` | 1 |
| `/about/staff-interns/#sol-a-kersey` | 1 |
| `/newsletter/` | 1 |
| `/legal-clinic/intake/thank-you/` | 1 |
| `/` | 1 |

## Testing

For each row of `legacy-url-map.csv`, request `live_path` without following redirects.

- "keeps its path": expect 200.
- "redirects": expect `http_code` and a `Location` equal to `lands_on`, then 200 at that address.

WordPress adds its own redirects (trailing slash, old-slug matching, guessed permalinks). A path that reaches the right page in two hops still fails the test; fix the rule's target instead.

Before launch the snapshot must be refreshed. The source repo has the command (`node scripts/check-redirects.mjs --fetch`), and `tools/expand_redirects.py` rebuilds this folder from the result.
