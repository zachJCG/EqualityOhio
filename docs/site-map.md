# Live equalityohio.org → redesign URL map

Captured from the live WordPress sitemaps on **2026-08-13** (page, post,
events, people, job, worship-database, municipal-map). Every live URL either
**keeps its path** in the redesign or **redirects** (rules live in
`next.config.mjs`). Rule of scope: nothing expired or old gets ported —
stale campaign pages, past events, and template scratch pages are redirects
only; events appear only while upcoming.

## Pages that keep their live path

| Live URL | Page file | Notes |
|---|---|---|
| `/` | `public/index.html` | Redesigned home |
| `/about/` | `public/about.html` | Mission, values |
| `/about/history/` | `public/about/history.html` | New — timeline from live history page |
| `/about/leadership/` | `public/about/leadership.html` | c3 + c4 boards; `#governance` holds COI forms |
| `/about/staff-interns/` | `public/about/staff-interns.html` | New — roster from live page |
| `/about/jobs-internships/` | `public/about/jobs-internships.html` | New — includes current openings only |
| `/legal-clinic/` | `public/legal-clinic.html` | |
| `/legal-clinic/intake/` | `public/legal-clinic/intake.html` | Mock form until Supabase phase |
| `/legal-clinic/ohio-lgbtq-family-law-guide/` | `public/legal-clinic/ohio-lgbtq-family-law-guide.html` | New |
| `/legal-clinic/trans-know-your-rights/` | `public/legal-clinic/trans-know-your-rights.html` | New — also absorbs `/get-involved/hb68/` |
| `/legal-clinic/legal-network/` | `public/legal-clinic/legal-network.html` | New |
| `/get-involved/` | `public/get-involved.html` | New hub |
| `/get-involved/volunteer/` | `public/get-involved/volunteer.html` | New |
| `/get-involved/events/` | `public/get-involved/events.html` | New — **upcoming events only** |
| `/our-work/` | `public/our-work.html` | New hub; `#faith` covers affirming-congregations work |
| `/our-work/local/` | `public/our-work/local.html` | New |
| `/our-work/local/municipal-map/` | `public/our-work/local/municipal-map.html` | New — interactive map pending (Supabase phase) |
| `/our-work/business/` | `public/our-work/business.html` | New; `#ohio-business-competes` section |
| `/our-work/legacy-of-equality/` | `public/our-work/legacy-of-equality.html` | New — honoree program (evergreen) |
| `/votersguide/` | `public/votersguide.html` | New — 2026 cycle is current |
| `/stories/` | `public/stories.html` | New |
| `/jim-obergefell-john-arthur-society/` | `public/jim-obergefell-john-arthur-society.html` | New |
| `/news/` | `public/news.html` | Redesigned; recent items |

New-site-only pages (no live equivalent): `/contact`, `/newsletter` (clean
home for the long signup slug), `/give` (consolidates the donate URLs),
`/legal-clinic/intake/thank-you`, `/gate` (staging only).

## Redirects (defined in next.config.mjs)

| Live URL(s) | → Destination | Why |
|---|---|---|
| `/get-involved/donate/`, `/get-involved/donate/equality/`, `/get-involved/make-a-gift/`, `/donate2022/` | `/give` | Giving consolidated on one page; gifts flow to EveryAction (NGP) |
| `/donate-one-time/` | `/give#one-time` | |
| `/donate-eoef/` | `/give#society` | EOEF leadership giving = Obergefell–Arthur Society card |
| `/get-involved/donate/donor-advised-funds/` | `/give#daf` | |
| `/get-involved/donate/in-kind-donations/` | `/give#in-kind` | |
| `/volunteerfb/`, `/volunteerfb-thanks/` | `/get-involved/volunteer` | Expired Facebook campaign landers |
| `/events/`, `/events-2/`, `/our-work/events/`, `/event/<slug>/` | `/get-involved/events` | One events page |
| `/people/`, `/people/<slug>/` (34 profiles) | `/about/staff-interns` | Profiles fold into rosters (board members are on `/about/leadership`) |
| `/job-opening/`, `/job-opening/<slug>/`, `/single-jobs-internships-template/` | `/about/jobs-internships` | |
| `/sign-up-for-the-latest-news-from-equality-ohio/` | `/newsletter` | |
| `/thank-you-for-submitting-your-intake-request-…/` | `/legal-clinic/intake/thank-you` | |
| `/get-involved/hb68/` | `/legal-clinic/trans-know-your-rights` | HB 68 became law in 2024; the durable resource is the rights guide |
| `/our-work/business/ohio-business-competes/` | `/our-work/business#ohio-business-competes` | |
| `/worship-database/`, `/worship-database/<slug>/` (108 congregations) | `/our-work#faith` (302) | Directory returns as Supabase-driven feature |
| `/municipal-map/<city>/` (257 city pages) | `/our-work/local/municipal-map` (302) | Per-city data returns with the interactive map |
| `/conflict-of-interest-forms/` | `/about/leadership#governance` | Forms are pending assets |
| `/news-template/`, `/news-template-2/`, `/news/news-template/` | `/news` | WordPress scratch pages |
| `/thankyou/` | `/` | Orphan thank-you page |
| `/category/<slug>/` | `/news` | |
| 67 legacy post URLs (`lib/legacy-post-paths.mjs`) | `/news` | Old posts are not ported; regenerate the list from the live post sitemap before launch |
| `/board`, `/legal-clinic-intake` | canonical paths | Round-1 mockup flat URLs |

## Pending links / embeds / assets to grab

Compiled from page authoring; keep this list current as items land.

**Integrations (wired in a later phase)**
- EveryAction (NGP) giving embeds — buttons currently link out to the live
  EveryAction pages; direct form URLs recorded per giving program.
- Email platform signup (newsletter + footer forms are visual-only mocks).
- Supabase: intake, contact, volunteer, legal-network and story forms;
  municipal-map dataset (257 municipalities); affirming-congregations
  directory (108 entries); events as data rows.

**Assets**
- Official logo files + GuideStar badge artwork (SVG stand-ins are
  exact-geometry recreations; swap the official files).
- Photography (none licensed yet — brand-color art and avatar initials hold
  the slots); board/staff headshots.
- Conflict-of-interest disclosure forms (two PDFs).
- 2026 Candidate Scorecard asset/tool for `/votersguide`.
- Know-your-rights video embeds for `/legal-clinic/trans-know-your-rights`.
- Privacy policy page/URL for the footer (currently a placeholder `#`).

**Pre-deploy checks** (deployment is a few weeks out)
- `/get-involved/events`: delete any event block whose date has passed.
- `/about/jobs-internships`: confirm openings are still open.
- Regenerate `lib/legacy-post-paths.mjs` from the live post sitemap.
- Decide launch handling for legacy news posts (archive import vs. permanent
  redirect to `/news`).
