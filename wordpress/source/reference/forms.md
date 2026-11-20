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

### `/contact`: Contact form

Submit button: "Send Message".

| Label | Type | Required | Source id |
|---|---|---|---|
| Name | text | Yes | `ct-name` |
| Email | email | Yes | `ct-email` |
| What’s this about? | select | No | `ct-topic` |
| Message | textarea | Yes | `ct-msg` |

### `/get-involved/volunteer`: Volunteer sign-up

Submit button: "Sign Up to Volunteer". Field groups: Interests.

| Label | Type | Required | Source id |
|---|---|---|---|
| First name | text | Yes | `v-first` |
| Last name | text | Yes | `v-last` |
| Pronouns (optional) | select | No | `v-pronouns` |
| Street address (optional) | text | No | `v-address` |
| City | text | Yes | `v-city` |
| State | select | Yes | `v-state` |
| Postal code | text | Yes | `v-zip` |
| Mobile phone | tel | Yes | `v-phone` |
| Email | email | Yes | `v-email` |
| I’m interested in volunteer opportunities in Northeast Ohio | checkbox | No | `i-ne` |
| I’m interested in volunteer opportunities in Central Ohio | checkbox | No | `i-ce` |
| I’m interested in volunteer opportunities in Southwest Ohio | checkbox | No | `i-sw` |
| I’m interested in virtual/online volunteer opportunities, or opportunities in a region that is not listed above | checkbox | No | `i-virtual` |

### `/`: Newsletter signup

Submit button: "Sign Up".

| Label | Type | Required | Source id |
|---|---|---|---|
| Email address | email | Yes | `nl-email` |

### `/legal-clinic/intake`: Legal clinic intake

Submit button: "Submit Intake". Field groups: Safe ways to contact you; What kind of issue is this?.

| Label | Type | Required | Source id |
|---|---|---|---|
| Name | text | Yes | `in-name` |
| Pronouns (optional) | text | No | `in-pronouns` |
| Email | email | Yes | `in-email` |
| Phone (optional) | tel | No | `in-phone` |
| County | select | Yes | `in-county` |
| Email is safe | checkbox | No | `c-email` |
| Calls are safe | checkbox | No | `c-call` |
| OK to leave a voicemail | checkbox | No | `c-vm` |
| Name or gender marker change | radio | No | `t-name` |
| Family law | radio | No | `t-family` |
| Discrimination — housing, work, or public places | radio | No | `t-discrim` |
| Consumer issue — fraud, identity theft, debt | radio | No | `t-consumer` |
| Public benefits — SSI, disability | radio | No | `t-benefits` |
| Something else | radio | No | `t-other` |
| What’s going on? | textarea | No | `in-story` |
| I understand that representation by a clinic lawyer depends on income (within 300% of the federal poverty level), and clinic staff will review this with me. | checkbox | Yes | `in-income` |

### `/legal-clinic/legal-network`: Attorney Referral Network interest form

Submit button: "Express Interest".

| Label | Type | Required | Source id |
|---|---|---|---|
| Name | text | Yes | `net-name` |
| Email | email | Yes | `net-email` |
| Phone (optional) | tel | No | `net-phone` |
| Firm or organization (optional) | text | No | `net-firm` |
| Practice area(s) | text | No | `net-practice` |
| County or counties you serve | text | No | `net-county` |
| Anything you’d like us to know (optional) | textarea | No | `net-message` |

### `/newsletter`: E-news signup

Submit button: "Sign Up".

| Label | Type | Required | Source id |
|---|---|---|---|
| First Name | text | Yes | `nl-first` |
| Last Name | text | Yes | `nl-last` |
| Email | email | Yes | `nl-email` |
| Zip Code (Optional) | text | No | `nl-zip` |
| Phone (Optional) | tel | No | `nl-phone` |

