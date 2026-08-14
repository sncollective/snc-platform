import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_DIR = resolve(import.meta.dirname, "../../../src");
const TOKENS_DIR = resolve(SOURCE_DIR, "styles/tokens");

const COLOR_NAMES = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
  crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
  dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
  magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`
    .split(/\s+/)
    .filter(Boolean),
);

const SANCTIONED_KEYWORDS = new Set(["transparent", "currentcolor"]);
const COLOR_FUNCTION_PATTERN =
  /\b(?:color-mix|light-dark|device-cmyk|oklab|oklch|rgba?|hsla?|hwb|lab|lch|color)\s*\(/gi;
const HEX_PATTERN = /(?<![\w-])#[\da-f]{3,8}\b/gi;
const NAMED_COLOR_PATTERN = new RegExp(
  `(?<![-\\w])(?:${[...COLOR_NAMES, ...SANCTIONED_KEYWORDS]
    .sort((left, right) => right.length - left.length)
    .join("|")})(?![-\\w])`,
  "gi",
);
const DECLARATION_PATTERN = /(?:^|[;{])\s*[-\w]+\s*:\s*([^;{}]+)(?:;|(?=\}))/gm;
const TSX_COLOR_PROPERTY_PATTERN =
  /\b(?:accentColor|background|backgroundColor|borderColor|caretColor|color|fill|outlineColor|stroke|textDecorationColor)\s*:\s*([^,}\n]+)/g;
const JSX_COLOR_ATTRIBUTE_PATTERN =
  /\b(?:color|fill|stroke)\s*=\s*("[^"]*"|'[^']*'|`[^`]*`|\{[^}\n]*\})/g;
const SIMPLE_ICONS_HEX_PATTERN = /`#\$\{si[A-Za-z]+\.hex\}`/g;
const DIRECT_VOICE_CONSUMER_PATTERN = /var\((--voice-[\w-]+)\)/g;
const DEPRECATED_VOCABULARY_PATTERN =
  /--(?:legacy-public-chart-[\w-]+|color-(?:primary(?:-text|-subtle)?|muted|text-primary|text-secondary|text-on-accent|text-on-color|bg-alt|secondary(?:-bg|-subtle)?|bg-hover|surface-hover|bg-hero-gradient|overlay-dark|badge-(?:audio|video|written)-bg)|overlay-lock|font-(?:ui|heading)|font-size-md|shadow-dropdown)\b/g;

const SIMPLE_ICONS_FILE = "components/social-links/platform-icon.tsx";
const CREATOR_BRAND_FILE = "routes/creators/$creatorId/manage/-press-editor.tsx";

/*
 * Exact-path, fail-closed exemptions. Signature chips do not exist yet; this reserved owner is
 * the only non-token CSS file that may define a literal signature treatment when introduced.
 */
const SANCTIONED_SIGNATURE_CHIP_FILES = new Set([
  "components/brand/signature-chip.module.css",
]);

const SOURCE_EXTENSIONS = new Set([".css", ".ts", ".tsx"]);

type ColorSyntax = "dynamic" | "function" | "hex" | "named";

interface ColorMatch {
  readonly syntax: ColorSyntax;
  readonly value: string;
  readonly offset: number;
}

