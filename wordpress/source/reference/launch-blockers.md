# Staging-Only Content, Expired Content and Links Back to WordPress

Generated from the source pages on 2026-11-22 with the same patterns the source repo's own tests use (`tests/site-rules.test.mjs`, `tests/freshness.test.mjs`). Line numbers refer to the file under `source/nextjs/`.

## 1. Expired Blocks: Do Not Port

None as of 2026-11-22. The four 2026 election blocks (`data-expires="2026-11-04"`) were deleted from the source after Election Day.

Everything else about the 2026 election (the `/votersguide/` page itself, the scorecard cards and the news items) is still in the source and is EO's call. Flag it; do not cut it yourself.

## 2. Staging-Only Copy (33 Lines on 20 Pages)

True only of a preview. Carry each one into WordPress as a marked staging note (one pattern, one class) so a single search finds them all at launch. The source 404 adds three more (`pages/404.js`, `lib/seo.mjs` `NOT_FOUND`).

| Page | Source line | Text |
|---|---|---|
| `/` | 300 | This is a design preview: nothing was submitted. The production build will connect to Equality Ohio’s email platform. |
| `/about/history` | 170 | Pending embed: the live history page embeds a video of the 2014 Gay Games Opening Ceremony that isn’t recreated in this preview. Watch it on YouTube . |
| `/about/leadership` | 155 | Mockup note: headshots and full bios load in during content migration — initials are placeholders. |
| `/about/staff-interns` | 154 | Mockup note: headshots and full bios load in during content migration — initials are placeholders. |
| `/contact` | 162 | Message sent — in the real build. |
| `/contact` | 163 | This preview didn’t send anything. In production this routes to the right inbox automatically. |
| `/get-involved/events` | 162 | Pending embed: the live site’s events calendar is an EveryAction embed that isn’t recreated in this preview. Browse the current calendar on EveryAction: Equality Ohio events calendar . |
| `/get-involved/volunteer` | 137 | Design preview — this recreates Equality Ohio’s volunteer sign‑up form, but it isn’t connected yet and nothing you type is saved or sent. To volunteer today, use Equality Ohio’s volunteer sign‑up form on EveryAction or email info@equalityohio.org . |
| `/get-involved/volunteer` | 188 | All states will be listed in the production build. |
| `/get-involved/volunteer` | 217 | You’re signed up — in the real build. |
| `/get-involved/volunteer` | 218 | This preview didn’t save or send anything. In production, your sign‑up would go to Equality Ohio’s organizing team through EveryAction. Want to volunteer right now? Use Equality Ohio’s volunteer sign‑up form on EveryAction or email info@equalityohio.org . |
| `/give` | 162 | Buttons link to Equality Ohio’s current live giving pages. In the production build, giving flows are embedded on-site. Tax-deductibility language (Education Fund 501(c)(3) vs. Equality Ohio 501(c)(4)) will be finalized with EO’s development team. |
| `/jim-obergefell-john-arthur-society` | 194 | The join button opens Equality Ohio’s live EveryAction giving form in a new tab. In the production build, this flow may be embedded on‑site. |
| `/legal-clinic/intake` | 137 | Design preview — this form isn’t connected yet and nothing you type is saved or sent. If you need legal help today, call 855‑LGBT‑LAW . |
| `/legal-clinic/intake` | 167 | All 88 counties will be listed in the production build. |
| `/legal-clinic/intake` | 206 | Intake received — in the real build. |
| `/legal-clinic/intake` | 207 | This preview didn’t save or send anything. In production, your intake would go securely to the clinic team and you’d get a confirmation email. Need help right now? Call 855‑LGBT‑LAW . |
| `/legal-clinic/intake/thank-you` | 110 | Design preview — this is the confirmation screen shown after a real intake submission. In this preview, no intake has been transmitted. |
| `/legal-clinic/legal-network` | 165 | Design preview — the live interest form is a Lawmatics embed that isn’t recreated here yet, and nothing you type on this page is saved or sent. Until this form is connected, use the attorney referral network sign‑up form on Lawmatics . |
| `/legal-clinic/legal-network` | 205 | Interest noted — in the real build. |
| `/legal-clinic/legal-network` | 206 | This preview didn’t save or send anything. In production, your interest form would start the application process with the clinic team. In the meantime, use the sign‑up form on Lawmatics or email info@equalityohio.org . |
| `/legal-clinic/ohio-lgbtq-family-law-guide` | 139 | Pending asset: the guide itself is a downloadable PDF (2025 edition) hosted by Equality Ohio — the cover art and an inline reader aren’t recreated in this preview yet. Until then, use the download link below. |
| `/news` | 177 | Mockup shows five recent posts from equalityohio.org. Production build includes the full archive with categories, search, and pagination. |
| `/newsletter` | 132 | Design preview — this form isn’t connected yet and nothing you type is saved or sent. To get updates today, sign up on the live page: equalityohio.org . In production this form connects to EO’s email platform (the live form runs on Gravity Forms in WordPress)  |
| `/newsletter` | 165 | You’re on the list — in the real build. |
| `/newsletter` | 166 | This preview didn’t transmit anything. To actually subscribe, use the live signup page or email info@equalityohio.org . |
| `/our-work` | 220 | The searchable congregation directory is a pending data migration — the 100+ listings have not been moved into this preview yet. Until then, browse the directory on the current site. Browse the Live Worship Database |
| `/our-work/legacy-of-equality` | 228 | Mockup note: honoree headshots and the 2026 event photos load in during content migration — initials are placeholders. Read the full announcement in the 20th anniversary awardees press release . |
| `/our-work/local/municipal-map` | 154 | Interactive map coming to this preview. The live site’s municipal equality map is an interactive tool — a statewide map embed plus individual detail pages for the more than 250 Ohio cities whose codes Equality Ohio analyzed. It isn’t recreated in this design p |
| `/our-work/local/municipal-map` | 222 | The organizing‑help form returns with the production build. Until then, email info@equalityohio.org . |
| `/stories` | 134 | Pending embed — the story archive on the live site loads dynamically from Equality Ohio’s WordPress (a “Load More” feed of story posts), and those stories haven’t been migrated into this preview. Read them on the live page in the meantime: equalityohio.org/sto |
| `/stories` | 158 | Pending — the live site’s “Share Your Story” submission page currently returns a 404 (it points at a retired staging URL), so there is no live form to mirror here yet. When EO provides the story-submission form and its fields, a visual-only mock of it replaces |
| `/votersguide` | 142 | Design preview — candidate portraits and the letter-grade badge graphics from the live scorecard are pending assets, so grades are not shown on the write-ups below. See every grade in the downloadable scorecard PDF . |

