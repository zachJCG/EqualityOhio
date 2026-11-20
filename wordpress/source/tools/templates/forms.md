# Forms: What Exists and Where Each One Should Go

The source has six forms. All six carry `data-mock="true"`: the script validates them, shows an accessible error summary, and on a valid submit shows a message that says nothing was sent. None of them posts anywhere.

The live-site services below come from the source's own research (`source/nextjs/docs/site-map.md`, checked there on 2026-10-16). The recommendations are JCG's and need EO's agreement before Phase 5.

| Page | Form | On the live site today | Recommended wiring | May WordPress store it? |
|---|---|---|---|---|
| `/` | Newsletter signup (email only) | Not recorded in the source's notes | The same service as `/newsletter/` | Follows `/newsletter/` |
| `/newsletter/` | E-news signup | Gravity Forms on WordPress. The email platform behind it is not visible from outside | EO's existing Gravity Form, or their email platform's own embed | EO's call |
| `/contact/` | Contact | No equivalent; this page is new | Gravity Forms (EO owns it) or the Jetpack Form block, routed by topic | Yes. General inquiries only |
| `/get-involved/volunteer/` | Volunteer sign-up | EveryAction form `wmSqb0UnU0-23sWMyhoAQg2` | Embed or link that form. Do not rebuild it | No |
| `/legal-clinic/intake/` | Legal Clinic intake | An intake form whose provider is not visible from outside. The clinic's other forms run on Lawmatics | A Lawmatics form, embedded or linked | **Never** |
| `/legal-clinic/legal-network/` | Attorney Referral Network interest | Lawmatics form `2563c615-2333-4e9e-8864-590e41d538b5`, embedded with `lm_intake(...)` | Embed or link that form | No |

## The Intake Rule

Intake narratives can include immigration status, HIV status and gender identity. WordPress form plugins store submissions in the site database by default, and mail plugins keep copies. So nothing about an intake is written to WordPress: no stored entries, no logs, no emailed copies passing through a WordPress mailer. If an embed cannot be used, the page links to the Lawmatics form and gives the phone number.

A legal intake must also never fail silently. Whatever replaces the preview form, a person who submits it has to see that it was received, or be told plainly how to reach the clinic instead.

## Rules That Carry Over From the Source

- Donations always link out to EveryAction's human page, `https://secure.everyaction.com/<formId>`, in a new tab. Never build a donation form. Never link the `/v1/Forms/<formId>` address; it returns raw JSON.
- The newsletter page carries EO's SMS consent text verbatim. Any form that collects a phone number must carry it too.
- While a form is a preview, its note must say nothing was sent and name a real channel: 855-LGBT-LAW for clinic matters, info@equalityohio.org otherwise.
- Accessible form behavior is part of the release gate: visible required markers, hints tied with `aria-describedby`, a focused error summary that links to each invalid field, inline errors with `aria-invalid`, and 44px choice tiles.

## Embeds on WordPress

EveryAction and Lawmatics embeds load a script from their own domain. Use the embed code from EO's accounts rather than writing one from memory. Two things to check on the host: whether script embeds are allowed in page content for this plan and role, and whether the response headers permit those domains. The source's Content-Security-Policy notes (`source/nextjs/next.config.mjs`) list the exact domains each embed needs.

## Fields in the Source Forms

Use these to match labels and required markers if a preview form is rebuilt, and to brief EO on what each real form should ask.

<!-- GENERATED:forms-fields -->