interface ScanResult {
  readonly violations: readonly ColorMatch[];
  readonly sanctionedKeywords: ReadonlySet<string>;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    return entry.isFile() && SOURCE_EXTENSIONS.has(extension) ? [path] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function findValueMatches(value: string, baseOffset: number): ScanResult {
  const violations: ColorMatch[] = [];
  const sanctionedKeywords = new Set<string>();

  for (const match of value.matchAll(HEX_PATTERN)) {
    violations.push({ syntax: "hex", value: match[0], offset: baseOffset + match.index });
  }
  for (const match of value.matchAll(COLOR_FUNCTION_PATTERN)) {
    violations.push({ syntax: "function", value: match[0], offset: baseOffset + match.index });
  }
  for (const match of value.matchAll(NAMED_COLOR_PATTERN)) {
    const normalized = match[0].toLowerCase();
    if (SANCTIONED_KEYWORDS.has(normalized)) {
      sanctionedKeywords.add(normalized);
    } else {
      violations.push({ syntax: "named", value: match[0], offset: baseOffset + match.index });
    }
  }

  return { violations, sanctionedKeywords };
}

function mergeResults(results: readonly ScanResult[]): ScanResult {
  return {
    violations: results.flatMap(({ violations }) => violations),
    sanctionedKeywords: new Set(results.flatMap(({ sanctionedKeywords }) => [...sanctionedKeywords])),
  };
}

function findCssColorMatches(css: string): ScanResult {
  const source = stripComments(css);
  return mergeResults(
    [...source.matchAll(DECLARATION_PATTERN)].map((declaration) => {
      const value = declaration[1] ?? "";
      return findValueMatches(value, declaration.index + declaration[0].indexOf(value));
    }),
  );
}

function findTsxColorMatches(tsx: string): ScanResult {
  const source = stripComments(tsx);
  const results: ScanResult[] = [];

  for (const property of source.matchAll(TSX_COLOR_PROPERTY_PATTERN)) {
    const value = property[1] ?? "";
    const offset = property.index + property[0].indexOf(value);
    const result = findValueMatches(value, offset);
    const isTokenReference = /["'`]var\(--[\w-]+\)["'`]/.test(value);
    if (result.violations.length === 0 && !isTokenReference) {
      results.push({
        violations: [{ syntax: "dynamic", value: value.trim(), offset }],
        sanctionedKeywords: result.sanctionedKeywords,
      });
    } else {
      results.push(result);
    }
  }

  for (const attribute of source.matchAll(JSX_COLOR_ATTRIBUTE_PATTERN)) {
    const value = attribute[1] ?? "";
    const offset = attribute.index + attribute[0].indexOf(value);
    const result = findValueMatches(value, offset);
    const isTokenReference = /["'`]var\(--[\w-]+\)["'`]/.test(value);
    const isNoPaint = /^["'`]none["'`]$/i.test(value);
    if (result.violations.length === 0 && !isTokenReference && !isNoPaint) {
      results.push({
        violations: [{ syntax: "dynamic", value, offset }],
        sanctionedKeywords: result.sanctionedKeywords,
      });
    } else {
      results.push(result);
    }
  }

  for (const expression of source.matchAll(SIMPLE_ICONS_HEX_PATTERN)) {
    results.push({
      violations: [{ syntax: "dynamic", value: expression[0], offset: expression.index }],
      sanctionedKeywords: new Set(),
    });
  }

  return mergeResults(results);
}

function lineNumberAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function sourcePath(file: string): string {
  return relative(SOURCE_DIR, file);
}

function isTokenDefinition(file: string): boolean {
  return sourcePath(file).split("/").slice(0, 2).join("/") === "styles/tokens";
}

function isExplicitlyAllowed(file: string, match: ColorMatch): boolean {
  const path = sourcePath(file);
  if (path === SIMPLE_ICONS_FILE) {
    return match.syntax === "dynamic" && /(?:si[A-Za-z]+\.hex|icon\.hex)/.test(match.value);
  }
  if (path === CREATOR_BRAND_FILE) {
    return match.syntax === "dynamic" && /^(?:brandColor|color)(?:\s*\?\?)?/.test(match.value);
  }
  return SANCTIONED_SIGNATURE_CHIP_FILES.has(path);
}

function scanFile(file: string): ScanResult {
  const source = readFileSync(file, "utf-8");
  return file.endsWith(".css") ? findCssColorMatches(source) : findTsxColorMatches(source);
}

function formatViolation(file: string, source: string, match: ColorMatch): string {
  return `${sourcePath(file)}:${lineNumberAt(source, match.offset)} ${match.syntax} ${match.value}`;
}

describe("authored color boundary", () => {
  it("recognizes every governed CSS and CSS-in-TSX syntax", () => {
    const css = `
      .sample {
        --hex: #abc;
        --rgb: rgb(1 2 3 / 40%);
        --hsl: hsl(20 30% 40%);
        --named: white;
        --modern: color-mix(in srgb, red, transparent);
        border-color: currentColor;
      }
    `;
    const tsx = `
      <div style={{ color: "#abc", backgroundColor: "rgb(1 2 3)",
        borderColor: "hsl(20 30% 40%)", outlineColor: "white",
        textDecorationColor: "oklch(50% 0.2 30)" }} />
    `;

    expect(findCssColorMatches(css).violations.map(({ syntax }) => syntax)).toEqual([
      "hex",
      "function",
      "function",
      "named",
      "function",
      "named",
    ]);
    expect(findCssColorMatches(css).sanctionedKeywords).toEqual(
      new Set(["transparent", "currentcolor"]),
    );
    expect(findTsxColorMatches(tsx).violations.map(({ syntax }) => syntax)).toEqual([
      "hex",
      "function",
      "function",
      "named",
      "function",
    ]);
  });

  it("keeps raw pigments and derivations inside explicit owners across CSS and TSX", () => {
    const violations = sourceFiles(SOURCE_DIR).flatMap((file) => {
      if (isTokenDefinition(file)) return [];
      const source = readFileSync(file, "utf-8");
      return scanFile(file).violations
        .filter((match) => !isExplicitlyAllowed(file, match))
        .map((match) => formatViolation(file, source, match));
    });

    expect(violations).toEqual([]);
  });

  it("limits dynamic color exemptions to Simple Icons and creator-authored brand injection", () => {
    const allowed = sourceFiles(SOURCE_DIR).flatMap((file) =>
      scanFile(file).violations
        .filter((match) => isExplicitlyAllowed(file, match))
        .map((match) => `${sourcePath(file)} ${match.value}`),
    );

    expect(allowed.some((entry) => entry.startsWith(`${SIMPLE_ICONS_FILE} `))).toBe(true);
    expect(allowed.some((entry) => entry.startsWith(`${CREATOR_BRAND_FILE} `))).toBe(true);
  });

  it("continues to inventory transparent and currentColor as semantic keywords", () => {
    const sanctioned = new Set(
      sourceFiles(SOURCE_DIR)
        .filter((file) => file.endsWith(".css") && !isTokenDefinition(file))
        .flatMap((file) => [...scanFile(file).sanctionedKeywords]),
    );

    expect(sanctioned).toEqual(new Set(["transparent", "currentcolor"]));
  });

  it("confines direct voice consumption to the route resolver or an exact signature chip", () => {
    const violations = sourceFiles(SOURCE_DIR).flatMap((file) => {
      if (isTokenDefinition(file)) return [];
      const path = sourcePath(file);
      const source = readFileSync(file, "utf-8");
      return [...source.matchAll(DIRECT_VOICE_CONSUMER_PATTERN)]
        .filter((match) => {
          const token = match[1] ?? "";
          return !(
            SANCTIONED_SIGNATURE_CHIP_FILES.has(path) &&
            /^--voice-(?:parent|studio|tv|records)-accent2$/.test(token)
          );
        })
        .map((match) => `${path}:${lineNumberAt(source, match.index)} ${match[1]}`);
    });

    expect(violations).toEqual([]);
  });

  it("deletes compatibility vocabulary and legacy token owners", () => {
    const allSource = sourceFiles(SOURCE_DIR)
      .map((file) => readFileSync(file, "utf-8"))
      .join("\n");
    const globalCss = readFileSync(resolve(SOURCE_DIR, "styles/global.css"), "utf-8");

    expect([...allSource.matchAll(DEPRECATED_VOCABULARY_PATTERN)].map(([name]) => name)).toEqual([]);
    expect(existsSync(resolve(TOKENS_DIR, "color.css"))).toBe(false);
    expect(existsSync(resolve(TOKENS_DIR, "legacy"))).toBe(false);
    expect([...globalCss.matchAll(/@import\s+["']([^"']+)["']/g)].map((match) => match[1])).toEqual([
      "./tokens/index.css",
    ]);
  });
});