## 3. Links Back to equalityohio.org (11)

On a fresh install these still point at the live site, which is fine while staging. They become loops or 404s the day this build serves equalityohio.org.

| Page | Link text | Target |
|---|---|---|
| `/news` | Read more: Press Release: $750,000 Legacy Gift Strengthens the Future of LGBTQIA+ Organizations in Central Ohio | https://equalityohio.org/dannystoutlegacygift/ |
| `/news` | Read more: Equality Ohio’s 2026 Candidate Scorecard Is Here | https://equalityohio.org/equality-ohios-2026-candidate-scorecard-is-here/ |
| `/news` | Read more: Roadmap Back to Equality: The Equality Ohio Strategic Plan (2026–2028) | https://equalityohio.org/roadmap-back-to-equality-the-equality-ohio-strategic-plan-2026-2028/ |
| `/news` | Read more: State of Equality in Ohio 2026 Address | https://equalityohio.org/state-of-equality-in-ohio-2026-address/ |
| `/news` | Read more: Ohio House Passes “My Child, My Chart,” Undermining Youth Privacy | https://equalityohio.org/press-release-from-equality-ohio-ohio-house-passes-my-child-my-chart-undermining-youth-privacy/ |
| `/newsletter` | equalityohio.org | https://equalityohio.org/sign-up-for-the-latest-news-from-equality-ohio/ |
| `/newsletter` | live signup page | https://equalityohio.org/sign-up-for-the-latest-news-from-equality-ohio/ |
| `/our-work` | Browse the Live Worship Database | https://equalityohio.org/worship-database/ |
| `/our-work/legacy-of-equality` | 20th anniversary awardees press release | https://equalityohio.org/press-release-equality-ohio-completes-20th-anniversary-list-of-awardees-with-tribute-to-community-activism/ |
| `/our-work/local/municipal-map` | equalityohio.org/our-work/local/municipal-map | https://equalityohio.org/our-work/local/municipal-map/ |
| `/stories` | equalityohio.org/stories | https://equalityohio.org/stories/ |

## 4. Forms That Send Nothing (6)

See `reference/forms.md` for fields and where each one should go.

- `/contact`: Contact form (4 fields, button "Send Message")
- `/get-involved/volunteer`: Volunteer sign-up (13 fields, button "Sign Up to Volunteer")
- `/`: Newsletter signup (1 fields, button "Sign Up")
- `/legal-clinic/intake`: Legal clinic intake (16 fields, button "Submit Intake")
- `/legal-clinic/legal-network`: Attorney Referral Network interest form (7 fields, button "Express Interest")
- `/newsletter`: E-news signup (5 fields, button "Sign Up")
