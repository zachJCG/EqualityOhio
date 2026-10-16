/* ==========================================================================
   EQUALITY OHIO: site behaviors.
   The header, footer and preview ribbon are no longer injected here: they
   are prerendered into every page by scripts/build-pages.mjs from
   lib/chrome.mjs (and server-rendered on the App Router 404), so they exist
   without JavaScript. This file only wires behavior onto that markup:
     - mobile nav toggle
     - submenu toggles
     - scroll reveal
     - mock forms (design preview only: forms marked data-mock="true" do not
       transmit anything, they render a success state for design review)
   ========================================================================== */
(function () {
  'use strict';

  function init() {
    if (window.__eoSiteInit) return; // loaded twice: wire listeners once
    window.__eoSiteInit = true;

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

    /* Scroll-reveal: sections and cards rise in as they enter the viewport.
       Motion-safe only; the CSS no-ops without the reveal classes anyway. */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      var targets = document.querySelectorAll('main .section, main .band, main .card-grid > .card');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
      targets.forEach(function (el) {
        el.classList.add('reveal');
        io.observe(el);
      });
    }

    /* Mock form handling: design preview only, nothing is transmitted */
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
  }

  /* The static pages load this with defer, so the DOM is parsed already; a
     page that loads it later (e.g. after DOMContentLoaded) still initializes. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
