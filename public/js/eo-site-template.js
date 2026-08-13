/* ==========================================================================
   EQUALITY OHIO — Site Template (Migration draft)
   Shared header/footer injection + small behaviors. Pattern ported from the
   JCG nonprofit platform: every page carries
   <div data-site-header></div> / <div data-site-footer></div> placeholders
   and declares itself via <body data-page="...">.
   Nav is two-level: top sections with dropdown panels (hover/focus on
   desktop, tap-to-expand on mobile).
   NOTE (staging): forms marked data-mock="true" do not transmit anything —
   they render a success state for design review only.
   ========================================================================== */
(function () {
  'use strict';

  /* -- Brand marks -------------------------------------------------------- */
  var LOGO_BARS =
    '<svg class="brand-lockup__mark" viewBox="0 0 360 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<rect x="20" y="10" width="22" height="120" fill="#9FCF67"/>' +
    '<rect x="52" y="10" width="22" height="120" fill="#9FCF67"/>' +
    '<rect x="120" y="22" width="120" height="32" fill="#5A3F99"/>' +
    '<rect x="120" y="88" width="120" height="32" fill="#5A3F99"/>' +
    '<rect x="288" y="10" width="22" height="120" fill="#0093D0"/>' +
    '<rect x="320" y="10" width="22" height="120" fill="#0093D0"/>' +
    '</svg>';

  var LOGO_BARS_WHITE = LOGO_BARS.replace(/#9FCF67|#5A3F99|#0093D0/g, '#ffffff');

  /* GuideStar Silver Transparency 2021 badge — SVG stand-in drawn from the
     official badge; swap for EO's official asset file at content migration. */
  var GUIDESTAR_BADGE =
    '<svg viewBox="0 0 120 120" role="img" aria-label="GuideStar Silver Transparency 2021" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><path id="gs-arc" d="M 60 112 A 52 52 0 1 1 60.01 112"/></defs>' +
    '<circle cx="60" cy="60" r="58" fill="#ffffff" stroke="#b9b9b9" stroke-width="2"/>' +
    '<circle cx="60" cy="60" r="30" fill="#a5a5a5"/>' +
    '<path fill="#ffffff" d="M60 30 L65 52 L82 38 L70 57 L92 60 L70 64 L80 84 L64 68 L60 92 L55 68 L40 82 L50 62 L28 58 L51 55 L44 36 L58 51 Z"/>' +
    '<text font-family="Open Sans, Arial, sans-serif" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="#6d6d6d">' +
    '<textPath href="#gs-arc" startOffset="8%">GUIDESTAR SILVER TRANSPARENCY</textPath></text>' +
    '<text x="60" y="106" text-anchor="middle" font-family="Open Sans, Arial, sans-serif" font-size="12" font-weight="700" fill="#6d6d6d">2021</text>' +
    '</svg>';

  /* -- Navigation model ----------------------------------------------------
     `page` matches <body data-page="...">. A section header is marked
     current when its own page or any child's page matches.               */
  var NAV_ITEMS = [
    {
      label: 'Legal Clinic', href: '/legal-clinic', page: 'legal-clinic',
      children: [
        { href: '/legal-clinic',                              page: 'legal-clinic',          label: 'About the Clinic' },
        { href: '/legal-clinic/intake',                       page: 'legal-clinic-intake',   label: 'Start an Intake' },
        { href: '/legal-clinic/ohio-lgbtq-family-law-guide',  page: 'family-law-guide',      label: 'Ohio LGBTQ+ Family Law Guide' },
        { href: '/legal-clinic/trans-know-your-rights',       page: 'trans-know-your-rights', label: 'Trans Know Your Rights' },
        { href: '/legal-clinic/legal-network',                page: 'legal-network',         label: 'Legal Network for Attorneys' }
      ]
    },
    {
      label: 'Our Work', href: '/our-work', page: 'our-work',
      children: [
        { href: '/our-work',                     page: 'our-work',       label: 'What We Do' },
        { href: '/our-work/local',               page: 'our-work-local', label: 'Local Progress' },
        { href: '/our-work/local/municipal-map', page: 'municipal-map',  label: 'Municipal Equality Map' },
        { href: '/our-work/business',            page: 'business',       label: 'Business Engagement' },
        { href: '/our-work/legacy-of-equality',  page: 'legacy',         label: 'Legacy of Equality' },
        { href: '/votersguide',                  page: 'votersguide',    label: 'Voters Guide' }
      ]
    },
    {
      label: 'Get Involved', href: '/get-involved', page: 'get-involved',
      children: [
        { href: '/get-involved',           page: 'get-involved', label: 'Ways to Get Involved' },
        { href: '/get-involved/volunteer', page: 'volunteer',    label: 'Volunteer' },
        { href: '/get-involved/events',    page: 'events',       label: 'Events' },
        { href: '/stories',                page: 'stories',      label: 'Share Your Story' },
        { href: '/newsletter',             page: 'newsletter',   label: 'Newsletter' }
      ]
    },
    {
      label: 'About', href: '/about', page: 'about',
      children: [
        { href: '/about',                  page: 'about',      label: 'Mission & Values' },
        { href: '/about/history',          page: 'history',    label: 'Our History' },
        { href: '/about/leadership',       page: 'leadership', label: 'Board of Directors' },
        { href: '/about/staff-interns',    page: 'staff',      label: 'Staff & Interns' },
        { href: '/about/jobs-internships', page: 'jobs',       label: 'Jobs & Internships' },
        { href: '/contact',                page: 'contact',    label: 'Contact' }
      ]
    },
    { label: 'News & Policy', href: '/news', page: 'news' }
  ];

  var CARET =
    '<svg width="10" height="7" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M1 1.5 L5 5.5 L9 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>';

  function isCurrent(item, page) {
    if (item.page === page) return true;
    return (item.children || []).some(function (c) { return c.page === page; });
  }

  function headerHTML(current) {
    var links = NAV_ITEMS.map(function (item) {
      var sectionCurrent = isCurrent(item, current);
      var topCur = sectionCurrent ? ' aria-current="' + (item.page === current ? 'page' : 'true') + '"' : '';
      if (!item.children) {
        return '<li><a href="' + item.href + '"' + topCur + '>' + item.label + '</a></li>';
      }
      var sub = item.children.map(function (c) {
        var cur = c.page === current ? ' aria-current="page"' : '';
        return '<li><a href="' + c.href + '"' + cur + '>' + c.label + '</a></li>';
      }).join('');
      var subId = 'sub-' + item.page;
      return (
        '<li class="has-sub">' +
          '<div class="nav-item-row">' +
            '<a href="' + item.href + '"' + topCur + '>' + item.label + '</a>' +
            '<button class="sub-toggle" aria-expanded="false" aria-controls="' + subId + '" aria-label="Open ' + item.label + ' menu">' + CARET + '</button>' +
          '</div>' +
          '<ul class="sub-menu" id="' + subId + '">' + sub + '</ul>' +
        '</li>'
      );
    }).join('');
    return (
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<div class="preview-ribbon">Design preview — <strong>staging only</strong>, forms and donations are not live · Prepared by Joseph Carter Group</div>' +
      '<div class="equality-bar" aria-hidden="true"></div>' +
      '<header class="site-header">' +
        '<div class="nav-inner">' +
          '<a class="brand-lockup" href="/" aria-label="Equality Ohio home">' +
            LOGO_BARS +
            '<span class="brand-lockup__word">EQUALITY OHIO</span>' +
          '</a>' +
          '<button class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">' +
            '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
              '<rect width="22" height="2.5" rx="1.25" fill="currentColor"/>' +
              '<rect y="6.75" width="22" height="2.5" rx="1.25" fill="currentColor"/>' +
              '<rect y="13.5" width="22" height="2.5" rx="1.25" fill="currentColor"/>' +
            '</svg>' +
          '</button>' +
          '<nav class="site-nav" id="site-nav" aria-label="Primary">' +
            '<ul>' + links +
              '<li class="nav-cta"><a href="/give"' + (current === 'give' ? ' aria-current="page"' : '') + '>Donate</a></li>' +
            '</ul>' +
          '</nav>' +
        '</div>' +
      '</header>'
    );
  }

  /* -- Footer ------------------------------------------------------------- */
  function footerHTML() {
    return (
      '<footer class="site-footer">' +
        '<div class="equality-bar" aria-hidden="true"></div>' +
        '<div class="footer-main">' +
          '<div class="footer-brand">' +
            '<a class="brand-lockup" href="/" aria-label="Equality Ohio home">' +
              LOGO_BARS_WHITE +
              '<span class="brand-lockup__word">EQUALITY OHIO</span>' +
            '</a>' +
            '<p class="mt-1">Ohio’s statewide LGBTQ+ advocacy and legal aid organization — working toward an Ohio where justice, dignity, and self-determination belong to everyone.</p>' +
            '<ul class="footer-contact">' +
              '<li><a href="tel:16142240400">(614) 224-0400</a></li>' +
              '<li><a href="mailto:info@equalityohio.org">info@equalityohio.org</a></li>' +
              '<li><a href="https://twitter.com/equalityohio" rel="noopener">@equalityohio</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h4>Legal Clinic</h4>' +
            '<ul>' +
              '<li><a href="/legal-clinic">About the Clinic</a></li>' +
              '<li><a href="/legal-clinic/intake">Start an Intake</a></li>' +
              '<li><a href="/legal-clinic/ohio-lgbtq-family-law-guide">Family Law Guide</a></li>' +
              '<li><a href="/legal-clinic/trans-know-your-rights">Trans Know Your Rights</a></li>' +
              '<li><a href="/legal-clinic/legal-network">Legal Network</a></li>' +
              '<li><a href="tel:18555428529">855-LGBT-LAW</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h4>Our Work</h4>' +
            '<ul>' +
              '<li><a href="/our-work">What We Do</a></li>' +
              '<li><a href="/our-work/local">Local Progress</a></li>' +
              '<li><a href="/our-work/local/municipal-map">Municipal Equality Map</a></li>' +
              '<li><a href="/our-work/business">Business Engagement</a></li>' +
              '<li><a href="/our-work/legacy-of-equality">Legacy of Equality</a></li>' +
              '<li><a href="/votersguide">Voters Guide</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h4>Get Involved</h4>' +
            '<ul>' +
              '<li><a href="/give">Ways to Give</a></li>' +
              '<li><a href="/give#defenders">Defenders of Equality</a></li>' +
              '<li><a href="/jim-obergefell-john-arthur-society">Obergefell–Arthur Society</a></li>' +
              '<li><a href="/get-involved/volunteer">Volunteer</a></li>' +
              '<li><a href="/get-involved/events">Events</a></li>' +
              '<li><a href="/newsletter">Newsletter</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h4>About</h4>' +
            '<ul>' +
              '<li><a href="/about">Mission & Values</a></li>' +
              '<li><a href="/about/history">Our History</a></li>' +
              '<li><a href="/about/leadership">Board of Directors</a></li>' +
              '<li><a href="/about/staff-interns">Staff & Interns</a></li>' +
              '<li><a href="/about/jobs-internships">Jobs & Internships</a></li>' +
              '<li><a href="/news">News & Policy</a></li>' +
              '<li><a href="/contact">Contact</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="footer-legal">' +
          '<div class="footer-legal__inner">' +
            '<span class="footer-badge">' + GUIDESTAR_BADGE +
              '<span>Equality Ohio Education Fund is a 501(c)(3) — EIN 02-0743268 · Equality Ohio is a 501(c)(4) — EIN 02-0743270</span>' +
            '</span>' +
            '<span>© <span data-year>2026</span> Equality Ohio · <a href="#">Privacy Policy</a> · Design preview by Joseph Carter Group</span>' +
          '</div>' +
        '</div>' +
      '</footer>'
    );
  }

  /* -- Mount -------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page') || '';

    var headerMount = document.querySelector('[data-site-header]');
    if (headerMount) headerMount.innerHTML = headerHTML(page);

    var footerMount = document.querySelector('[data-site-footer]');
    if (footerMount) footerMount.innerHTML = footerHTML();

    var year = document.querySelector('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());

    /* Mobile nav toggle */
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    /* Submenu toggles (mobile tap; harmless on desktop where hover rules) */
    document.querySelectorAll('.sub-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var li = btn.closest('.has-sub');
        var open = li.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    /* Mock form handling — design preview only, nothing is transmitted */
    document.querySelectorAll('form[data-mock="true"]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var success = form.parentElement.querySelector('.form-success') ||
                      document.getElementById(form.getAttribute('data-success') || '');
        if (success) {
          success.classList.add('show');
          success.setAttribute('tabindex', '-1');
          success.focus({ preventScroll: false });
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        form.querySelectorAll('button[type="submit"]').forEach(function (b) {
          b.disabled = true;
          b.textContent = 'Submitted (preview)';
        });
      });
    });
  });
})();
