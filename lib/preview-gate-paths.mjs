/* =============================================================================
 * lib/preview-gate-paths.mjs: what the staging gate lets through without the
 * cookie. Plain data with no imports, so scripts/build-pages.mjs can read it
 * to write lib/open-files.generated.mjs (which lib/preview-gate.mjs imports)
 * even when that generated file is missing.
 *
 * Remove with the rest of the gate after launch.
 * ========================================================================== */

/* Reachable without the cookie. Nothing here reveals page content: the gate
 * page and its script, the login endpoint, crawler and browser plumbing
 * (robots, sitemap, manifest and icons are fetched without cookies), and the
 * stylesheets, fonts and brand art the gate page and share cards use. */
export const OPEN_EXACT = new Set([
  '/gate',
  '/api/gate',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/js/eo-gate.js',
]);

/* Directories whose real files are open. Only the files that exist in them
 * are: lib/open-files.generated.mjs lists them (written by `npm run
 * pages:build` from a walk of public/, checked for drift by check:pages),
 * because the middleware runs on the edge and cannot read the disk. Any
 * other path under these prefixes ("/css/x", a probe, an encoded traversal)
 * goes to the gate like every other path, so a signed-out visitor never
 * gets the branded 404 and its site chrome. */
export const OPEN_PREFIXES = [
  '/css/',
  '/assets/fonts/',
  '/assets/logo/',
  '/assets/brand/',
  '/assets/og/',
  '/assets/textures/',
];
