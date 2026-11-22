/* /sitemap.xml: every indexable static page as an absolute
 * https://equalityohio.org URL.
 *
 * The page list is the walk of public/ (lib/static-pages.mjs, the same one
 * next.config.mjs and the generator use); priority, change frequency and
 * noindex come from the registry in lib/seo.mjs. Pages marked noindex there
 * (the gate, the intake thank-you page) are left out, so the sitemap and the
 * robots metas cannot contradict each other. `npm run check:pages` fails when
 * a page has no registry entry.
 *
 * Served while staging too (it is an open path in the gate) so the URL list
 * can be reviewed before launch; robots.txt does not point at it until then.
 * Prerendered at build time.
 */
import { absolute, pageFor } from '../lib/seo.mjs';
import { staticPages } from '../lib/static-pages.mjs';

export default function sitemap() {
  return staticPages()
    .map(({ url }) => pageFor(url) || { url })
    .filter((page) => !page.noindex)
    .map((page) => ({
      url: absolute(page.url),
      changeFrequency: page.changefreq || 'monthly',
      priority: page.priority ?? 0.5,
    }));
}
