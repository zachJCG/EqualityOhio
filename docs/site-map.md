# Live equalityohio.org → redesign URL map

Captured from the live WordPress sitemaps on **2026-08-13** (page, post,
events, people, job, worship-database, municipal-map) and **re-checked
2026-10-16** against all 13 child sitemaps of `sitemap_index.xml`, including
the taxonomy archives (category, post_tag, tribe_events_cat, people-category,
job-category) that the first capture missed. The snapshot lives in
`docs/legacy-sitemap-urls.txt` (553 paths); `npm run check:redirects` (part of
`npm test`) fails if any of them would 404, and today all 553 answer.

Every live URL either **keeps its path** in the redesign or **redirects**
(rules live in `next.config.mjs`). Rule of scope: nothing expired or old gets
ported. Stale campaign pages, past events, and template scratch pages are
redirects only; events appear only while upcoming.

## Pages that keep their live path

| Live URL | Page file | Notes |
|---|---|---|
| `/` | `public/index.html` | Redesigned home; time-boxed 2026 election section (`data-expires="2026-11-04"`) |
| `/about/` | `public/about.html` | Mission, values |
| `/about/history/` | `public/about/history.html` | New: timeline from live history page |
| `/about/leadership/` | `public/about/leadership.html` | c3 + c4 boards; `#governance` links the conflict-of-interest forms PDF |
| `/about/staff-interns/` | `public/about/staff-interns.html` | New: roster from live page |
| `/about/jobs-internships/` | `public/about/jobs-internships.html` | New: current openings only (BambooHR posting 30) |
| `/legal-clinic/` | `public/legal-clinic.html` | |
| `/legal-clinic/intake/` | `public/legal-clinic/intake.html` | Mock form until Supabase phase |
| `/legal-clinic/ohio-lgbtq-family-law-guide/` | `public/legal-clinic/ohio-lgbtq-family-law-guide.html` | New |
| `/legal-clinic/trans-know-your-rights/` | `public/legal-clinic/trans-know-your-rights.html` | New; mirrors the live page as of 2026-08-20 (gender-marker-on-ID section and the 2025 PDF withdrawn). Also absorbs `/get-involved/hb68/` |
| `/legal-clinic/legal-network/` | `public/legal-clinic/legal-network.html` | New |
| `/get-involved/` | `public/get-involved.html` | New hub |
| `/get-involved/volunteer/` | `public/get-involved/volunteer.html` | New |
| `/get-involved/events/` | `public/get-involved/events.html` | New: **upcoming events only**. Empty state today ("There are no upcoming events.", as live) |
| `/our-work/` | `public/our-work.html` | New hub; `#faith` covers affirming-congregations work |
| `/our-work/local/` | `public/our-work/local.html` | New |
| `/our-work/local/municipal-map/` | `public/our-work/local/municipal-map.html` | New: interactive map pending (Supabase phase) |
| `/our-work/business/` | `public/our-work/business.html` | New; `#ohio-business-competes` section |
| `/our-work/legacy-of-equality/` | `public/our-work/legacy-of-equality.html` | New: `#honorees` holds the 2026 Advocates & Allies honorees (from `/aa2026/`) above the 2025 20th-anniversary class; Legacy of Equality Society |
| `/votersguide/` | `public/votersguide.html` | New: 2026 scorecard, September 2026 update; GOTV block until Election Day |
| `/stories/` | `public/stories.html` | New |
| `/jim-obergefell-john-arthur-society/` | `public/jim-obergefell-john-arthur-society.html` | New |
| `/news/` | `public/news.html` | Redesigned; recent items |
| `/privacy-policy/` | `public/privacy-policy.html` | Live text verbatim (Last Updated September 18, 2026). **EO counsel to confirm** the WordPress-era policy fits the new stack |
| `/terms-conditions/` | `public/terms-conditions.html` | Live "Text Messaging Terms" verbatim (2026-09-20). Same counsel check |

New-site-only pages (no live equivalent): `/contact`, `/newsletter` (clean
home for the long signup slug), `/give` (consolidates the donate URLs),
`/legal-clinic/intake/thank-you`, `/gate` (staging only).

## Redirects (defined in next.config.mjs)

