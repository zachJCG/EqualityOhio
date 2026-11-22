/*
 * Brand faces for rasterized type (the share cards).
 *
 * sharp rasterizes SVG with librsvg, which finds fonts through fontconfig.
 * librsvg cannot read woff2, so registerBrandFonts() unpacks the site's own
 * self-hosted files (public/assets/fonts/*.woff2) to TTF with wawoff2 into
 * a temp dir, writes a fonts.conf that lists ONLY that dir, and points
 * FONTCONFIG_FILE at it. The cards are therefore set in exactly the faces
 * the site serves, and a missing glyph shows up as a visible gap instead of
 * silently falling back to whatever the machine has installed.
 *
 * Call it before the first sharp text render (fontconfig reads the env var
 * once, on first use).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PUBLIC } from "./kit.mjs";

/*
 * Family names as fontconfig reads them from the @fontsource static
 * instances. The Montserrat and League Spartan files are cut from the
 * variable fonts and keep the default instance's family name ("... Thin");
 * the weight still comes from the file (ExtraBold is fontconfig weight 205,
 * selected by CSS font-weight 800). Verified with fc-scan.
 */
export const FONTS = {
  display: "Montserrat Thin, Montserrat", // headlines, 800
  emphasis: "League Spartan Thin, League Spartan", // eyebrows, 700, uppercase
  body: "Open Sans", // sub-lines, 400/600
};

export async function registerBrandFonts() {
  const { decompress } = await import("wawoff2");
  const srcDir = join(PUBLIC, "assets", "fonts");
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".woff2")).sort();
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update(readFileSync(join(srcDir, f)));
  const dir = join(tmpdir(), `eo-art-fonts-${hash.digest("hex").slice(0, 12)}`);
  mkdirSync(dir, { recursive: true });
  for (const f of files) {
    const out = join(dir, f.replace(/\.woff2$/, ".ttf"));
    if (!existsSync(out)) writeFileSync(out, Buffer.from(await decompress(readFileSync(join(srcDir, f)))));
  }
  const conf = join(dir, "fonts.conf");
  writeFileSync(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${dir}</dir><cachedir>${join(dir, "cache")}</cachedir></fontconfig>\n`,
  );
  process.env.FONTCONFIG_FILE = conf;
  return { dir, count: files.length };
}
