# The WordPress.com Site: State, Plans, Limits and Tools

Everything here was read through the WordPress.com MCP server on 2026-11-20. Plans and prices change; re-read them before relying on this page.

## State

| | |
|---|---|
| Address | `https://zach364b94579cd.wordpress.com` |
| Site ID | `258848468` (pass it as the string `wpcom_site`) |
| Title | Equality Ohio. Changed today from "My Site"; nothing else was changed |
| Created | 2026-11-20 |
| Visibility | Coming Soon. Not launched. Not private |
| Plan and platform | Free, "Simple" |
| Theme | Assembler (`pub/assembler`), a stock block theme |
| Templates | 10 stock templates, 3 template parts (header, header-hero, footer). None customized |
| Pages | One: "About", ID 1, slug `about`, published |
| Navigation | One menu, ID 4 |
| Front page | Latest posts. No static page set |
| Permalinks | `/%year%/%monthnum%/%day%/%postname%/` |
| Timezone | Unset (UTC). Should be `America/New_York` |
| Tagline, site icon, logo | Empty |
| Admin email | zach@josephcartergroup.com |
| Admin | `https://zach364b94579cd.wordpress.com/wp-admin/` · Site Editor at `/wp-admin/site-editor.php` |

## What the Free Plan Does Not Include

From WordPress.com's plan data for this site. The first column is the lowest plan that lists the feature.

| First available on | Features this build needs or may want |
|---|---|
| Personal | Custom theme upload, plugin install and upload, SFTP and SSH, GitHub deployments, Studio sync, custom styles, custom domain |
| Premium | Custom design, advanced SEO tools, Google Analytics |
| Business | Staging sites, permalink settings, site preview links, CDN, form webhooks, security settings, removing WordPress.com branding |

The plan data also says every paid plan can *activate hosting features*, and that this is what enables plugin installs and theme uploads. So the order after an upgrade is: buy the plan, activate hosting features, then upload.

| Plan | Price per year (USD, billed yearly) |
|---|---|
| Personal | $48 |
| Premium | $96 |
| Business | $300 |
| Commerce | $540 |

Plans page: `https://wordpress.com/plans/zach364b94579cd.wordpress.com`

## Which Plan This Work Needs

- **Personal is the minimum** to get the custom theme and the companion plugin onto this site.
- **Business is the one to pick if any of these matter:** EO reviewers need a preview link to a site that is still Coming Soon; news posts will be imported and must keep the live site's root-level URLs (`/post-slug/`), which needs permalink settings; or JCG wants a separate staging copy of the site.

That is a recommendation, and the purchase is Zach's.

## What Was and Was Not Tested

- **Read successfully today:** site settings, pages, templates, template parts, navigation, active theme, plans.
- **Written once:** the site title.
- **Reported by the server:** this site has "limited" MCP support. Basic tasks should work; plugin management and other advanced tools may stay unavailable until the site is on a plan with hosting features.
- **Not tested:** creating pages, editing templates or global styles, and uploading media on the free plan. Find out with one small write and a read-back before planning around any of them.

## Tools on the WordPress.com MCP Server

Names as exposed on 2026-11-20. Check your own client's list; each tool describes its own inputs.

| Job | Tools |
|---|---|
| Find and read the site | `wpcom-user-sites`, `wpcom-site-settings`, `wpcom-theme-active`, `wpcom-plans-list` |
| Settings | `wpcom-site-settings-update` (title, timezone, front page, posts page) |
| Pages | `wpcom-mcp-pages-list`, `-get`, `-create`, `-update` |
| Templates and parts | `wpcom-templates-*`, `wpcom-template-parts-*`, `wpcom-global-styles-get`, `-update` |
| Menus | `wpcom-navigation-*` for block themes; `wpcom-menus-*` and `wpcom-menu-items-*` for classic menus |
| Media | `wpcom-media-upload`, `wpcom-mcp-media-list` |
| Theme upload | `wpcom-theme-upload-request`, then `wpcom-theme-upload`, then `wpcom-switch-theme`. Needs hosting features |
| Plugins | `wpcom-plugin-upload-request`, `wpcom-plugin-upload`, `wpcom-plugin-activate` |
| Code access | `wpcom-hosting-sftp-ssh-get`, `wpcom-hosting-sftp-user-create`, `wpcom-hosting-ssh-access-update`, `wpcom-code-deployments-create` |
| See the result | `wpcom-rendered-page-get`, `wpcom-site-screenshot-link` |
| Guides | `docs` with topics `create-content` and `edit-content`. Load the matching guide before creating or changing a page |

Do not use on this site: `wpcom-manage-site` with the launch action, `wpcom-site-delete`, `wpcom-site-reset`, `wpcom-site-address-update`, any domain tool, or `wpcom-checkout-url`.

## The Static Importer

`wpcom-static-site-import` turns finished HTML into a block-based site. Its own contract says:

- It builds onto a private *preview* site in the account. Its `blog_id` input accepts "any of the user's preview sites", and "not a simple blog or any other site". This site was made in the WordPress.com dashboard, so expect the importer to refuse it as a target and create its own preview with a random address.
- An import replaces everything on the preview it targets.
- A preview is deleted 30 days after its last edit, and launching one requires choosing a plan.

If Zach asks for a quick look, import `source/nextjs/public/` into a fresh preview and compare. Tell him the address it created. Do not treat the result as the deliverable.

## Coming Soon Replaces the Gate

The Vercel preview had a password gate and a `noindex` header. Here, Coming Soon mode does that job: signed-out visitors get a Coming Soon page and site members see the real site. Confirm what a signed-out visitor and a crawler actually receive (status code, robots directives) before telling anyone the site is hidden, and decide how the theme's staging flag should follow that mode.
