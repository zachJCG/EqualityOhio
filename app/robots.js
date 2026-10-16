/* /robots.txt, generated (replaces the hand-written public/robots.txt, which
 * would shadow this route and had to be edited by hand at launch).
 *
 * Until launch, and on every non-production deployment after it, the whole
 * site is disallowed. A launched production build allows everything but the
 * API and points crawlers at the sitemap. The pages themselves also carry
 * robots metas (lib/seo.mjs) and every response an X-Robots-Tag
 * (next.config.mjs), from the same switch.
 */
import { SITE_URL, indexingAllowed } from '../lib/seo.mjs';

export default function robots() {
  if (!indexingAllowed()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
