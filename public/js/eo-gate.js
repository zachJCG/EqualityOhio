/* Staging gate page behavior (public/gate.html). Moved out of an inline
 * <script> so the gate is served with the same script-src 'self' policy as
 * every other static page.
 *
 *   ?error=1     wrong password
 *   ?error=rate  too many attempts from this address (lib/rate-limit.mjs)
 *   ?from=/path  where to land after a successful login
 *
 * The from value is copied into the form only when it is a same-origin path.
 * The server re-checks it (lib/preview-gate.mjs safeFrom), so this is the
 * friendly half of the rule, not the security boundary. Remove with the rest
 * of the gate at launch. */
(function () {
  'use strict';

  function safeFrom(raw) {
    if (!raw || raw.charAt(0) !== '/' || raw.charAt(1) === '/') return '/';
    // Backslashes and control characters are normalized by URL parsing into
    // something else entirely ("/\evil.example" becomes "//evil.example").
    if (/[\\\u0000-\u001f\u007f]/.test(raw)) return '/';
    try {
      var url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return '/';
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return '/';
    }
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var error = params.get('error');
    var box = document.getElementById(error === 'rate' ? 'gate-error-rate' : 'gate-error');
    if (error && box) box.classList.add('show');

    var field = document.getElementById('gate-from');
    if (field) field.value = safeFrom(params.get('from') || '/');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
