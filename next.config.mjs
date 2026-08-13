import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_POST_PATHS } from './lib/legacy-post-paths.mjs';

/* ===========================================================================
 * Equality Ohio: Next.js configuration.
 *
 * Same platform pattern as the JCG nonprofit stack: every page ships as
 * static HTML under public/, and clean URLs are generated here by walking
 * public/ for .html files. The rewrites are afterFiles, so the day a page
 * becomes a real app/<path>/page.js the real route wins with no change here.
 *
 * The redirects section also carries the FULL legacy URL map for
 * equalityohio.org: every URL in the live WordPress sitemaps (captured
 * 2026-08-13) either keeps its path in the redesign or 301s to its
 * replacement. See docs/site-map.md for the page-by-page mapping.
 * ======================================================================== */

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public');

/** Absolute paths of every .html file under public/. */
function htmlFiles(dir = PUBLIC_DIR, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) htmlFiles(full, found);
    else if (entry.endsWith('.html')) found.push(full);
  }
  return found;
}

/**
 * Map a file to the URL it must answer on.
 *   public/index.html               -> /
 *   public/about.html               -> /about
 *   public/legal-clinic/intake.html -> /legal-clinic/intake
 */
function urlPathFor(file) {
  return '/' + relative(PUBLIC_DIR, file).split(sep).join('/');
}

function cleanUrlFor(file) {
  const path = urlPathFor(file);
  if (path.endsWith('/index.html')) return path.slice(0, -'/index.html'.length) || '/';
  return path.slice(0, -'.html'.length);
}

// 404.html is served by app/not-found.js, not by a rewrite, so it must not
// claim the /404 URL.
const pages = htmlFiles()
  .map((file) => ({ file: urlPathFor(file), url: cleanUrlFor(file) }))
  .filter((p) => p.url !== '/404');

const nextConfig = {
  trailingSlash: false,
  reactStrictMode: true,

  async redirects() {
    return [
      // Requesting the file directly lands on the canonical clean URL.
      ...pages.map((p) => ({ source: p.file, destination: p.url, permanent: true })),

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
      { source: '/about/staff-interns/:slug', destination: '/about/staff-interns', permanent: true },

      // Jobs.
      { source: '/job-opening', destination: '/about/jobs-internships', permanent: true },
      { source: '/job-opening/:slug*', destination: '/about/jobs-internships', permanent: true },
      { source: '/single-jobs-internships-template', destination: '/about/jobs-internships', permanent: true },

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
      { source: '/news-template', destination: '/news', permanent: true },
      { source: '/news-template-2', destination: '/news', permanent: true },
      { source: '/news/news-template', destination: '/news', permanent: true },
      { source: '/thankyou', destination: '/', permanent: true },

      // News categories and every legacy post URL land on News & Policy.
      // Old posts are not ported; lib/legacy-post-paths.mjs is generated
      // from the live post sitemap (see its header for regeneration notes).
      { source: '/category/:slug*', destination: '/news', permanent: true },
      ...LEGACY_POST_PATHS.map((path) => ({ source: path, destination: '/news', permanent: true })),

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
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // STAGING: the whole deployment stays out of search indexes until
          // launch. Remove this header (and the gate middleware) to go live.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/assets/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:dir(css|js)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=600, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