308 = permanent, 307 = temporary (a path EO may want back). Next also 308s
every trailing-slash spelling (`/about/` to `/about`) and every page's file
spelling (`/about.html` to `/about`, generated from the `public/` walk).

| Live URL(s) | → Destination | Why |
|---|---|---|
| `/get-involved/donate/`, `/get-involved/donate/equality/`, `/get-involved/make-a-gift/`, `/donate2022/` | `/give` | Giving consolidated on one page; gifts flow to EveryAction (NGP) |
| `/donate-one-time/` | `/give#one-time` | |
| `/donate-eoef/` | `/give#society` | EOEF leadership giving = Obergefell–Arthur Society card |
| `/get-involved/donate/donor-advised-funds/` | `/give#daf` | |
| `/get-involved/donate/in-kind-donations/` | `/give#in-kind` | |
| `/volunteerfb/`, `/volunteerfb-thanks/` | `/get-involved/volunteer` | Expired Facebook campaign landers |
| `/events/`, `/events-2/`, `/our-work/events/`, `/event/<slug>/` | `/get-involved/events` | One events page |
| `/events/category/<slug>/` (and anything else under `/events/`) | `/get-involved/events` | The Events Calendar category archives (`advocates-allies`, `evening-for-equality`) |
| `/aa2026/` | `/our-work/legacy-of-equality#honorees` (307) | Advocates & Allies 2026 page (2026-10-07); temporary so a future event can reuse the short URL |
| `/people/<slug>/` (15 staff profiles) | `/about/staff-interns#<slug>` | Each deep-links to that person's card (card ids match the live slugs) |
| `/people/<slug>/` (18 board profiles) | `/about/leadership` | |
| `/people/`, any other `/people/<slug>/` (the 34th profile, `mike-dewine`) | `/about/staff-interns` | |
| `/about/staff-interns/<slug>/` | `/about/staff-interns` | |
| `/people-category/equality-ohio-board/`, `/people-category/equality-ohio-education-fund-board/` | `/about/leadership` | People taxonomy archives (boards) |
| `/people-category/<slug>/` (`staff-interns`, `statewide-candidates`, `cle-instructor`) | `/about/staff-interns` | People taxonomy archives (the 2018 candidate entry is not ported) |
| `/job-opening/`, `/job-opening/<slug>/`, `/single-jobs-internships-template/` | `/about/jobs-internships` | |
| `/job-category/<slug>/` (`externship`) | `/about/jobs-internships` | Job taxonomy archive |
| `/sign-up-for-the-latest-news-from-equality-ohio/` | `/newsletter` | |
| `/thank-you-for-submitting-your-intake-request-…/` | `/legal-clinic/intake/thank-you` | |
| `/get-involved/hb68/` | `/legal-clinic/trans-know-your-rights` | HB 68 became law in 2024; the durable resource is the rights guide |
| `/our-work/business/ohio-business-competes/` | `/our-work/business#ohio-business-competes` | |
| `/worship-database/`, `/worship-database/<slug>/` (108 congregations) | `/our-work#faith` (307) | Directory returns as Supabase-driven feature |
| `/our-work/faith/` | `/our-work#faith` (307) | Live quirk: it 301s into a worship-database entry |
| `/municipal-map/`, `/municipal-map/<city>/` (257 city pages) | `/our-work/local/municipal-map` (307) | Per-city data returns with the interactive map |
| `/conflict-of-interest-forms/` | `/about/leadership#governance` | The forms PDF is linked there |
| `/news-template/`, `/news-template-2/` | `/news` | WordPress scratch pages (`/news/news-template/` is in the post sitemap, so the post list covers it) |
| `/thankyou/` | `/` | Orphan thank-you page |
| `/category/<slug>/` | `/news` | Post category archives |
| `/tag/<slug>/` (12 tags, incl. `gotv2026`, `ohiovotes`) | `/news` | Post tag archives |
| 69 legacy post URLs (`lib/legacy-post-paths.mjs`, regenerated 2026-10-16; new since August: `/gotv2026/`, `/dannystoutlegacygift/`) | `/news` | Old posts are not ported; regenerate the list from the live post sitemap before launch |
| `/wp-content/uploads/2026/06/EQ_Candidate-Scorecard_September-Edits_9-18-v2.pdf` | `/assets/docs/EQ_Candidate-Scorecard_September-Edits_9-18-v2.pdf` | Mirrored PDF (8.2 MB), linked from `/votersguide` |
| `/wp-content/uploads/2023/02/EOEF-Organizational-Financial-Conflict-of-Interest-combined.pdf` | `/assets/docs/EOEF-Organizational-Financial-Conflict-of-Interest-combined.pdf` | Mirrored PDF (236 KB), linked from `/about/leadership#governance` |
| `/wp-content/uploads/2024/11/Privacy-Policy-November-2024.pdf` | `/assets/docs/Privacy-Policy-November-2024.pdf` | Mirrored Legal Clinic Privacy Policy (141 KB), linked from `/privacy-policy` |
| `/board`, `/legal-clinic-intake` | canonical paths | Round-1 mockup flat URLs |

