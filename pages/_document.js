/* Document for the Pages Router, which today renders exactly one page: the
 * branded 404 (pages/404.js). Everything else is static HTML under public/
 * or an App Router route handler (api/gate, robots, sitemap, manifest).
 *
 * The head mirrors the generated head of the static pages from the same
 * registry (lib/seo.mjs): font preloads, the three stylesheets in order,
 * icons, manifest and theme color. The page-specific tags (title,
 * description, robots, viewport) are in pages/404.js.
 */
import { Head, Html, Main, NextScript } from 'next/document';
import { FONT_PRELOADS, ICONS, STYLESHEETS, THEME_COLOR } from '../lib/seo.mjs';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {FONT_PRELOADS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        {STYLESHEETS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <link rel="icon" href={ICONS.ico} sizes="32x32" />
        <link rel="icon" href={ICONS.svg} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={ICONS.appleTouch} />
        <link rel="manifest" href={ICONS.manifest} />
        <meta name="theme-color" content={THEME_COLOR} />
        {/* Nav toggles and submenus; the same file every static page loads. */}
        <script src="/js/eo-site-template.js" defer />
      </Head>
      <body data-page="not-found">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
