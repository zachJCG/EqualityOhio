/*
 * The Equality Ohio logomark, measured from the official artwork.
 *
 * public/assets/logo/equality-ohio-logo.png (400x174, RGBA) is the only
 * official logo file we hold: a row of three groups above the wordmark,
 * two green vertical bars, a purple equals sign (two horizontal bars) and
 * two blue vertical bars. measureMark() scans its raw pixels with sharp and
 * returns each bar as a rectangle with sub-pixel edges (an edge pixel with
 * alpha a covers a/255 of the pixel), so the vector recreation is the
 * artwork's own geometry rather than a hand-drawn approximation.
 *
 * Colours are NOT taken from the pixels: each bar is matched to the nearest
 * brand token (C.green / C.purple / C.blue), and the tokens are what get
 * drawn. The measured pixel colours are reported for the audit trail.
 */
import { join } from "node:path";

import { C, PUBLIC, n, rect, rgb } from "./kit.mjs";

export const LOGO_FILE = join(PUBLIC, "assets", "logo", "equality-ohio-logo.png");

const TOKEN_KEYS = ["green", "purple", "blue"];

function nearestToken([r, g, b]) {
  let best = null;
  for (const k of TOKEN_KEYS) {
    const t = rgb(C[k]);
    const d = (t.r - r) ** 2 + (t.g - g) ** 2 + (t.b - b) ** 2;
    if (!best || d < best.d) best = { k, d };
  }
  return best.k;
}

let cache = null;

/**
 * @returns {{ w, h, rects: {x,y,w,h,token,measured}[], source: {x0,y0} }}
 *   rects are relative to the mark's own top-left corner; w/h is its box.
 */
export async function measureMark(sharp) {
  if (cache) return cache;
  const { data, info } = await sharp(LOGO_FILE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const A = (x, y) => data[(y * W + x) * 4 + 3];
  const RGB = (x, y) => [0, 1, 2].map((c) => data[(y * W + x) * 4 + c]);

  // 1. The mark is the first band of non-empty rows; a fully transparent
  //    row separates it from the wordmark.
  let top = 0;
  while (top < H && ![...Array(W).keys()].some((x) => A(x, top) > 0)) top += 1;
  let bottom = top;
  while (bottom < H && [...Array(W).keys()].some((x) => A(x, bottom) > 0)) bottom += 1;
  // rows [top, bottom) hold the mark

  // 2. Column runs across the band: one per bar group (5 expected).
  const colHas = (x) => {
    for (let y = top; y < bottom; y += 1) if (A(x, y) > 0) return true;
    return false;
  };
  const runs = [];
  for (let x = 0, s = -1; x <= W; x += 1) {
    const on = x < W && colHas(x);
    if (on && s < 0) s = x;
    if (!on && s >= 0) {
      runs.push([s, x - 1]);
      s = -1;
    }
  }
  if (runs.length !== 5) throw new Error(`measureMark: expected 5 bar columns in the logomark, found ${runs.length}`);

  // 3. For each column run: sub-pixel left/right edges averaged over the
  //    rows where the run's centre pixel is fully opaque, then the vertical
  //    runs (one per bar; the equals sign has two) at the centre column.
  const rects = [];
  for (const [a, b] of runs) {
    const cx = Math.round((a + b) / 2);
    let lSum = 0;
    let rSum = 0;
    let rows = 0;
    for (let y = top; y < bottom; y += 1) {
      if (A(cx, y) !== 255) continue;
      lSum += a + (1 - A(a, y) / 255);
      rSum += b + A(b, y) / 255;
      rows += 1;
    }
    const left = lSum / rows;
    const right = rSum / rows;
    for (let y = top, s = -1; y <= bottom; y += 1) {
      const al = y < bottom ? A(cx, y) : 0;
      if (al > 0 && s < 0) s = y;
      if (al === 0 && s >= 0) {
        const e = y - 1;
        const y0 = s + (1 - A(cx, s) / 255);
        const y1 = e + A(cx, e) / 255;
        const mid = Math.round((s + e) / 2);
        const measured = RGB(cx, mid);
        rects.push({ x: left, y: y0, w: right - left, h: y1 - y0, token: nearestToken(measured), measured });
        s = -1;
      }
    }
  }
  if (rects.length !== 6) throw new Error(`measureMark: expected 6 bars (2 + equals 2 + 2), found ${rects.length}`);

  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  cache = {
    w: n(x1 - x0),
    h: n(y1 - y0),
    rects: rects.map((r) => ({ ...r, x: n(r.x - x0), y: n(r.y - y0), w: n(r.w), h: n(r.h) })),
    source: { x0: n(x0), y0: n(y0), file: "public/assets/logo/equality-ohio-logo.png", logoW: W, logoH: H },
  };
  return cache;
}

/** The equals sign alone: the purple bars, re-originated at 0,0. */
export function equalsOf(mark) {
  const bars = mark.rects.filter((r) => r.token === "purple");
  const x0 = Math.min(...bars.map((r) => r.x));
  const y0 = Math.min(...bars.map((r) => r.y));
  return {
    w: n(Math.max(...bars.map((r) => r.x + r.w)) - x0),
    h: n(Math.max(...bars.map((r) => r.y + r.h)) - y0),
    rects: bars.map((r) => ({ ...r, x: n(r.x - x0), y: n(r.y - y0) })),
  };
}

/**
 * Mark rects as SVG, placed at (x, y) and scaled by s.
 * @param fill  a colour for every bar (e.g. white for a motif), or null to
 *              draw each bar in its brand token colour.
 */
export function markRects(mark, { x = 0, y = 0, s = 1, fill = null } = {}) {
  return mark.rects
    .map((r) => rect({ x: x + r.x * s, y: y + r.y * s, w: r.w * s, h: r.h * s, fill: fill ?? C[r.token] }))
    .join("");
}
