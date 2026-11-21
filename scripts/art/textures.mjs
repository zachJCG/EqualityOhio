/*
 * Background textures: the logomark's bars, tiled faint.
 *
 * These were inline data-URI SVGs in public/css/eo-site.css (.hero at
 * line 228, .band at line 267) with the hex values typed into the URI.
 * They are the same tiles, drawn here from the brand tokens, so a palette
 * change reaches them through `npm run assets`. Geometry, tile size and
 * opacity are copied unchanged from the original data URIs; the CSS keeps
 * the same `0 0/240px 240px repeat` and `0 0/260px 260px repeat` sizing.
 * The news-card media art and the footer watermark (2026-11) draw the
 * logomark measured from the official artwork (mark.mjs).
 */
import { C, group, rect, svg, writePublic } from "./kit.mjs";
import { markRects, measureMark } from "./mark.mjs";

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

/* News-card media art (2026-11): the logomark in white, oversized and cut
 * off by the card's right edge, at 16% over the card's own brand color. The
 * pill sits in the clear area on the left. One tile serves every variant;
 * eo-site.css shifts it per variant (alt-a/b/c) so a grid of cards does not
 * repeat itself, and scales it a little when its card is hovered. */
export function mediaMarkSvg(mark) {
  const W = 640;
  const H = 260;
  const s = 1.7;
  return svg({
    w: W,
    h: H,
    body: group([markRects(mark, { x: 250, y: (H - mark.h * s) / 2, s, fill: C.bg })], `opacity="0.16"`),
  });
}

/* Footer watermark (2026-11): the whole logomark in white at 6%, set into
 * the footer's purple by eo-site.css. Faint enough that the footer text
 * keeps its contrast (the tokens file lists the footer ratios). */
export function footerMarkSvg(mark) {
  return svg({ w: mark.w, h: mark.h, body: group([markRects(mark, { fill: C.bg })], `opacity="0.06"`) });
}

export async function buildTextures(sharp) {
  writePublic("assets/textures/hero-bars.svg", heroBarsSvg() + "\n");
  writePublic("assets/textures/band-bars.svg", bandBarsSvg() + "\n");
  const mark = await measureMark(sharp);
  writePublic("assets/textures/media-mark.svg", mediaMarkSvg(mark) + "\n");
  writePublic("assets/textures/footer-mark.svg", footerMarkSvg(mark) + "\n");
}
