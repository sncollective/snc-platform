import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const TOKENS_DIR = resolve(import.meta.dirname, "../../../src/styles/tokens");
const FONTS_CSS = resolve(TOKENS_DIR, "fonts.css");
const TYPOGRAPHY_CSS = resolve(TOKENS_DIR, "typography.css");
const ROOT_ROUTE = resolve(import.meta.dirname, "../../../src/routes/__root.tsx");

const fontPackageRoot = (packageName: string): string =>
  dirname(require.resolve(`${packageName}/package.json`));

const FONT_FILES = {
  sourceSansRoman: resolve(
    fontPackageRoot("@fontsource-variable/source-sans-3"),
    "files/source-sans-3-latin-wght-normal.woff2",
  ),
  sourceSansItalic: resolve(
    fontPackageRoot("@fontsource-variable/source-sans-3"),
    "files/source-sans-3-latin-wght-italic.woff2",
  ),
  newsreaderRoman: resolve(
    fontPackageRoot("@fontsource-variable/newsreader"),
    "files/newsreader-latin-wght-normal.woff2",
  ),
  sairaRoman: resolve(
    fontPackageRoot("@fontsource-variable/saira"),
    "files/saira-latin-wght-normal.woff2",
  ),
  sairaItalic: resolve(
    fontPackageRoot("@fontsource-variable/saira"),
    "files/saira-latin-wght-italic.woff2",
  ),
  archivoRoman: resolve(
    fontPackageRoot("@fontsource-variable/archivo"),
    "files/archivo-latin-wght-normal.woff2",
  ),
  barlowRoman: resolve(
    fontPackageRoot("@fontsource/barlow-condensed"),
    "files/barlow-condensed-latin-400-normal.woff2",
  ),
  fragmentMonoRoman: resolve(
    fontPackageRoot("@fontsource/fragment-mono"),
    "files/fragment-mono-latin-400-normal.woff2",
  ),
  frauncesRoman: resolve(
    fontPackageRoot("@fontsource-variable/fraunces"),
    "files/fraunces-latin-wght-normal.woff2",
  ),
} as const;

const LATIN_EXT_FILES = {
  sourceSans: resolve(
    fontPackageRoot("@fontsource-variable/source-sans-3"),
    "files/source-sans-3-latin-ext-wght-normal.woff2",
  ),
  newsreader: resolve(
    fontPackageRoot("@fontsource-variable/newsreader"),
    "files/newsreader-latin-ext-wght-normal.woff2",
  ),
  saira: resolve(
    fontPackageRoot("@fontsource-variable/saira"),
    "files/saira-latin-ext-wght-normal.woff2",
  ),
  archivo: resolve(
    fontPackageRoot("@fontsource-variable/archivo"),
    "files/archivo-latin-ext-wght-normal.woff2",
  ),
  barlow: resolve(
    fontPackageRoot("@fontsource/barlow-condensed"),
    "files/barlow-condensed-latin-ext-400-normal.woff2",
  ),
  fragmentMono: resolve(
    fontPackageRoot("@fontsource/fragment-mono"),
    "files/fragment-mono-latin-ext-400-normal.woff2",
  ),
  fraunces: resolve(
    fontPackageRoot("@fontsource-variable/fraunces"),
    "files/fraunces-latin-ext-wght-normal.woff2",
  ),
} as const;

/**
 * Read the cmap exposed by fontconfig rather than trusting a package metadata
 * file. This keeps the test honest about the actual WOFF2 glyph table. The
 * production test image is Linux (as is CI), where fc-query is installed.
 */
function cmap(file: string): string {
  return execFileSync("fc-query", ["--format=%{charset}", file], {
    encoding: "utf8",
  });
}

function cmapHas(cmapText: string, codepoint: number): boolean {
  return cmapText.split(/\s+/).some((range) => {
    if (!range) return false;
    const [startText, endText = startText] = range.split("-");
    const start = Number.parseInt(startText ?? "", 16);
    const end = Number.parseInt(endText ?? "", 16);
    return Number.isFinite(start) && Number.isFinite(end) && codepoint >= start && codepoint <= end;
  });
}

