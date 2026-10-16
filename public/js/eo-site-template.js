/* ==========================================================================
   EQUALITY OHIO: site behaviors.
   The header, footer, preview ribbon and phone help bar are not injected
   here: they are prerendered into every page by scripts/build-pages.mjs from
   lib/chrome.mjs (and server-rendered on the 404), so they exist without
   JavaScript. This file only wires behavior onto that markup. The static
   pages are served with script-src 'self', so everything a page does lives
   in /js/ files like this one, never inline.

     phone menu      a modal sheet: inert page, scroll lock, focus in and
                     back out, Escape, Tab stays inside, closes on desktop
     dropdowns       desktop disclosures: button or hover opens one at a
                     time, aria-expanded always true to the screen, Escape
                     and outside click close
     help bar        slides away while an on-page clinic callout is on screen
     scroll reveal   below-the-fold blocks rise in (desktop, motion allowed)
     new-tab links   announce that they open a new tab
     mock forms      validation (error summary, inline errors) and the
                     preview success state; nothing is transmitted

   Ported from MVFHC (MobileNav, StickyActionBar, Reveal, the form fields),
   jcg2026 (Header, ScrollReveal) and Ohio Pride (site-template.js nav
   groups, main.js reveal threshold fix).
   ========================================================================== */
(function () {
  'use strict';

  /* Same breakpoint as eo-site.css: the full nav from 901px, the sheet below. */
  var DESKTOP_QUERY = '(min-width: 901px)';
  var root = document.documentElement;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function scrollBehavior() {
    return reducedMotion() ? 'auto' : 'smooth';
  }
  function setInert(el, on) {
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }
  function forEach(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  /* -- Phone help bar ---------------------------------------------------------
   * Prerendered on the Legal Clinic pages (lib/chrome.mjs HELP_BAR_PAGES).
   * While any on-page clinic callout ([data-cta]) is on screen the same two
   * actions are already visible, so the bar slides away; it is inert while
   * hidden and while the phone menu is open, so it never holds focus or
   * reads out from behind something else. */
  function initHelpBar(state) {
    var bar = document.querySelector('.help-bar');
    var api = { el: bar, sync: function () {} };
    if (!bar) return api;

    var visible = [];
    function sync() {
      var hidden = visible.length > 0;
      bar.setAttribute('data-hidden', hidden ? 'true' : 'false');
      setInert(bar, hidden || state.menuOpen);
    }
    api.sync = sync;

    var ctas = document.querySelectorAll('[data-cta]');
    if (ctas.length && 'IntersectionObserver' in window) {
      // First state synchronously, so a callout already on screen at load
      // never shows the bar sliding away.
      forEach(ctas, function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) visible.push(el);
      });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var i = visible.indexOf(entry.target);
          if (entry.isIntersecting && i === -1) visible.push(entry.target);
          if (!entry.isIntersecting && i !== -1) visible.splice(i, 1);
        });
        sync();
      });
      forEach(ctas, function (el) { io.observe(el); });
    }
    sync();
    return api;
  }

  /* -- Phone menu ---------------------------------------------------------------
   * The nav becomes a sheet from the header's bottom edge to the bottom of the
   * viewport. Everything outside the header is inert while it is open, page
   * scroll is locked (body.nav-open), focus moves to the first link and
   * returns to the toggle on Escape. */
  function initPhoneMenu(state, helpBar, closeSubmenus) {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    var header = document.querySelector('.site-header');
    if (!toggle || !nav || !header) return;
    var desktop = window.matchMedia(DESKTOP_QUERY);
    var inerted = [];

    function placeSheet() {
      var bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
      root.style.setProperty('--eo-nav-top', bottom + 'px');
    }

    /* Every element outside the header: the siblings of the header and of
       each of its ancestors up to <body> (the 404 wraps the chrome in a
       display: contents element, so the header is not always a body child). */
    function outsideHeader() {
      var out = [];
      for (var node = header; node && node !== document.body; node = node.parentElement) {
        var parent = node.parentElement;
        if (!parent) break;
        forEach(parent.children, function (sibling) {
          if (sibling === node || sibling === helpBar.el) return;
          if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(sibling.tagName)) return;
          out.push(sibling);
        });
      }
      return out;
    }

    function setOpen(open, returnFocus) {
      if (open === state.menuOpen) return;
      state.menuOpen = open;
      if (open) placeSheet();
      nav.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
      if (open) {
        inerted = outsideHeader().filter(function (el) { return !el.hasAttribute('inert'); });
        inerted.forEach(function (el) { setInert(el, true); });
        var first = nav.querySelector('a[href]');
        if (first) first.focus({ preventScroll: true });
      } else {
        inerted.forEach(function (el) { setInert(el, false); });
        inerted = [];
        if (returnFocus) toggle.focus();
      }
      helpBar.sync();
    }

    toggle.addEventListener('click', function () {
      setOpen(!state.menuOpen, false);
    });

    document.addEventListener('keydown', function (e) {
      if (!state.menuOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false, true);
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep Tab inside the header (logo, toggle, the sheet's links).
      var items = Array.prototype.filter.call(
        header.querySelectorAll('a[href], button:not([disabled])'),
        function (el) { return el.getClientRects().length > 0; }
      );
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;
      var inside = header.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    });

    // A tap on a link (including a same-page anchor) closes the sheet.
    nav.addEventListener('click', function (e) {
      if (state.menuOpen && e.target.closest && e.target.closest('a[href]')) setOpen(false, false);
    });

    function onBreakpoint() {
      closeSubmenus();
      if (desktop.matches) setOpen(false, false);
    }
    if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
    else if (desktop.addListener) desktop.addListener(onBreakpoint);

    window.addEventListener('resize', function () {
      if (state.menuOpen) placeSheet();
    });
  }

  /* -- Section menus --------------------------------------------------------------
   * Desktop: each section's caret button is a disclosure for its panel. A
   * mouse hover opens a panel too (and closes it again on leave), but a
   * click pins it open. Only one is open at a time; Escape closes it (focus
   * goes back to its button if focus was inside), and so do a click
   * elsewhere and keyboard focus leaving the section. Phone: the same
   * buttons expand sections inside the sheet, several at once if wanted.
   * Returns a function that closes every section. */
  function initSectionMenus() {
    var groups = Array.prototype.slice.call(document.querySelectorAll('#site-nav .has-sub'));
    var desktop = window.matchMedia(DESKTOP_QUERY);

    function buttonOf(li) { return li.querySelector('.sub-toggle'); }
    function setGroup(li, open, how) {
      li.classList.toggle('open', open);
      if (open) li.setAttribute('data-open-by', how || 'click');
      else li.removeAttribute('data-open-by');
      var btn = buttonOf(li);
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function closeAll(except) {
      groups.forEach(function (g) {
        if (g !== except && g.classList.contains('open')) setGroup(g, false);
      });
    }

    groups.forEach(function (li) {
      var btn = buttonOf(li);
      if (!btn) return;
      var leaveTimer = 0;

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var open = li.classList.contains('open');
        if (open && li.getAttribute('data-open-by') === 'hover' && desktop.matches) {
          // Opened by the hover that brought the pointer here: the click
          // keeps it open after the pointer leaves.
          li.setAttribute('data-open-by', 'click');
          return;
        }
        if (open) {
          setGroup(li, false);
        } else {
          if (desktop.matches) closeAll(li);
          setGroup(li, true, 'click');
        }
      });

      li.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse' || !desktop.matches) return;
        window.clearTimeout(leaveTimer);
        closeAll(li);
        if (!li.classList.contains('open')) setGroup(li, true, 'hover');
      });
      li.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'mouse' || !desktop.matches) return;
        if (li.getAttribute('data-open-by') !== 'hover') return;
        leaveTimer = window.setTimeout(function () {
          if (li.getAttribute('data-open-by') === 'hover') setGroup(li, false);
        }, 160);
      });
      li.addEventListener('focusout', function (e) {
        if (!desktop.matches || !li.classList.contains('open')) return;
        var next = e.relatedTarget;
        // Focus moving within the section, or a click (the document click
        // handler decides), or a panel the pointer is holding open.
        if (!next || li.contains(next) || li.getAttribute('data-open-by') === 'hover') return;
        setGroup(li, false);
      });
    });

    document.addEventListener('click', function (e) {
      if (!desktop.matches) return;
      if (!(e.target.closest && e.target.closest('#site-nav .has-sub'))) closeAll(null);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !desktop.matches) return;
      var open = groups.filter(function (g) { return g.classList.contains('open'); })[0];
      if (!open) return;
      var hadFocus = open.contains(document.activeElement);
      setGroup(open, false);
      if (hadFocus && buttonOf(open)) buttonOf(open).focus();
    });

    return function () { closeAll(null); };
  }

  /* -- Skip link target ----------------------------------------------------------
   * tabindex="-1" lets the skip link move focus into <main> itself, so the
   * next Tab continues from the content in every browser. */
  function initSkipTarget() {
    var main = document.getElementById('main');
    if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  }

  /* -- Scroll reveal -----------------------------------------------------------------
   * Progressive: the HTML paints fully visible and only this script hides
   * anything, and only what is still below the fold when the page loads
   * (nothing on screen ever blinks out and back). html.eo-reveal gates the
   * CSS, so without the script nothing is hidden. Skipped for reduced
   * motion and on phones, where a single column is flicked through fast and
   * a late fade reads as a blank gap.
   * threshold must stay 0: a ratio threshold can never be reached by a block
   * taller than the viewport, which left those sections permanently hidden
   * (Ohio Pride 9a8485c). The negative bottom margin keeps the "meaningfully
   * in view" feel. Everything is revealed before printing. */
  function initReveal() {
    if (reducedMotion() || !('IntersectionObserver' in window)) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    var targets = document.querySelectorAll('main .section, main .band, main .card-grid > .card');
    if (!targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    var fold = window.innerHeight;
    forEach(targets, function (el) {
      if (el.getBoundingClientRect().top < fold) return; // already seen: never hide it
      el.classList.add('reveal');
      io.observe(el);
    });
    root.classList.add('eo-reveal');

    function revealAll() {
      forEach(document.querySelectorAll('.reveal:not(.in-view)'), function (el) {
        el.classList.add('in-view');
        io.unobserve(el);
      });
    }
    window.addEventListener('beforeprint', revealAll);
    if (window.matchMedia) {
      var print = window.matchMedia('print');
      var onPrint = function (e) { if (e.matches) revealAll(); };
      if (print.addEventListener) print.addEventListener('change', onPrint);
      else if (print.addListener) print.addListener(onPrint);
    }
  }

  /* -- New-tab links ------------------------------------------------------------------
   * Every link that opens a new tab says so to screen readers. The chrome's
   * own links get the same span at build time (lib/chrome.mjs NEW_TAB_NOTE). */
  function initNewTabLinks() {
    forEach(document.querySelectorAll('a[target="_blank"]'), function (a) {
      if (a.querySelector('.new-tab-note')) return;
      var note = document.createElement('span');
      note.className = 'sr-only new-tab-note';
      note.textContent = ' (opens in a new tab)';
      a.appendChild(note);
    });
  }

  /* -- Mock forms ------------------------------------------------------------------------
   * Design preview only: forms marked data-mock="true" transmit nothing. The
   * script takes over validation (form.noValidate, so browsers without it
   * keep their native checks) and renders, on an invalid submit:
   *   - .error-summary at the top of the form: role="alert", tabindex="-1",
   *     focused, a heading and one link per problem that focuses its field
   *   - p.field-error under each invalid field, named in its
   *     aria-describedby, plus aria-invalid="true"
   * A field's error clears as soon as it becomes valid. Messages are built
   * from the field's label ("Enter your email"); data-error="..." on a field
   * overrides it. A valid submit shows the form's .form-success and moves
   * focus to its heading. */
  function labelText(control) {
    var label = control.labels && control.labels[0];
    var text;
    if (label) {
      var copy = label.cloneNode(true);
      forEach(copy.querySelectorAll('.req, .optional'), function (el) { el.remove(); });
      text = copy.textContent;
    } else {
      text = control.getAttribute('aria-label') || control.name || 'this field';
    }
    return text.replace(/\*/g, '').replace(/\((?:optional|required)\)/gi, '').replace(/\s+/g, ' ').trim();
  }

  function messageFor(control) {
    var custom = control.getAttribute('data-error');
    if (custom) return custom;
    var v = control.validity;
    var name = labelText(control);
    var lower = name.charAt(0).toLowerCase() + name.slice(1);
    if (control.type === 'checkbox') return 'Check this box to continue';
    if (control.type === 'radio') return 'Choose an answer for ' + lower;
    if (v.valueMissing) return (control.tagName === 'SELECT' ? 'Choose your ' : 'Enter your ') + lower;
    if (v.typeMismatch && control.type === 'email') return 'Enter an email address like name@example.com';
    if (v.typeMismatch && control.type === 'url') return 'Enter a web address like https://example.com';
    return 'Check your ' + lower;
  }

  /* The element the inline error goes after: the tile for a checkbox, the
     fieldset for a radio group, the inline signup row, else the field. */
  function errorAnchor(control) {
    if (control.type === 'radio') return control.closest('fieldset') || control;
    if (control.type === 'checkbox') return control.closest('.choice') || control;
    return control.closest('.newsletter') || control;
  }

  function fieldKey(control) {
    return control.id || control.name;
  }

  function describedBy(control) {
    return (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  }

  function clearFieldError(control) {
    var id = fieldKey(control) + '-error';
    var msg = document.getElementById(id);
    if (msg) msg.remove();
    var refs = describedBy(control).filter(function (ref) { return ref !== id; });
    if (refs.length) control.setAttribute('aria-describedby', refs.join(' '));
    else control.removeAttribute('aria-describedby');
    control.removeAttribute('aria-invalid');
  }

  function showFieldError(control, message) {
    var id = fieldKey(control) + '-error';
    var msg = document.getElementById(id);
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'field-error';
      msg.id = id;
      errorAnchor(control).insertAdjacentElement('afterend', msg);
    }
    msg.innerHTML = '';
    var prefix = document.createElement('span');
    prefix.className = 'sr-only';
    prefix.textContent = 'Error: ';
    msg.appendChild(prefix);
    msg.appendChild(document.createTextNode(message));
    var refs = describedBy(control).filter(function (ref) { return ref !== id; });
    control.setAttribute('aria-describedby', [id].concat(refs).join(' '));
    control.setAttribute('aria-invalid', 'true');
  }

  function controlsOf(form) {
    return Array.prototype.filter.call(form.elements, function (el) {
      return el.willValidate && !el.disabled && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    });
  }

  /* Invalid controls, one entry per radio group. */
  function invalidControls(form) {
    var seen = {};
    return controlsOf(form).filter(function (el) {
      if (el.validity.valid) return false;
      if (el.type === 'radio') {
        if (seen[el.name]) return false;
        seen[el.name] = true;
      }
      return true;
    });
  }

  function focusField(control) {
    control.focus({ preventScroll: true });
    var target = control.type === 'radio' ? (control.closest('fieldset') || control) : (control.closest('.choice') || control);
    target.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }

  function renderSummary(form, problems) {
    var summary = form.querySelector('.error-summary');
    if (!problems.length) {
      if (summary) summary.remove();
      return null;
    }
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'error-summary';
      summary.setAttribute('role', 'alert');
      summary.setAttribute('tabindex', '-1');
      var title = document.createElement('h2');
      title.className = 'error-summary__title';
      title.id = (form.id || fieldKey(problems[0].control)) + '-error-summary';
      summary.setAttribute('aria-labelledby', title.id);
      summary.appendChild(title);
      summary.appendChild(document.createElement('ul'));
      summary.addEventListener('click', function (e) {
        var link = e.target.closest && e.target.closest('a[href^="#"]');
        if (!link) return;
        var control = document.getElementById(link.getAttribute('href').slice(1));
        if (!control) return;
        e.preventDefault();
        focusField(control);
      });
      form.insertBefore(summary, form.firstChild);
    }
    summary.querySelector('.error-summary__title').textContent =
      problems.length === 1 ? 'Please check this item:' : 'Please check these ' + problems.length + ' items:';
    var list = summary.querySelector('ul');
    list.innerHTML = '';
    problems.forEach(function (p) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + fieldKey(p.control);
      a.textContent = p.message;
      li.appendChild(a);
      list.appendChild(li);
    });
    return summary;
  }

  function validate(form) {
    var problems = invalidControls(form).map(function (control) {
      return { control: control, message: messageFor(control) };
    });
    var invalidKeys = problems.map(function (p) { return fieldKey(p.control); });
    controlsOf(form).forEach(function (control) {
      if (control.hasAttribute('aria-invalid') && invalidKeys.indexOf(fieldKey(control)) === -1) clearFieldError(control);
    });
    problems.forEach(function (p) { showFieldError(p.control, p.message); });
    return problems;
  }

  function showSuccess(form) {
    var success = form.parentElement.querySelector('.form-success') ||
                  document.getElementById(form.getAttribute('data-success') || '');
    form.querySelectorAll('button[type="submit"]').forEach(function (b) {
      b.disabled = true;
      b.textContent = 'Submitted (preview)';
    });
    controlsOf(form).forEach(function (el) { el.disabled = true; });
    if (!success) return;
    success.classList.add('show');
    var heading = success.querySelector('h2, h3') || success;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    success.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }

  function initMockForms() {
    forEach(document.querySelectorAll('form[data-mock="true"]'), function (form) {
      form.noValidate = true;

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var problems = validate(form);
        var summary = renderSummary(form, problems);
        if (summary) {
          window.requestAnimationFrame(function () {
            summary.focus({ preventScroll: true });
            summary.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
          });
          return;
        }
        showSuccess(form);
      });

      // Clear a field's error the moment it is fixed (the summary follows).
      function onEdit(e) {
        var control = e.target;
        if (!control || control.getAttribute('aria-invalid') !== 'true' || !control.validity) return;
        var group = control.type === 'radio' ? form.querySelectorAll('input[type="radio"][name="' + control.name + '"]') : [control];
        if (!control.validity.valid) return;
        forEach(group, clearFieldError);
        var remaining = invalidControls(form).filter(function (el) { return el.getAttribute('aria-invalid') === 'true'; });
        renderSummary(form, remaining.map(function (el) { return { control: el, message: messageFor(el) }; }));
      }
      form.addEventListener('input', onEdit);
      form.addEventListener('change', onEdit);
    });
  }

  /* ------------------------------------------------------------------------- */

  function init() {
    if (window.__eoSiteInit) return; // loaded twice: wire listeners once
    window.__eoSiteInit = true;
    root.classList.add('eo-js');

    var state = { menuOpen: false };
    var helpBar = initHelpBar(state);
    var closeSubmenus = initSectionMenus();
    initPhoneMenu(state, helpBar, closeSubmenus);
    initSkipTarget();
    initReveal();
    initNewTabLinks();
    initMockForms();
  }

  /* The static pages load this with defer, so the DOM is parsed already; a
     page that loads it later (e.g. after DOMContentLoaded) still initializes. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
