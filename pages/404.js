/* The branded 404, served with HTTP 404 for every unmatched URL.
 *
 * Why the Pages Router: with no App Router page routes, `next build` only
 * ever emits the Pages Router /404, so app/not-found.js was never compiled
 * and unknown URLs got Next's unbranded default (no lang, no landmarks).
 * pages/404.js is prerendered to static HTML at build time and logs nothing
 * per request. (The App Router alternative, a dynamicParams = false
 * catch-all, works but logs an "Internal: NoFallbackError" error line for
 * every 404, and its hydration needs inline scripts.)
 *
 * unstable_runtimeJS: false ships the page without Next's client runtime:
 * nothing here needs React in the browser (the nav behaviors come from
 * /js/eo-site-template.js, as on every static page), and without it the page
 * has no inline script at all and the Pages Router does not fire a
 * /_next/data/... request (which 404s) on load because middleware exists.
 *
 * The header and footer are the same markup the static pages get from
 * scripts/build-pages.mjs (lib/chrome.mjs is the single source), rendered at
 * build time in getStaticProps so the footer year is the build year. React
 * needs an element to hold raw HTML, so each block sits in a display:
 * contents wrapper: the wrapper generates no box, so the skip link, ribbon
 * and sticky .site-header lay out exactly as on the static pages.
 *
 * Title, description and robots come from NOT_FOUND in lib/seo.mjs; the rest
 * of the head is in pages/_document.js. Replaces public/404.html, which was
 * never actually served.
 *
 * Porting pages to the App Router later: once app/ has a page route and a
 * root layout, re-check which 404 Next serves for unmatched URLs and give
 * app/not-found.js this same chrome if it takes over.
 */
import Head from 'next/head';
import { footerHTML, headerHTML } from '../lib/chrome.mjs';
import { NOT_FOUND, robotsContent } from '../lib/seo.mjs';

export function getStaticProps() {
  return { props: { header: headerHTML('not-found'), footer: footerHTML() } };
}

export const config = { unstable_runtimeJS: false };

const contents = { display: 'contents' };

export default function NotFound({ header, footer }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{NOT_FOUND.title}</title>
        <meta name="description" content={NOT_FOUND.description} />
        <meta name="robots" content={robotsContent(NOT_FOUND)} />
      </Head>
      <div data-chrome="header" style={contents} dangerouslySetInnerHTML={{ __html: header }} />
      <main id="main">
        <section className="hero hero--interior">
          <div className="container center" style={{ padding: '3rem 1.5rem' }}>
            <div
              aria-hidden="true"
              style={{
                fontFamily: 'var(--eo-font-display)',
                fontWeight: 800,
                fontSize: '5rem',
                lineHeight: 1,
                color: 'var(--eo-purple)',
              }}
            >
              4=4
            </div>
            <h1 style={{ marginTop: '0.6rem' }}>This page isn&rsquo;t part of the preview yet.</h1>
            <p className="hero__lede" style={{ maxWidth: '34em', margin: '0 auto' }}>
              The full production build covers every page in the sitemap. For now, head somewhere
              that exists:
            </p>
            <div className="hero__ctas" style={{ justifyContent: 'center' }}>
              <a className="btn btn--primary" href="/">Home</a>
              <a className="btn btn--outline" href="/legal-clinic">Legal Clinic</a>
              <a className="btn btn--gold" href="/give">Donate</a>
            </div>
          </div>
        </section>
      </main>
      <div data-chrome="footer" style={contents} dangerouslySetInnerHTML={{ __html: footer }} />
    </>
  );
}
