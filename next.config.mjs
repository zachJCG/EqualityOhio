import { LEGACY_POST_PATHS } from './lib/legacy-post-paths.mjs';
import { LAUNCHED } from './lib/site.mjs';
import { staticPages } from './lib/static-pages.mjs';

/* ===========================================================================
 * Equality Ohio: Next.js configuration.
 *
 * Same platform pattern as the JCG nonprofit stack: every page ships as
 * static HTML under public/, and clean URLs are generated here from
 * lib/static-pages.mjs (one walk of public/ shared with the page generator,
 * the sitemap and the tests). The rewrites are afterFiles, so the day a page
 * becomes a real app/<path>/page.js the real route wins with no change here.
 *
 * The redirects section also carries the FULL legacy URL map for
 * equalityohio.org: every URL in the live WordPress sitemaps (captured
 * 2026-08-13, re-checked 2026-10-16 against docs/legacy-sitemap-urls.txt by
 * `npm run check:redirects`) either keeps its path in the redesign or
 * redirects to its replacement. See docs/site-map.md for the page-by-page
 * mapping.
 * ======================================================================== */

/** Every public/**\/*.html as { file: '/about.html', url: '/about' }. */
const pages = staticPages();

/* Porting a page to the App Router: delete public/<path>.html, add its clean
 * URL here (so old /<path>.html and /<path>/index.html links still land),
 * and move its lib/seo.mjs entry to the route's own `metadata` export. The
 * generated .html redirect below disappears with the file; this keeps it. */
const PORTED = [];

/* ---------------------------------------------------------------------------
 * Indexing. X-Robots-Tag goes on every response until launch, and on every
 * non-production Vercel deployment (previews, local builds) after it, so a
 * preview URL can never be indexed. Read at build time.
 * ------------------------------------------------------------------------- */
const sendNoindex = !LAUNCHED || process.env.VERCEL_ENV !== 'production';

/* ---------------------------------------------------------------------------
 * Content-Security-Policy, ported from the MVFHC builder (next.config.ts).
 * Audited 2026-10-16: the static pages load only same-origin CSS, JS, fonts
 * and images (plus data: images); there are no iframes, no third-party
 * scripts and no inline executable scripts (scripts/build-pages.mjs --check
 * fails on one). So:
 *
 *   strict   (every static page URL) script-src 'self'. Nothing inline runs.
 *   baseline (everything else, '/:path*') adds 'unsafe-inline' to script-src
 *            only for Next-rendered routes. The branded 404 (pages/404.js)
 *            needs none today: it is prerendered static HTML that ships
 *            without Next's client runtime. But App Router pages hydrate
 *            through inline RSC payload scripts, so a page ported to app/
 *            would break silently without it. A nonce-based policy is the
 *            tightening follow-up once real app routes exist.
 *
 * style-src keeps 'unsafe-inline' for the inline style attributes in the
 * pages and gate.html's <style> block.
 *
 * Later header rules override earlier ones for the same key, which is how
 * the per-page strict rule replaces the baseline policy.
 *
 * When the later-phase embeds land, extend exactly these directives:
 *   EveryAction / NGP VAN giving and signup forms (secure.everyaction.com,
 *     actions.everyaction.com, *.ngpvan.com): script-src, frame-src,
 *     connect-src, form-action.
 *   Lawmatics intake / legal-network forms (app.lawmatics.com): frame-src,
 *     or script-src + connect-src for the JS embed.
 *   YouTube know-your-rights videos (www.youtube-nocookie.com): frame-src;
 *     img-src i.ytimg.com for thumbnails.
 * Today all of those are plain outbound links, which CSP does not govern.
 * ------------------------------------------------------------------------- */
const isDev = process.env.NODE_ENV === 'development';
// The Vercel toolbar (comments, preview feedback) is allowed only on preview
// deployments so the production policy stays tight.
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