Not mirrored, so still served only by WordPress: the 2025 Trans Know Your
Rights PDF (live withdrew it on 2026-08-20; do not bring it back) and the
Family Law Guide behind `bit.ly/FamilyLawGuide_2025`
(`/wp-content/uploads/2025/05/Family-Law-Guide-May-2025-3.pdf`, 25 MB, over the
15 MB per-file limit). See "Pending" below.

## External form and giving URLs

EveryAction (NGP) serves each form twice. **Link people to the human page,
`https://secure.everyaction.com/<formId>`.** The
`https://secure.everyaction.com/v1/Forms/<formId>` URL is only the embed's
`data-form-url` data endpoint: it returns JSON, so a donor who lands on it sees
a raw API response.

| Program | Human URL (link this) | Status 2026-10-16 |
|---|---|---|
| One-time gift (`/give` "Make Your Gift", "Donate Now") | `https://secure.everyaction.com/EdZ6NpoEMUWWZvFdaAdqJQ2` | Published |
| EOEF / Obergefell–Arthur Society leadership giving | `https://secure.everyaction.com/0VkWv2FL0UeGdLOF6aMsiw2` | Published |
| Obergefell & Arthur Society ("Join O&A Today") | `https://secure.everyaction.com/_TJkVuSp-Eu7d7x0ZmtzgA2` | Published |
| Defenders of Equality (live nav) | `https://secure.everyaction.com/O2F5qByi8kSgvOAQysPEIQ2` | Published |
| Defenders of Equality monthly levels (`/give#defenders`) | `https://secure.everyaction.com/L25k7K9WokSU_MLMSR4W3Q2` | Published |
| Volunteer sign-up (`/get-involved/volunteer` fallback) | `https://secure.everyaction.com/wmSqb0UnU0-23sWMyhoAQg2` | Published |
| #TransJoy notes | `https://secure.everyaction.com/l1rpSxaDi0qspDeM90FgxA2` | Published |
| Events calendar ("Equality Ohio Happenings") | `https://secure.everyaction.com/p/p8xo4ZmRSUmLA57z1RaA7w2` | Live, no upcoming events |
| Advocates & Allies 2026 tickets | `ogzjsrdJZkeM8YFd6865yQ2` | Deactivated (the event was 2026-10-01); not linked |
| Donor self-service ("Update Your Information" in the live nav) | `https://secure.everyaction.com/p/7UE5VC3E7E6JBS_PvyxKJw2` | A login portal, not an interest form; not linked |

Other form hosts:

- Legal Network interest form: Lawmatics custom form "Sign up for attorney
  referral network", `https://app.lawmatics.com/forms/share/2563c615-2333-4e9e-8864-590e41d538b5`
  (the live page embeds it with `lm_intake("2563c615-…")`). Fields: first name,
  last name, Ohio Bar number, email, counties of practice, company or firm
  name, years in practice, interest in referral cases, interest in pro bono or
  low bono cases, practice areas (multi-select), anything else.
- Legal Clinic updates: Lawmatics, `https://app.lawmatics.com/forms/share/41133a09-f56c-4b3e-96ca-270d791baf53`.
- Jobs: BambooHR, `https://equalityohio.bamboohr.com/careers/30` (Fall Law
  Student Externship, open). Posting id 29 was deleted.
