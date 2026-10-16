/* /manifest.webmanifest. Icons come from scripts/art/generate-assets.mjs;
 * theme_color mirrors --eo-purple (public/css/eo-brand-tokens.css) through
 * lib/site.mjs, because a manifest cannot read CSS variables. */
import { MANIFEST_ICONS, SITE_NAME, THEME_COLOR, pageFor } from '../lib/seo.mjs';

export default function manifest() {
  return {
    name: SITE_NAME,
    short_name: 'Equality Ohio',
    description: pageFor('/').description,
    start_url: '/',
    display: 'standalone',
    theme_color: THEME_COLOR,
    background_color: '#FFFFFF',
    icons: MANIFEST_ICONS,
  };
}
