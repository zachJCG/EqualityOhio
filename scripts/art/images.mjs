/*
 * Responsive variants of the two heavy raster images (ported from
 * OhioPride scripts/build-images.mjs, with paths under public/ and
 * per-image widths taken from where each image is actually rendered).
 *
 * The originals stay where they are (the current markup and the
 * votersguide share card point at them) and are the <img> fallback.
 * Variants are written next to them in public/assets/img/ as
 * <slug>-<width>.<ext>. Output is deterministic and only rewritten when the
 * bytes change, so re-running is a no-op.
 *
 *   candidate-scorecard-2026-banner.png  1250x625 RGB, 306 KB
 *     /votersguide, inside .container (max 1160 - 2 x 24px padding), so it
 *     renders at most 1112 CSS px wide and 100vw - 48px below that. Its 2x
 *     need (2224px) is beyond the original, so the top width is the
 *     original 1250 and the PNG fallback is the original file.
 *   legal-clinic-mark.png                1080x1080 RGBA, 136 KB
 *     /legal-clinic hero, drawn at 170 CSS px (display:none under 720px).
 *     1x and 2x variants, plus a 340px PNG fallback (the original is more
 *     than 3x the largest 2x need).
 */
import { statSync } from "node:fs";
import { join } from "node:path";

import { PUBLIC, writePublic } from "./kit.mjs";

export const IMAGES = [
  {
    slug: "candidate-scorecard-2026-banner",
    src: "assets/img/candidate-scorecard-2026-banner.png",
    widths: [640, 960, 1250],
    // Text-heavy art: quality is set where the 2026 numerals and the body
    // copy stay sharp at 1x (checked by eye).
    avif: { quality: 60, effort: 6, chromaSubsampling: "4:4:4" },
    webp: { quality: 82, effort: 6, smartSubsample: true },
    png: null,
    sizes: "(min-width: 1160px) 1112px, calc(100vw - 48px)",
    // public/votersguide.html: the page's LCP image, so high priority and
    // never lazy. Alt kept verbatim from the current <img>.
    usage: {
      page: "public/votersguide.html",
      alt: "2026 Candidate Scorecard \u2014 Equality Ohio",
      width: 1250,
      height: 625,
      style: "width:100%;height:auto;border-radius:var(--eo-radius-lg);box-shadow:var(--eo-shadow-card);",
      priority: true,
    },
  },
  {
    slug: "legal-clinic-mark",
    src: "assets/img/legal-clinic-mark.png",
    widths: [170, 340],
    avif: { quality: 64, effort: 6, chromaSubsampling: "4:4:4" },
    webp: { quality: 86, effort: 6, alphaQuality: 100 },
    png: { width: 340, palette: true, quality: 95, effort: 10, compressionLevel: 9 },
    sizes: "170px",
    // public/legal-clinic.html hero: 170px, hidden under 720px. The hide
    // class moves to <picture> so the hidden image is never fetched (lazy
    // images that are not rendered do not load); above 720px it is in the
    // first viewport and loads straight away. Not the LCP element.
    usage: {
      page: "public/legal-clinic.html",
      alt: "Equality Ohio Legal Clinic",
      width: 170,
      height: 170,
      style: "width:170px;height:auto;",
      pictureClass: "clinic-hero-mark",
      lazy: true,
    },
  },
];

export async function buildImages(sharp) {
  const results = [];
  for (const img of IMAGES) {
    const srcAbs = join(PUBLIC, img.src);
    const meta = await sharp(srcAbs).metadata();
    const out = { slug: img.slug, src: `/${img.src}`, original: { width: meta.width, height: meta.height, bytes: statSync(srcAbs).size }, files: [] };
    for (const w of img.widths) {
      const width = Math.min(w, meta.width);
      const height = Math.round((meta.height * width) / meta.width);
      const base = () => sharp(srcAbs).resize({ width, kernel: "lanczos3", withoutEnlargement: true });
      for (const [ext, buf] of [
        ["avif", await base().avif(img.avif).toBuffer()],
        ["webp", await base().webp(img.webp).toBuffer()],
      ]) {
        const rel = `assets/img/${img.slug}-${width}.${ext}`;
        writePublic(rel, buf);
        out.files.push({ path: `/${rel}`, width, height, bytes: buf.length });
      }
    }
    if (img.png) {
      const { width, ...opts } = img.png;
      const height = Math.round((meta.height * width) / meta.width);
      const buf = await sharp(srcAbs).resize({ width, kernel: "lanczos3" }).png(opts).toBuffer();
      const rel = `assets/img/${img.slug}-${width}.png`;
      writePublic(rel, buf);
      out.files.push({ path: `/${rel}`, width, height, bytes: buf.length });
    }
    results.push({ ...out, sizes: img.sizes, usage: img.usage });
  }
  return results;
}

/** The <picture> markup for one image (printed by generate-assets). */
export function pictureSnippet(r, { alt, cls = "", pictureClass = "", style = "", width, height, priority = false, lazy = false }) {
  const by = (ext) => r.files.filter((f) => f.path.endsWith(`.${ext}`));
  const srcset = (ext) => by(ext).map((f) => `${f.path} ${f.width}w`).join(", ");
  const fallback = by("png")[0]?.path ?? r.src;
  const attrs = [
    `src="${fallback}"`,
    `alt="${alt}"`,
    `width="${width}"`,
    `height="${height}"`,
    cls ? `class="${cls}"` : "",
    style ? `style="${style}"` : "",
    priority ? `fetchpriority="high"` : "",
    lazy ? `loading="lazy"` : "",
    `decoding="async"`,
  ].filter(Boolean);
  return [
    pictureClass ? `<picture class="${pictureClass}">` : `<picture>`,
    `  <source type="image/avif" srcset="${srcset("avif")}" sizes="${r.sizes}" />`,
    `  <source type="image/webp" srcset="${srcset("webp")}" sizes="${r.sizes}" />`,
    `  <img ${attrs.join(" ")} />`,
    `</picture>`,
  ].join("\n");
}
