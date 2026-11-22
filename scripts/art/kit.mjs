/*
 * Equality Ohio art kit: the shared vocabulary for every generated asset
 * (icons, share cards, textures, responsive images).
 *
 * The palette is NOT mirrored here by hand. `C` is read at import time from
 * public/css/eo-brand-tokens.css with a regex over the `--eo-*:` hex
 * declarations, plus the aliases that name another token
 * (`--eo-bg: var(--eo-white);`), so a token change is one CSS edit plus
 * `npm run assets`. Keys are camelCased token names: --eo-purple-deep
 * becomes C.purpleDeep. tests/art-kit.test.mjs imports this module, so a
 * token the art needs that stops resolving fails `npm test`.
 *
 * Everything here is plain string and file helpers. Nothing rasterizes;
 * the modules that need sharp import it themselves.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PUBLIC = join(ROOT, "public");
export const TOKENS_FILE = join(PUBLIC, "css", "eo-brand-tokens.css");

/* ------------------------------------------------------------- palette */

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/**
 * Every `--eo-name: #hex;` declaration in the tokens file, camelCased, and
 * every `--eo-name: var(--eo-other);` alias resolved to its hex (aliases of
 * aliases too). A hex declaration wins over an alias of the same name.
 */
export function readTokens(file = TOKENS_FILE) {
  const css = readFileSync(file, "utf8");
  const out = {};
  for (const m of css.matchAll(/--eo-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[camel(m[1])] = m[2].toUpperCase();
  }
  const aliases = [...css.matchAll(/--eo-([a-z0-9-]+)\s*:\s*var\(\s*--eo-([a-z0-9-]+)\s*\)\s*;/g)]
    .map((m) => [camel(m[1]), camel(m[2])]);
  for (let pass = 0, resolved = true; resolved && pass < aliases.length; pass++) {
    resolved = false;
    for (const [name, target] of aliases) {
      if (!out[name] && out[target]) {
        out[name] = out[target];
        resolved = true;
      }
    }
  }
  return out;
}

export const C = readTokens();

// The art below depends on these; fail loudly if a rename drops one.
for (const k of ["purple", "blue", "green", "purpleDeep", "gold", "bg", "ink"]) {
  if (!C[k]) throw new Error(`kit.mjs: --eo-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())} missing from ${relative(ROOT, TOKENS_FILE)}`);
}

/** #RRGGBB -> { r, g, b } (0-255). */
export function rgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

/* ---------------------------------------------------------------- svg */

/** Round to 2 decimals so generated SVG is short and stable. */
export const n = (v) => Math.round(v * 100) / 100;

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function svg({ w, h, body, viewBox = `0 0 ${w} ${h}`, title, size = true }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size ? ` width="${w}" height="${h}"` : ""}${title ? ` role="img" aria-label="${esc(title)}"` : ""}>`,
    title ? `<title>${esc(title)}</title>` : "",
    body,
    `</svg>`,
  ].join("");
}

export function rect({ x, y, w, h, fill, r = 0, opacity }) {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ""}${fill ? ` fill="${fill}"` : ""}${opacity != null ? ` opacity="${opacity}"` : ""}/>`;
}

export function group(children, attrs = "") {
  return `<g${attrs ? ` ${attrs}` : ""}>${children.filter(Boolean).join("")}</g>`;
}

/* ------------------------------------------------------------- html text */

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00A0",
  rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201D", ldquo: "\u201C",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", middot: "\u00B7",
  rarr: "\u2192", larr: "\u2190", copy: "\u00A9", reg: "\u00AE", trade: "\u2122",
};

/** Decode the entities EO's pages use (named + numeric). */
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Strip tags, decode entities, collapse whitespace. */
export function textOf(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------- files */

const report = [];

/**
 * Write `contents` to public/<rel> only when the bytes differ, so a second
 * run is a no-op (idempotent: no mtime churn, no diff).
 */
export function writePublic(rel, contents, root = PUBLIC) {
  const abs = join(root, rel);
  const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  const prev = existsSync(abs) ? readFileSync(abs) : null;
  const changed = !prev || !prev.equals(buf);
  if (changed) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, buf);
  }
  report.push({ path: relative(ROOT, abs), bytes: buf.length, changed, sha: createHash("sha256").update(buf).digest("hex").slice(0, 12) });
  return abs;
}

export function writtenReport() {
  return report;
}