function contentSecurityPolicy({ inlineScripts }) {
  return [
    "default-src 'self'",
    // next dev needs eval (react-refresh); never shipped in production or
    // preview builds, and never on the static pages.
    `script-src 'self'${inlineScripts ? " 'unsafe-inline'" : ''}${inlineScripts && isDev ? " 'unsafe-eval'" : ''}${isVercelPreview ? ' https://vercel.live' : ''}`,
    `style-src 'self' 'unsafe-inline'${isVercelPreview ? ' https://vercel.live' : ''}`,
    `img-src 'self' data:${isVercelPreview ? ' blob: https://vercel.live https://vercel.com' : ''}`,
    `font-src 'self'${isVercelPreview ? ' https://vercel.live https://assets.vercel.com' : ''}`,
    `connect-src 'self'${isVercelPreview ? ' https://vercel.live wss://ws-us3.pusher.com' : ''}`,
    `frame-src ${isVercelPreview ? 'https://vercel.live' : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const BASELINE_CSP = contentSecurityPolicy({ inlineScripts: true });
const STRICT_CSP = contentSecurityPolicy({ inlineScripts: false });

/* Brand art, images and the mirrored PDFs: one day fresh, a week
 * stale-while-revalidate. Not immutable, because placeholder art, the logo and
 * EO's documents are swapped in place. */
const ASSET_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

const nextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,

  async redirects() {
    return [
      // Requesting the file directly lands on the canonical clean URL.
      ...pages.map((p) => ({ source: p.file, destination: p.url, permanent: true })),
      // Pages ported to the App Router keep their old .html spellings.
      ...PORTED.flatMap((url) => [
        { source: `${url}.html`, destination: url, permanent: true },
        { source: `${url}/index.html`, destination: url, permanent: true },
      ]),

      /* -- Legacy equalityohio.org URLs (WordPress) ------------------------
       * Sources cover the no-trailing-slash spelling; trailingSlash: false
       * already 308s the slashed form onto it. */

      // Giving. Old giving URLs and one-off campaign pages all land on the
      // consolidated Ways to Give page (anchors where a specific program
      // had its own URL). Live gift flows stay on EveryAction (NGP).
      { source: '/get-involved/donate', destination: '/give', permanent: true },
      { source: '/get-involved/donate/equality', destination: '/give', permanent: true },
      { source: '/get-involved/donate/donor-advised-funds', destination: '/give#daf', permanent: true },
      { source: '/get-involved/donate/in-kind-donations', destination: '/give#in-kind', permanent: true },
      { source: '/get-involved/make-a-gift', destination: '/give', permanent: true },
      { source: '/donate-one-time', destination: '/give#one-time', permanent: true },
      { source: '/donate-eoef', destination: '/give#society', permanent: true },
      { source: '/donate2022', destination: '/give', permanent: true },

      // Volunteer form variants (old Facebook-campaign landing pages).
      { source: '/volunteerfb', destination: '/get-involved/volunteer', permanent: true },
      { source: '/volunteerfb-thanks', destination: '/get-involved/volunteer', permanent: true },

      // Events. One events page; WordPress had three URLs plus per-event
      // pages (The Events Calendar).
      { source: '/events', destination: '/get-involved/events', permanent: true },
      { source: '/events-2', destination: '/get-involved/events', permanent: true },
      { source: '/our-work/events', destination: '/get-involved/events', permanent: true },
      { source: '/event/:slug*', destination: '/get-involved/events', permanent: true },
      // The Events Calendar's category archives (/events/category/<slug>/)
      // and any other path under /events. Must stay after the exact /events.
      { source: '/events/:path*', destination: '/get-involved/events', permanent: true },
      // Advocates & Allies 2026 event page (live 2026-10-07): the honorees now
      // lead the Legacy of Equality page. Temporary, because the next event
      // may want this short URL back.
      { source: '/aa2026', destination: '/our-work/legacy-of-equality#honorees', permanent: false },

      // People. Profile pages fold into the staff and leadership rosters:
      // staff slugs deep-link to their card (ids on /about/staff-interns
      // match the live profile slugs), board slugs land on the boards page,
      // anything else (e.g. the mike-dewine entry) falls back to staff.
      ...[
        'josh-meeks', 'paul-peters', 'jen-kuhn', 'becca-alexander', 'dwayne-steward',
        'sheena-barnes', 'serah-munroe', 'joseph-soza', 'leandrah-alexis', 'jessi-sadaka',
        'justin-joseph', 'kate-mozynski', 'sol-a-kersey', 'kim-welter-2', 'mary-zaller-2',
      ].map((slug) => ({
        source: `/people/${slug}`,
        destination: `/about/staff-interns#${slug}`,
        permanent: true,
      })),
      ...[
        'julie-posey', 'rini-das', 'randle-moore', 'zach-mccune',
        'patrick-mckelvey-mscp-lpcc-s-ncc-ecmhc-oimhp-iii', 'laraun-clayton-mba-lsw',
        'dominiece-hoelyfield-ms-and-shrm-cp', 'eileen-galvin', 'shelly-riggs',
        'brandon-west', 'heidi-bostelman', 'tamara-lunan', 'kevin-mcgruder',
        'kathy-bowman', 'tim-johnson', 'tayo-clyburn-ph-d', 'levent-talgar',
        'mary-lynn-readey',
      ].map((slug) => ({
        source: `/people/${slug}`,
        destination: '/about/leadership',
        permanent: true,
      })),
      { source: '/people', destination: '/about/staff-interns', permanent: true },
      { source: '/people/:slug*', destination: '/about/staff-interns', permanent: true },
      // People taxonomy archives (people-category-sitemap.xml): the two board
      // categories land on the boards page, the rest (staff-interns,
      // statewide-candidates, cle-instructor) on the staff roster.
      { source: '/people-category/equality-ohio-education-fund-board', destination: '/about/leadership', permanent: true },
      { source: '/people-category/equality-ohio-board', destination: '/about/leadership', permanent: true },
      { source: '/people-category/:slug*', destination: '/about/staff-interns', permanent: true },
      { source: '/about/staff-interns/:slug', destination: '/about/staff-interns', permanent: true },

      // Jobs.
      { source: '/job-opening', destination: '/about/jobs-internships', permanent: true },
      { source: '/job-opening/:slug*', destination: '/about/jobs-internships', permanent: true },
      { source: '/single-jobs-internships-template', destination: '/about/jobs-internships', permanent: true },
      // Job taxonomy archives (job-category-sitemap.xml, e.g. /job-category/externship/).
      { source: '/job-category/:slug*', destination: '/about/jobs-internships', permanent: true },

      // Newsletter signup (long WordPress slug).
      { source: '/sign-up-for-the-latest-news-from-equality-ohio', destination: '/newsletter', permanent: true },

      // Legal Clinic intake thank-you (long WordPress slug).
      {
        source: '/thank-you-for-submitting-your-intake-request-to-the-equality-ohio-legal-clinic',
        destination: '/legal-clinic/intake/thank-you',
        permanent: true,
      },

      // HB 68 action hub: the bill became law in 2024; the durable resource
      // is the Trans Know Your Rights guide.
      { source: '/get-involved/hb68', destination: '/legal-clinic/trans-know-your-rights', permanent: true },

      // Ohio Business Competes has its own section on the business page.
      { source: '/our-work/business/ohio-business-competes', destination: '/our-work/business#ohio-business-competes', permanent: true },

      // Affirming-congregations directory (worship database): data-driven
      // directory returns in the Supabase phase; until then the Our Work
      // faith section is the landing.
      { source: '/worship-database', destination: '/our-work#faith', permanent: false },
      { source: '/worship-database/:slug*', destination: '/our-work#faith', permanent: false },
      // Live-site quirk: /our-work/faith 301s into a worship-database entry.
      { source: '/our-work/faith', destination: '/our-work#faith', permanent: false },

      // Municipal map per-city pages: fold into the map page until the
      // interactive map returns in the Supabase phase.
      { source: '/municipal-map', destination: '/our-work/local/municipal-map', permanent: false },
      { source: '/municipal-map/:slug*', destination: '/our-work/local/municipal-map', permanent: false },

      // Board governance forms live with the board page.
      { source: '/conflict-of-interest-forms', destination: '/about/leadership#governance', permanent: true },

      // WordPress template/scratch pages that were public but never real.
      // (/news/news-template is a post in the post sitemap, so it is covered
      // by LEGACY_POST_PATHS below rather than repeated here.)
      { source: '/news-template', destination: '/news', permanent: true },
      { source: '/news-template-2', destination: '/news', permanent: true },
      { source: '/thankyou', destination: '/', permanent: true },

      // News categories and every legacy post URL land on News & Policy.
      // Old posts are not ported; lib/legacy-post-paths.mjs is generated
      // from the live post sitemap (see its header for regeneration notes).
      { source: '/category/:slug*', destination: '/news', permanent: true },
      { source: '/tag/:slug*', destination: '/news', permanent: true },
      ...LEGACY_POST_PATHS.map((path) => ({ source: path, destination: '/news', permanent: true })),

      // WordPress media the pages used to link, now hosted in public/assets/docs/
      // (each link carries its source URL in an HTML comment). Exact paths, so
      // old links and EO's bit.ly short links keep resolving after launch.
      // Not mirrored: the 2025 Trans Know Your Rights PDF (live withdrew it
      // on 2026-08-20) and the 25 MB Family Law Guide (over the deployment's
      // per-file limit; EO keeps hosting it). Re-pull the files at launch.
      ...[
        '/wp-content/uploads/2026/06/EQ_Candidate-Scorecard_September-Edits_9-18-v2.pdf',
        '/wp-content/uploads/2023/02/EOEF-Organizational-Financial-Conflict-of-Interest-combined.pdf',
        '/wp-content/uploads/2024/11/Privacy-Policy-November-2024.pdf',
      ].map((source) => ({
        source,
        destination: `/assets/docs/${source.split('/').pop()}`,
        permanent: true,
      })),

      // Old flat mockup filenames from design review round 1.
      { source: '/board', destination: '/about/leadership', permanent: true },
      { source: '/legal-clinic-intake', destination: '/legal-clinic/intake', permanent: true },
    ];
  },

  async rewrites() {
    return {
      // afterFiles: real routes and real files win first; these keep the
      // not-yet-ported static pages reachable on their clean URLs.
      afterFiles: pages.map((p) => ({ source: p.url, destination: p.file })),
    };
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: BASELINE_CSP },
          // Belt and braces with frame-ancestors 'none' for older browsers.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          ...(sendNoindex ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] : []),
        ],
      },
      // Every static page: no inline script may run (overrides the baseline).
      ...pages.map((p) => ({
        source: p.url,
        headers: [{ key: 'Content-Security-Policy', value: STRICT_CSP }],
      })),
      {
        source: '/assets/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/assets/:dir(img|logo|brand|og|textures|docs)/:path*',
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      },
      {
        source: '/:file(favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png)',
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      },
      {
        source: '/:dir(css|js)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=600, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
