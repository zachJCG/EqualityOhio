/* App Router 404 — mirrors public/404.html so unmatched URLs get the branded
 * page instead of Next's default. The static file remains the reference; keep
 * the two in sync. */
export default function NotFound() {
  return (
    <main id="main">
      <section className="hero hero--interior">
        <div className="container center" style={{ padding: '3rem 1.5rem' }}>
          <div
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
  );
}
