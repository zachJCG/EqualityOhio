/*
 * Share cards (Open Graph / Twitter), 1200x630 PNG, one per site section.
 *
 * One layout for every card: a --eo-purple-deep to --eo-purple field, the
 * equality bar across the top, EO's official logo in white (composited
 * from the PNG's alpha, never upscaled), the page's eyebrow in --eo-gold
 * League Spartan caps, its h1 in white Montserrat 800, an optional sub-line
 * in Open Sans, a footer line (the domain; the clinic card adds
 * 855-LGBT-LAW), and the logomark itself as a faint white motif low on the
 * right, cropped by the right and bottom edges. No photography: EO has no
 * licensed photos yet.
 *
 * Words come ONLY from EO's existing pages. The eyebrow and headline are
 * read from each card's page at generation time (first .eyebrow, first
 * h1), so a copy edit on the page flows into its card on the next
 * `npm run assets`. Sub-lines and footers are chosen by hand but must be
 * found verbatim (case-insensitive) in the page's own text, or the build
 * fails.
 *
 * Type is wrapped and sized by measuring real rendered lines (librsvg via
 * sharp, the same renderer that draws the card), then every line is checked
 * against the safe area; anything that would overflow fails the build.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FONTS } from "./fonts.mjs";
import { LOGO_FILE, markRects, measureMark } from "./mark.mjs";
import { C, PUBLIC, esc, n, rect, svg, textOf, writePublic } from "./kit.mjs";

const W = 1200;
const H = 630;
export const OG_SIZE = { w: W, h: H };

/** The cards. `page` is the source of the eyebrow and h1. */
export const OG_CARDS = {
  default: {
    page: "index.html",
    sub: "Lived and legal equality for LGBTQ+ Ohioans",
  },
  "legal-clinic": {
    page: "legal-clinic.html",
    sub: "Our services are always free.",
    footer: ["855-LGBT-LAW", "equalityohio.org"], // the clinic line, as on the page
  },
  "our-work": {
    page: "our-work.html",
    sub: "Equality Ohio defends the rights of LGBTQ Ohioans.",
  },
  "get-involved": {
    page: "get-involved.html",
    sub: "If you support LGBTQ equality, you\u2019re a part of the Equality Ohio family.",
  },
  about: {
    page: "about.html",
    sub: "Ohio\u2019s statewide LGBTQ+ advocacy and legal aid organization",
  },
  give: {
    page: "give.html",
    sub: "Every dollar supports free legal services, policy advocacy, and organizing across Ohio.",
  },
  news: {
    page: "news.html",
    sub: "Statements, policy alerts, and the stories behind the work",
  },
};

/* ------------------------------------------------------------ layout */

const DOMAIN = "equalityohio.org";
const PAD_X = 80;
const SAFE_RIGHT = W - 72; // no ink past this
const BAR_H = 12;
const LOGO_W = 240; // official PNG is 400px wide; never drawn larger
const LOGO_Y = 58;
const FOOT_BASE = 572;
const FOOT_SIZE = 22;
const REGION_TOP = 206; // below the logo
const REGION_BOTTOM = 528; // above the footer

const TYPE = {
  eyebrow: { family: FONTS.emphasis, weight: 700, track: 0.14, max: 25, min: 19 }, // .eyebrow: caps, 0.14em
  head: { family: FONTS.display, weight: 800, track: -0.02, lead: 1.1, max: 92, min: 50, maxW: 1000, maxLines: 4 }, // h1: 800, -0.02em
  sub: { family: FONTS.body, weight: 400, track: 0, lead: 1.32, size: 27, maxW: 900, maxLines: 2 },
};

// Rough font metrics (fractions of the em) used only for vertical spacing.
const CAP = { display: 0.7, emphasis: 0.68, body: 0.714 };
const DESC = 0.22;

/** Glyphs the latin subsets do not carry, swapped for what a browser shows. */
const renderable = (s) => s.replace(/\u2011/g, "-").replace(/\u00A0/g, " ");

function textEl({ x, y, size, family, weight, track = 0, fill, opacity, text }) {
  return `<text x="${n(x)}" y="${n(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" font-style="normal" letter-spacing="${n(track * size)}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ""}>${esc(renderable(text))}</text>`;
}

/* ------------------------------------------------------- measurement */

const REF = 60; // px; wrap-search widths are measured here and scaled

