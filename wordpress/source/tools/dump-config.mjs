// Dump the Next.js app's registries to JSON. Usage: node dump-config.mjs <repo> <outdir>
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const [repo, out] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(join(repo, p)).href);
const seo = await imp('lib/seo.mjs');
const chrome = await imp('lib/chrome.mjs');
const site = await imp('lib/site.mjs');
const legacy = await imp('lib/legacy-post-paths.mjs');
const cfg = (await imp('next.config.mjs')).default;
const redirects = await cfg.redirects();
const data = {
  site: { LAUNCHED: site.LAUNCHED, SITE_URL: site.SITE_URL, SITE_NAME: site.SITE_NAME, THEME_COLOR: site.THEME_COLOR, ORG: site.ORG },
  pages: seo.PAGES, notFound: seo.NOT_FOUND, ogImages: seo.OG_IMAGES,
  nav: chrome.NAV_ITEMS, knownPageIds: [...chrome.KNOWN_PAGE_IDS], helpBarPages: [...chrome.HELP_BAR_PAGES],
  legacyPostPaths: legacy.LEGACY_POST_PATHS,
  redirects,
  jsonLd: Object.fromEntries(seo.PAGES.map((p) => [p.url, seo.jsonLdFor(p)])),
};
writeFileSync(join(out, 'config.json'), JSON.stringify(data, null, 2));
console.log('pages', data.pages.length, 'redirect rules', redirects.length, 'legacy posts', data.legacyPostPaths.length);
