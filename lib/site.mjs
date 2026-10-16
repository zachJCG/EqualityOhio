/* =============================================================================
 * lib/site.mjs: the launch switch and the organization facts.
 *
 * LAUNCHED is the ONE switch between the password-gated design preview and
 * the public site. Everything that differs between the two reads it:
 *
 *   scripts/build-pages.mjs  robots meta, canonical, og:site_name, the preview
 *                            ribbon and the footer credit line
 *   middleware.js            the staging gate (a pass-through once launched)
 *   next.config.mjs          X-Robots-Tag (also kept on every non-production
 *                            Vercel deployment after launch)
 *   app/robots.js            Disallow: / while staging
 *
 * Static HTML cannot read env at request time, so flipping this needs a
 * rebuild of the pages: set LAUNCHED = true, run `npm run pages:build`,
 * commit the regenerated pages, then deploy.
 *
 * ORG holds only facts already printed on the site (footer, /contact). Never
 * add a fact here that the site does not already state. The social channels
 * are the live equalityohio.org Organization JSON-LD sameAs list (checked
 * 2026-10-16; twitter.com/equalityohio now 301s to x.com) and are printed in
 * the footer and on /contact; they also feed the JSON-LD sameAs here.
 * ========================================================================== */

export const LAUNCHED = false;

/* The canonical origin. The live site canonicalizes to the apex (www 301s to
 * it), so every absolute URL the build emits uses the apex too. */
export const SITE_URL = 'https://equalityohio.org';
export const SITE_NAME = 'Equality Ohio';

/* Brand purple (--eo-purple in public/css/eo-brand-tokens.css). Mirrored
 * here because <meta name="theme-color"> and the web manifest cannot read
 * CSS variables. */
export const THEME_COLOR = '#5A3F99';

export const ORG = {
  phone: { display: '(614) 224-0400', tel: '+16142240400' },
  clinicPhone: { display: '855-LGBT-LAW', tel: '+18555428529' },
  email: 'info@equalityohio.org',
  handle: '@equalityohio',
  socials: [
    { label: 'X', handle: '@equalityohio', url: 'https://x.com/equalityohio' },
    { label: 'Facebook', url: 'https://www.facebook.com/equalityohio' },
    { label: 'Instagram', handle: '@equality.ohio', url: 'https://www.instagram.com/equality.ohio/' },
    { label: 'YouTube', url: 'https://www.youtube.com/channel/UCxKjvM_REomRkFAacq7dcwQ' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/company/equalityohio/' },
    { label: 'Threads', handle: '@equality.ohio', url: 'https://www.threads.com/@equality.ohio' },
  ],
  c3: { name: 'Equality Ohio Education Fund', ein: '02-0743268' },
  c4: { name: 'Equality Ohio', ein: '02-0743270' },
};