describe("font loading contract", () => {
  it("imports only the approved manifest faces and disables synthetic styles", () => {
    const fontCss = readFileSync(FONTS_CSS, "utf8");
    const typographyCss = readFileSync(TYPOGRAPHY_CSS, "utf8");

    expect(fontCss).toContain('@import "@fontsource-variable/source-sans-3/wght.css";');
    expect(fontCss).toContain('@import "@fontsource-variable/source-sans-3/wght-italic.css";');
    expect(fontCss).toContain('@import "@fontsource-variable/newsreader/wght.css";');
    expect(fontCss).toContain('@import "@fontsource-variable/saira/wght.css";');
    expect(fontCss).toContain('@import "@fontsource-variable/saira/wght-italic.css";');
    expect(fontCss).toContain('@import "@fontsource-variable/archivo/wght.css";');
    expect(fontCss).toContain('@import "@fontsource-variable/fraunces/wght.css";');
    expect(fontCss).toContain('@import "@fontsource/barlow-condensed/400.css";');
    expect(fontCss).toContain('@import "@fontsource/barlow-condensed/700.css";');
    expect(fontCss).toContain('@import "@fontsource/fragment-mono/400.css";');
    expect(fontCss).toContain("font-synthesis: none");
    expect(fontCss).not.toContain("unicode-range:");
    expect(typographyCss).not.toMatch(/size-adjust|ascent-override|descent-override/);
  });

  it("maps every voice to its Fontsource family and exact fallback order", async () => {
    const typography = readFileSync(TYPOGRAPHY_CSS, "utf8");

    expect(typography).toContain('--font-body-parent: "Source Sans 3 Variable", Arial, sans-serif;');
    expect(typography).toContain('--font-display-parent: "Source Sans 3 Variable", Arial, sans-serif;');
    expect(typography).toContain('--font-body-studio: "Newsreader Variable", Georgia, "Times New Roman", serif;');
    expect(typography).toContain('--font-display-studio: "Newsreader Variable", Georgia, "Times New Roman", serif;');
    expect(typography).toContain('--font-body-tv: "Saira Variable", "Arial Narrow", Arial, sans-serif;');
    expect(typography).toContain('--font-display-tv: "Saira Variable", "Arial Narrow", Arial, sans-serif;');
    expect(typography).toContain('--font-body-records: "Archivo Variable", Arial, sans-serif;');
    expect(typography).toContain('--font-display-records: "Barlow Condensed", "Arial Narrow", Arial, sans-serif;');
    expect(typography).toContain('--font-display-showcase: "Fraunces Variable", Georgia, "Times New Roman", serif;');
    expect(typography).toContain('--font-mono: "Fragment Mono", "Cascadia Mono", "Liberation Mono", "Courier New", monospace;');
  });

  it("preloads only Source Sans 3 Roman and contains no Google font request", async () => {
    const root = readFileSync(ROOT_ROUTE, "utf8");

    expect(root).toContain("source-sans-3-latin-wght-normal.woff2?url");
    expect(root).toContain('rel: "preload"');
    expect(root).toContain('as: "font"');
    expect(root).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });

  it.each([
    ["Source Sans 3 Roman", FONT_FILES.sourceSansRoman],
    ["Source Sans 3 italic", FONT_FILES.sourceSansItalic],
    ["Newsreader Roman", FONT_FILES.newsreaderRoman],
    ["Saira Roman", FONT_FILES.sairaRoman],
    ["Saira italic", FONT_FILES.sairaItalic],
    ["Archivo Roman", FONT_FILES.archivoRoman],
    ["Barlow Condensed Roman", FONT_FILES.barlowRoman],
    ["Fragment Mono Roman", FONT_FILES.fragmentMonoRoman],
    ["Fraunces Roman", FONT_FILES.frauncesRoman],
  ] as const)("reads real %s WOFF2 cmap for the middle-dot chip glyph", (_name, file) => {
    expect(cmap(file), `${file} should be a real WOFF2 font`).toBeTruthy();
    expect(cmapHas(cmap(file), 0x00b7), `${file} should cover U+00B7 (·)`).toBe(true);
  });

  it("verifies latin-ext creator-name glyphs in every shipped latin-ext face", () => {
    const creatorFixture = "Žluťoučký kůň";
    expect(creatorFixture).toContain("č");

    for (const [family, file] of Object.entries(LATIN_EXT_FILES)) {
      expect(cmapHas(cmap(file), 0x010d), `${family} should cover U+010D (č)`).toBe(true);
    }
  });

  it("verifies the showcase number-sign fixture uses its named serif fallback", () => {
    const showcaseFixture = "№ 01";
    expect(showcaseFixture).toContain("№");
    expect(cmapHas(cmap(FONT_FILES.frauncesRoman), 0x2116)).toBe(false);

    const fallbackFile = execFileSync("fc-match", ["--format=%{file}", "Georgia"], {
      encoding: "utf8",
    });
    expect(fallbackFile).toBeTruthy();
    expect(cmapHas(cmap(fallbackFile), 0x2116)).toBe(true);
  });

  it("verifies the live-dot fixture uses the named fallback rather than an absent primary glyph", () => {
    const liveFixture = "● LIVE";
    expect(liveFixture).toContain("●");

    const primaryHasLiveDot = Object.values(FONT_FILES).some((file) => cmapHas(cmap(file), 0x25cf));
    expect(primaryHasLiveDot).toBe(false);

    const fallbackFile = execFileSync("fc-match", ["--format=%{file}", "Arial"], {
      encoding: "utf8",
    });
    expect(fallbackFile).toBeTruthy();
    expect(cmapHas(cmap(fallbackFile), 0x25cf)).toBe(true);
  });
});
