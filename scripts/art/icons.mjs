/*
 * Favicons and app icons, drawn from the measured logomark (mark.mjs).
 *
 *   /favicon.svg                      equals sign, purple, transparent
 *   /favicon.ico                      16, 32, 48 (PNG-in-ICO), equals sign
 *   /apple-touch-icon.png             180, full mark on opaque white
 *   /assets/brand/icon-192.png        full mark on white
 *   /assets/brand/icon-512.png        full mark on white
 *   /assets/brand/icon-maskable-512.png  full mark inside the 80% safe zone
 *   /assets/brand/mark.svg            the full mark, exact geometry, tokens
 *
 * Why the equals sign alone at tab size: the full row is 3.67:1, so in a
 * 16px square it is a 14x4px stripe whose bars are 1.4px wide with 1.1px
 * gaps; it reads as a coloured line, not as the mark. The purple equals is
 * almost exactly square (107 x 108.25 in logo pixels) and at 14px tall its
 * bars land on whole pixels (5.00px bar, 3.99px gap, 5.00px bar). The tab
 * icons snap every edge to the pixel grid (the largest move is 0.24px, a
 * 1.2% width change), so there is no blurred anti-aliased column at 16, 32
 * or 48. It is also the shape EO's current site icon is built on. From
 * 180px up the whole row is legible, so the larger icons carry all of it.
 */
import { C, group, n, rect, svg, writePublic } from "./kit.mjs";
import { equalsOf, markRects, measureMark } from "./mark.mjs";

/**
 * Square icon SVG: the equals sign, `pad` px of `size` on each side, every
 * edge snapped to the pixel grid of a `size`px raster.
 */
function equalsSvg(eq, size, { pad = size / 16, darkScheme = false } = {}) {
  const s = (size - 2 * pad) / eq.h;
  const x = (size - eq.w * s) / 2;
  const R = Math.round;
  const bars = eq.rects
    .map((r) => {
      const x0 = R(x + r.x * s);
      const y0 = R(pad + r.y * s);
      return rect({ x: x0, y: y0, w: R(x + (r.x + r.w) * s) - x0, h: R(pad + (r.y + r.h) * s) - y0 });
    })
    .join("");
  // In a dark browser UI purple on charcoal is ~1.4:1 and the icon
  // vanishes; the SVG favicon switches to the lightest purple token there.
  const style = darkScheme
    ? `<style>rect{fill:${C.purple}}@media (prefers-color-scheme:dark){rect{fill:${C.purpleBorder}}}</style>`
    : "";
  return svg({ w: size, h: size, body: style + group([bars], darkScheme ? "" : `fill="${C.purple}"`) });
}

/** Square icon SVG: the full mark centred on white, `markW` px wide. */
function fullMarkSvg(mark, size, markW) {
  const s = markW / mark.w;
  const x = (size - mark.w * s) / 2;
  const y = (size - mark.h * s) / 2;
  return svg({ w: size, h: size, body: rect({ x: 0, y: 0, w: size, h: size, fill: C.bg }) + markRects(mark, { x, y, s }) });
}

/** ICO container holding PNG images (supported everywhere since Vista). */
export function icoFromPngs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); // width
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1); // height
    dir.writeUInt8(0, o + 2); // palette colours
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

export async function buildIcons(sharp) {
  const mark = await measureMark(sharp);
  const eq = equalsOf(mark);

  const raster = (svgText, { palette = true } = {}) =>
    sharp(Buffer.from(svgText))
      .png({ palette, quality: 100, effort: 10, compressionLevel: 9 })
      .toBuffer();

  // Vector favicon (tab size): equals sign, dark-scheme aware.
  const faviconSvg = equalsSvg(eq, 16, { darkScheme: true });
  writePublic("favicon.svg", faviconSvg + "\n");

  // favicon.ico: 16, 32, 48. Full 32-bit RGBA (no palette) so the
  // anti-aliased edges keep their alpha in every ICO reader.
  const ico = [];
  for (const size of [16, 32, 48]) {
    ico.push({ size, png: await raster(equalsSvg(eq, size), { palette: false }) });
  }
  writePublic("favicon.ico", icoFromPngs(ico));

  // Home-screen and manifest icons: the whole mark on white.
  // apple-touch: iOS rounds the corners and wants ~10% breathing room.
  writePublic("apple-touch-icon.png", await raster(fullMarkSvg(mark, 180, 150)));
  writePublic("assets/brand/icon-192.png", await raster(fullMarkSvg(mark, 192, 160)));
  writePublic("assets/brand/icon-512.png", await raster(fullMarkSvg(mark, 512, 428)));
  // Maskable: the safe zone is a centred circle of radius 0.4 x 512 =
  // 204.8px. A 340px-wide mark has a half-diagonal of 176px, so every bar
  // corner stays inside it whatever mask shape the launcher applies.
  const maskW = 340;
  const halfDiag = Math.hypot(maskW / 2, (mark.h * maskW) / mark.w / 2);
  if (halfDiag > 0.4 * 512) throw new Error(`maskable icon: mark corner at ${n(halfDiag)}px leaves the safe zone`);
  writePublic("assets/brand/icon-maskable-512.png", await raster(fullMarkSvg(mark, 512, maskW)));

  // The full mark as a vector, for any page that wants it without the
  // wordmark PNG (viewBox is the artwork's own logo-pixel geometry).
  writePublic(
    "assets/brand/mark.svg",
    svg({ w: mark.w, h: mark.h, size: false, title: "Equality Ohio", body: markRects(mark) }) + "\n",
  );

  return { mark, equals: eq, maskableHalfDiagonal: n(halfDiag) };
}