/**
 * Ink-box measurer, backed by batch renders (librsvg sets up its fonts on
 * every render, ~150ms, so strings are measured many to a render: one row
 * each, then each row's ink is found by scanning the raw pixels).
 *
 * `measure(text, font)` scales a REF px measurement linearly (tracking is
 * em-based, so it scales too); it drives the wrapping search.
 * `measure.prefetch(texts, font)` fills that cache in one render.
 * `measure.exact(items)` renders at the real sizes; the final overflow
 * check uses it.
 */
export function makeMeasurer(sharp) {
  const cache = new Map();
  const keyOf = (text, f) => `${f.family}|${f.weight}|${f.size}|${f.track ?? 0}|${text}`;

  async function batch(items) {
    const seen = new Set();
    const todo = items.filter(({ text, font }) => {
      const k = keyOf(text, font);
      if (cache.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (!todo.length) return;
    const X = 40;
    const cw = Math.ceil(Math.max(...todo.map(({ text, font }) => text.length * font.size * 0.9)) + 2 * X);
    const rows = [];
    let y = 0;
    for (const it of todo) {
      const rh = Math.ceil(it.font.size * 1.7);
      rows.push({ ...it, top: y, h: rh });
      y += rh;
    }
    const body =
      rect({ x: 0, y: 0, w: cw, h: y, fill: C.bg }) +
      rows.map((r) => textEl({ x: X, y: r.top + r.font.size * 1.2, ...r.font, fill: C.ink, text: r.text })).join("");
    const { data, info } = await sharp(Buffer.from(svg({ w: cw, h: y, body })), { limitInputPixels: false })
      .flatten({ background: C.bg })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const stride = info.width * info.channels;
    for (const r of rows) {
      let min = Infinity;
      let max = -1;
      for (let yy = r.top; yy < r.top + r.h; yy += 1) {
        const row = yy * stride;
        for (let x = 0; x < info.width; x += 1) {
          if (data[row + x * info.channels] < 247) {
            if (x < min) min = x;
            if (x > max) max = x;
          }
        }
      }
      cache.set(keyOf(r.text, r.font), max < 0 ? { left: 0, width: 0 } : { left: min - X, width: max - min + 1 });
    }
  }

  async function measure(text, font) {
    const ref = { ...font, size: REF };
    const k = keyOf(text, ref);
    if (!cache.has(k)) await batch([{ text, font: ref }]);
    const box = cache.get(k);
    const f = font.size / REF;
    return { left: box.left * f, width: box.width * f };
  }
  measure.prefetch = (texts, font) => batch(texts.map((text) => ({ text, font: { ...font, size: REF } })));
  measure.exact = async (items) => {
    await batch(items);
    return items.map(({ text, font }) => cache.get(keyOf(text, font)));
  };
  return measure;
}

/** Every run of consecutive words: all the lines a wrap could produce. */
function spans(words) {
  const out = [];
  for (let i = 0; i < words.length; i += 1) for (let j = i + 1; j <= words.length; j += 1) out.push(words.slice(i, j).join(" "));
  return out;
}

/** Greedy wrap at `maxW` using measured ink widths. */
async function wrap(measure, words, font, maxW) {
  const lines = [];
  let cur = "";
  for (const w of words) {
    const tryLine = cur ? `${cur} ${w}` : w;
    const { left, width } = await measure(tryLine, font);
    if (!cur || left + width <= maxW) cur = tryLine;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Wrap into the fewest lines (greedy), then choose, among all splits into
 * that many lines that fit, the one with the most even line lengths (least
 * total squared slack, last line included, so no short widow line).
 */
async function balancedWrap(measure, words, font, maxW) {
  const k = (await wrap(measure, words, font, maxW)).length;
  if (k <= 1) return [words.join(" ")];
  const N = words.length;
  const width = new Map();
  const lineW = async (i, j) => {
    const key = `${i}:${j}`;
    if (!width.has(key)) {
      const { left, width: w } = await measure(words.slice(i, j).join(" "), font);
      width.set(key, left + w);
    }
    return width.get(key);
  };
  // best[l][j]: min cost to set words[0, j) in l lines.
  const best = Array.from({ length: k + 1 }, () => new Array(N + 1).fill(Infinity));
  const from = Array.from({ length: k + 1 }, () => new Array(N + 1).fill(-1));
  best[0][0] = 0;
  for (let l = 1; l <= k; l += 1) {
    for (let j = 1; j <= N; j += 1) {
      for (let i = l - 1; i < j; i += 1) {
        if (best[l - 1][i] === Infinity) continue;
        const w = await lineW(i, j);
        if (w > maxW) continue;
        const cost = best[l - 1][i] + (maxW - w) ** 2;
        if (cost < best[l][j]) {
          best[l][j] = cost;
          from[l][j] = i;
        }
      }
    }
  }
  const lines = [];
  for (let l = k, j = N; l > 0; l -= 1) {
    const i = from[l][j];
    lines.unshift(words.slice(i, j).join(" "));
    j = i;
  }
  return lines;
}

async function widest(measure, lines, font) {
  let m = 0;
  for (const l of lines) {
    const { left, width } = await measure(l, font);
    m = Math.max(m, left + width);
  }
  return m;
}

/**
 * Headline size: for each line count, the largest size that fits; take
 * the fewest lines that still reach a comfortable size, else the largest.
 */
async function fitHeadline(measure, text, room, maxSize = TYPE.head.max) {
  const words = text.split(" ");
  const t = TYPE.head;
  await measure.prefetch(spans(words), { family: t.family, weight: t.weight, track: t.track });
  const options = [];
  for (let lines = 1; lines <= t.maxLines; lines += 1) {
    for (let size = maxSize; size >= t.min; size -= 2) {
      const font = { family: t.family, weight: t.weight, size, track: t.track };
      const wrapped = await wrap(measure, words, font, t.maxW);
      const height = size * CAP.display + (wrapped.length - 1) * size * t.lead;
      if (wrapped.length <= lines && height <= room) {
        if (!options.some((o) => o.size === size)) options.push({ size, font });
        break;
      }
    }
  }
  if (!options.length) throw new Error(`og: headline cannot fit: "${text}"`);
  const pick = options.find((o) => o.size >= 68) ?? options.reduce((a, b) => (b.size > a.size ? b : a));
  return { ...pick, lines: await balancedWrap(measure, words, pick.font, t.maxW) };
}

/* ------------------------------------------------------- page text */

function pageWords(file) {
  const html = readFileSync(join(PUBLIC, file), "utf8");
  const mainAt = html.search(/<main\b/i);
  const body = mainAt >= 0 ? html.slice(mainAt) : html;
  const eyebrow = body.match(/<(\w+)[^>]*class="[^"]*\beyebrow\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/i);
  const h1 = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!eyebrow || !h1) throw new Error(`og: ${file} has no hero .eyebrow + h1`);
  const norm = (s) => renderable(s).replace(/\u2011/g, "-").toLowerCase().replace(/\s+/g, " ");
  return { eyebrow: textOf(eyebrow[2]), headline: textOf(h1[1]), contains: (s) => norm(textOf(html)).includes(norm(s)) };
}

/* ------------------------------------------------------------ render */

async function whiteLogo(sharp) {
  const meta = await sharp(LOGO_FILE).metadata();
  const w = Math.min(LOGO_W, meta.width);
  const alpha = await sharp(LOGO_FILE).resize({ width: w, kernel: "lanczos3" }).ensureAlpha().extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
  const png = await sharp({ create: { width: alpha.info.width, height: alpha.info.height, channels: 3, background: C.bg } })
    .joinChannel(alpha.data, { raw: { width: alpha.info.width, height: alpha.info.height, channels: 1 } })
    .png()
    .toBuffer();
  return { href: `data:image/png;base64,${png.toString("base64")}`, w: alpha.info.width, h: alpha.info.height };
}

async function layoutCard(measure, words, card, headMax = TYPE.head.max) {
  const t = TYPE;
  // Eyebrow: one line, shrink to fit, else wrap to two.
  const eyebrowText = words.eyebrow.toUpperCase();
  await measure.prefetch(spans(eyebrowText.split(" ")), { family: t.eyebrow.family, weight: t.eyebrow.weight, track: t.eyebrow.track });
  let eFont = null;
  let eLines = [eyebrowText];
  for (let size = t.eyebrow.max; size >= t.eyebrow.min; size -= 1) {
    const font = { family: t.eyebrow.family, weight: t.eyebrow.weight, size, track: t.eyebrow.track };
    if ((await widest(measure, eLines, font)) <= SAFE_RIGHT - PAD_X) {
      eFont = font;
      break;
    }
  }
  if (!eFont) {
    eFont = { family: t.eyebrow.family, weight: t.eyebrow.weight, size: t.eyebrow.max, track: t.eyebrow.track };
    eLines = await balancedWrap(measure, eyebrowText.split(" "), eFont, SAFE_RIGHT - PAD_X);
  }
  const eLead = eFont.size * 1.35;

  // Sub-line.
  let sLines = [];
  const sFont = { family: t.sub.family, weight: t.sub.weight, size: t.sub.size, track: t.sub.track };
  if (card.sub) {
    await measure.prefetch(spans(card.sub.split(" ")), sFont);
    sLines = await balancedWrap(measure, card.sub.split(" "), sFont, t.sub.maxW);
    if (sLines.length > t.sub.maxLines) throw new Error(`og: sub-line wraps to ${sLines.length} lines: "${card.sub}"`);
  }
  const sLead = sFont.size * t.sub.lead;

  // Vertical budget for the headline.
  const GAP_EH = 30; // eyebrow baseline -> headline cap top
  const GAP_HS = 30; // headline descender -> sub cap top
  const eyebrowH = eFont.size * CAP.emphasis + (eLines.length - 1) * eLead;
  const subH = sLines.length ? GAP_HS + sFont.size * CAP.body + (sLines.length - 1) * sLead + sFont.size * DESC : 0;
  const room = REGION_BOTTOM - REGION_TOP - eyebrowH - GAP_EH - subH - 92 * DESC;
  const head = await fitHeadline(measure, words.headline, room, headMax);
  const hLead = head.size * t.head.lead;
  const headH = head.size * CAP.display + (head.lines.length - 1) * hLead + head.size * DESC;

  // Centre the block in the region.
  const blockH = eyebrowH + GAP_EH + headH + subH;
  const top = REGION_TOP + Math.max(0, (REGION_BOTTOM - REGION_TOP - blockH) / 2);
  const eBase0 = top + eFont.size * CAP.emphasis;
  const eBaseLast = eBase0 + (eLines.length - 1) * eLead;
  const hBase0 = eBaseLast + GAP_EH + head.size * CAP.display;
  const hBaseLast = hBase0 + (head.lines.length - 1) * hLead;
  const sBase0 = hBaseLast + head.size * DESC + GAP_HS + sFont.size * CAP.body;

  const lines = [
    ...eLines.map((text, i) => ({ text, font: eFont, y: eBase0 + i * eLead, fill: C.gold })),
    ...head.lines.map((text, i) => ({ text, font: head.font, y: hBase0 + i * hLead, fill: C.bg })),
    ...sLines.map((text, i) => ({ text, font: sFont, y: sBase0 + i * sLead, fill: C.bg, opacity: 0.88 })),
  ];

  // Overflow check on real ink, at the real sizes: nothing past the safe
  // right edge, and nothing running into the motif's corner.
  const boxes = await measure.exact(lines.map((l) => ({ text: l.text, font: l.font })));
  for (const [i, l] of lines.entries()) {
    const right = PAD_X + boxes[i].left + boxes[i].width;
    if (right > SAFE_RIGHT) throw new Error(`og: "${l.text}" overflows (${n(right)} > ${SAFE_RIGHT})`);
    if (right > MOTIF.left && l.y + l.font.size * DESC > MOTIF.top - 10) {
      // A smaller headline shortens the block; retry before giving up.
      if (head.size - 4 >= t.head.min) return layoutCard(measure, words, card, head.size - 4);
      throw new Error(`og: "${l.text}" runs into the motif`);
    }
  }
  const bottom = (sLines.length ? sBase0 + (sLines.length - 1) * sLead + sFont.size * DESC : hBaseLast + head.size * DESC);
  if (bottom > FOOT_BASE - FOOT_SIZE - 12) throw new Error(`og: text block runs into the footer (${n(bottom)})`);

  return { lines, head, eFont, sFont, bottom };
}

/* The whole logomark, white at 7% (the .band texture's opacity), set low on
 * the right: the right edge cuts through the last blue bar and the lower
 * edge trims the bottom, with both equals bars showing. It sits below the
 * text block (layoutCard shrinks the headline until nothing reaches it), so
 * it never runs behind words. */
const MOTIF = { s: 1.2, top: 506, left: 0 };

function placeMotif(mark) {
  const last = mark.rects[mark.rects.length - 1];
  MOTIF.left = W - MOTIF.s * (last.x + last.w / 2); // right edge halves the last bar
}

function motif(mark) {
  return `<g fill="${C.bg}" opacity="0.07">${markRects(mark, { x: MOTIF.left, y: MOTIF.top, s: MOTIF.s, fill: C.bg }).replace(/ fill="[^"]*"/g, "")}</g>`;
}

export function renderCardSvg({ layout, logo, mark, footer }) {
  const third = W / 3;
  const body = [
    `<defs><linearGradient id="field" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.purpleDeep}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient></defs>`,
    rect({ x: 0, y: 0, w: W, h: H, fill: "url(#field)" }),
    motif(mark),
    // Equality bar: green, purple, blue thirds (as --eo-equality-bar).
    rect({ x: 0, y: 0, w: third, h: BAR_H, fill: C.green }),
    rect({ x: third, y: 0, w: third, h: BAR_H, fill: C.purple }),
    rect({ x: 2 * third, y: 0, w: third, h: BAR_H, fill: C.blue }),
    `<image href="${logo.href}" x="${PAD_X}" y="${LOGO_Y}" width="${logo.w}" height="${logo.h}"/>`,
    ...layout.lines.map((l) => textEl({ x: PAD_X, y: l.y, ...l.font, fill: l.fill, opacity: l.opacity, text: l.text })),
    textEl({
      x: PAD_X,
      y: FOOT_BASE,
      size: FOOT_SIZE,
      family: FONTS.body,
      weight: 600,
      track: 0.02,
      fill: C.bg,
      opacity: 0.88,
      text: footer.join("  \u00B7  "),
    }),
  ].join("");
  return svg({ w: W, h: H, body });
}

/**
 * Render every card. Returns the alt-text manifest the head generator reads
 * (scripts/art/og-cards.json).
 */
export async function buildOgCards(sharp) {
  const measure = makeMeasurer(sharp);
  const mark = await measureMark(sharp);
  placeMotif(mark);
  const logo = await whiteLogo(sharp);
  const manifest = {};
  for (const [key, card] of Object.entries(OG_CARDS)) {
    const words = pageWords(card.page);
    // The domain is the site's own address (SITE_URL), not page copy.
    for (const s of [card.sub, ...(card.footer ?? [])].filter((s) => s && s !== DOMAIN)) {
      if (!words.contains(s)) throw new Error(`og: "${s}" (card ${key}) is not in public/${card.page}`);
    }
    const footer = card.footer ?? [DOMAIN];
    const layout = await layoutCard(measure, words, card);
    const cardSvg = renderCardSvg({ layout, logo, mark, footer });
    if (process.env.EO_ART_DEBUG) writeFileSync(join(process.env.EO_ART_DEBUG, `og-${key}.svg`), cardSvg);
    // 256-colour palette PNG (about 40% of truecolor). quality 100 lets
    // libimagequant use the whole palette; at 95 it posterized a patch of
    // the gradient, so the result is compared against the truecolor render
    // and rejected if any channel drifts by more than 12/255.
    const truecolor = await sharp(Buffer.from(cardSvg)).removeAlpha().raw().toBuffer();
    const png = await sharp(Buffer.from(cardSvg))
      .png({ palette: true, quality: 100, effort: 10, compressionLevel: 9, dither: 1 })
      .toBuffer();
    const decoded = await sharp(png).removeAlpha().raw().toBuffer();
    let maxErr = 0;
    for (let i = 0; i < decoded.length; i += 1) maxErr = Math.max(maxErr, Math.abs(decoded[i] - truecolor[i]));
    if (maxErr > 12) throw new Error(`og: ${key} palette quantization error ${maxErr}/255`);
    const rel = `assets/og/${key}.png`;
    writePublic(rel, png);
    // Alt text = the card's message in reading order: the logo, eyebrow,
    // headline and sub-line (footer contact lines are left out; lib/seo.mjs
    // mirrors these strings and check:pages compares them).
    const sentence = (t) => `${t.replace(/[.!?]$/, "")}.`;
    const alt = ["Equality Ohio.", sentence(words.eyebrow), sentence(words.headline), card.sub ? sentence(card.sub) : ""]
      .filter(Boolean)
      .join(" ")
      .replace(/\u2011/g, "-");
    manifest[key] = {
      image: `/${rel}`,
      width: W,
      height: H,
      type: "image/png",
      alt,
      source: `public/${card.page}`,
      eyebrow: words.eyebrow,
      headline: words.headline,
      sub: card.sub ?? null,
      headlineSize: layout.head.size,
    };
  }
  return manifest;
}
