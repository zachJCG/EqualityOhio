/*
 * Background textures: the logomark's bars, tiled faint.
 *
 * These were inline data-URI SVGs in public/css/eo-site.css (.hero at
 * line 228, .band at line 267) with the hex values typed into the URI.
 * They are the same tiles, drawn here from the brand tokens, so a palette
 * change reaches them through `npm run assets`. Geometry, tile size and
 * opacity are copied unchanged from the original data URIs; the CSS keeps
 * the same `0 0/240px 240px repeat` and `0 0/260px 260px repeat` sizing.
 */
import { C, group, rect, svg, writePublic } from "./kit.mjs";

/* .hero: two green bars top-left, the purple equals lower-right, two blue
 * bars upper-right, at 4.5% opacity, on a 240px tile. */
export function heroBarsSvg() {
  return svg({
    w: 240,
    h: 240,
    body: group(
      [
        rect({ x: 18, y: 24, w: 9, h: 52, fill: C.green }),
        rect({ x: 32, y: 24, w: 9, h: 52, fill: C.green }),
        rect({ x: 150, y: 150, w: 52, h: 13, fill: C.purple }),
        rect({ x: 150, y: 176, w: 52, h: 13, fill: C.purple }),
        rect({ x: 196, y: 40, w: 9, h: 52, fill: C.blue }),
        rect({ x: 210, y: 40, w: 9, h: 52, fill: C.blue }),
      ],
      `opacity="0.045"`,
    ),
  });
}

/* .band: a pair of bars and the equals sign in white at 7% opacity over
 * the purple gradient, on a 260px tile. */
export function bandBarsSvg() {
  return svg({
    w: 260,
    h: 260,
    body: group(
      [
        rect({ x: 24, y: 30, w: 10, h: 58 }),
        rect({ x: 40, y: 30, w: 10, h: 58 }),
        rect({ x: 168, y: 168, w: 58, h: 14 }),
        rect({ x: 168, y: 196, w: 58, h: 14 }),
      ],
      `opacity="0.07" fill="${C.bg}"`,
    ),
  });
}

export function buildTextures() {
  writePublic("assets/textures/hero-bars.svg", heroBarsSvg() + "\n");
  writePublic("assets/textures/band-bars.svg", bandBarsSvg() + "\n");
}