- GOTV volunteers (live `/gotv2026/` post, until Election Day): Google Form
  `https://docs.google.com/forms/d/e/1FAIpQLSfmvKNQ8zhhmfRmbTntzdK8qAUYLsdKRcFPs-_ChZq-nDWp8w/viewform`.

## Pending links / embeds / assets to grab

Compiled from page authoring; keep this list current as items land.

**Integrations (wired in a later phase)**
- EveryAction (NGP) giving embeds: buttons link out to the human form pages
  in the table above.
- Email platform signup (newsletter + footer forms are visual-only mocks).
  The newsletter page carries the live SMS consent text verbatim; any future
  form that collects a phone number must carry it too.
- Supabase: intake, contact, volunteer, legal-network and story forms;
  municipal-map dataset (257 municipalities); affirming-congregations
  directory (108 entries); events as data rows.

**Time-boxed content (delete after Election Day, 2026-11-03)**
- `/` election section, `/votersguide` GOTV block and `/news` alert are
  wrapped in `<!-- ELECTION: … -->` comments and carry
  `data-expires="2026-11-04"`, so `npm test` fails from 2026-11-05 until they
  are removed.

**Notable specifics found during authoring**
- Newsletter is Gravity Forms on WordPress; downstream email platform not
  revealed by the embed. Confirm with EO.
- Voters guide: per-candidate letter grades exist only inside the live
  portrait PNGs; grade data or badge art needed from EO. The September PDF is
  mirrored.
- Live-site bugs to flag to EO: many links point at the retired
  `equalityoh.wpengine.com` staging host, and the live "Share Your Story"
  button 404s through it; `/job-opening/fall-legal-extern/` still links the
  deleted BambooHR posting 29 and the live jobs index still says "$25/Hour, 12
  weeks" (BambooHR says academic credit); the Legacy of Equality page says
  "please complete the form below" but has no form; the voters guide reads
  "His voted" for Keith Faber (fixed to "He voted" here) and says Allison
  Russo opposed "Issue 1 in 2024" (the supermajority Issue 1 was August 2023;
  EO's own September 18 scorecard PDF says 2023, and so does this page); the
  live footer's Community Shares of Mid-Ohio badge image is a 404 (not
  ported).

**Assets**
- Official logo files + GuideStar badge artwork (SVG stand-ins are
  exact-geometry recreations; swap the official files).
- Photography (none licensed yet; brand-color art and avatar initials hold
  the slots); board, staff and 2026 honoree headshots; the 2026 Advocates
  & Allies event photos.
- Family Law Guide PDF (25 MB): too large to mirror. EO must keep it hosted
  at its `/wp-content/` path or supply a compressed copy, and repoint
  `bit.ly/FamilyLawGuide_2025`, before launch.
- New Trans Know Your Rights PDF: live says "coming soon". Host it under
  `/assets/docs/` when the Legal Clinic publishes it.
- Know-your-rights video embeds for `/legal-clinic/trans-know-your-rights`.

**Resolved 2026-10-16**
- Privacy policy and terms pages exist; the footer links both.
- Conflict-of-interest forms: one combined PDF (adopted February 6, 2023),
  mirrored and linked from `/about/leadership#governance`.
- 2026 Candidate Scorecard: the September update PDF is mirrored.

**Pre-deploy and launch checks**
- Before every deploy: `npm run pages:build` (a no-op), `npm test`,
  `npm run build`, `npm run test:e2e`, and `EO_TODAY=<deploy date> npm test`
  so nothing expires before the deploy lands. `npm test` enforces event and
  `data-expires` dates and live-sitemap coverage.
- `/about/jobs-internships`: confirm the BambooHR posting is still open.
- When EO publishes posts: regenerate `lib/legacy-post-paths.mjs` from the
  live post sitemap and refresh the snapshot
  (`node scripts/check-redirects.mjs --fetch`).
- Launch: `docs/launch-checklist.md`. While staging, `npm test` warns about
  every link back to equalityohio.org or `/wp-content/`, every line of
  staging-only copy and every mock form; with `LAUNCHED = true` each one
  fails.
