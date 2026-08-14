import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_DIR = resolve(import.meta.dirname, "../../../src");

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

type ColorSyntax = "hex" | "function" | "named";

interface ColorMatch {
  readonly syntax: ColorSyntax;
  readonly value: string;
  readonly offset: number;
}

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function findColorMatches(css: string): {
  readonly violations: readonly ColorMatch[];
  readonly sanctionedKeywords: ReadonlySet<string>;
} {
  const source = stripComments(css);
  const violations: ColorMatch[] = [];
  const sanctionedKeywords = new Set<string>();

  for (const match of source.matchAll(HEX_PATTERN)) {
    violations.push({ syntax: "hex", value: match[0], offset: match.index });
  }
  for (const match of source.matchAll(COLOR_FUNCTION_PATTERN)) {
    violations.push({ syntax: "function", value: match[0], offset: match.index });
  }
  for (const declaration of source.matchAll(DECLARATION_PATTERN)) {
    const value = declaration[1] ?? "";
    const valueOffset = declaration.index + declaration[0].indexOf(value);
    for (const match of value.matchAll(NAMED_COLOR_PATTERN)) {
      const normalized = match[0].toLowerCase();
      if (SANCTIONED_KEYWORDS.has(normalized)) {
        sanctionedKeywords.add(normalized);
      } else {
        violations.push({
          syntax: "named",
          value: match[0],
          offset: valueOffset + match.index,
        });
      }
    }
  }

  return { violations, sanctionedKeywords };
}

function lineNumberAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function isTokenDefinition(file: string): boolean {
  return relative(SOURCE_DIR, file).split("/").slice(0, 2).join("/") === "styles/tokens";
}

describe("authored CSS color boundary", () => {
  it("recognizes every governed syntax while classifying semantic keywords", () => {
    const sample = `
      .sample {
        --hex: #abc;
        --rgb: rgb(1 2 3 / 40%);
        --hsl: hsl(20 30% 40%);
        --named: white;
        --modern: color-mix(in srgb, red, transparent);
        border-color: currentColor;
      }
    `;
    const result = findColorMatches(sample);

    expect(result.violations.map(({ syntax }) => syntax)).toEqual([
      "hex",
      "function",
      "function",
      "function",
      "named",
      "named",
    ]);
    expect(result.sanctionedKeywords).toEqual(new Set(["transparent", "currentcolor"]));
  });

  it("keeps raw pigments and color derivations inside token-definition files", () => {
    const violations = cssFiles(SOURCE_DIR).flatMap((file) => {
      if (isTokenDefinition(file)) return [];

      const source = readFileSync(file, "utf-8");
      return findColorMatches(source).violations.map(
        ({ syntax, value, offset }) =>
          `${relative(SOURCE_DIR, file)}:${lineNumberAt(source, offset)} ${syntax} ${value}`,
      );
    });

    expect(violations).toEqual([]);
  });

  it("continues to inventory transparent and currentColor as sanctioned semantic keywords", () => {
    const sanctioned = new Set(
      cssFiles(SOURCE_DIR)
        .filter((file) => !isTokenDefinition(file))
        .flatMap((file) => [
          ...findColorMatches(readFileSync(file, "utf-8")).sanctionedKeywords,
        ]),
    );

    expect(sanctioned).toEqual(new Set(["transparent", "currentcolor"]));
  });

  it("retires generic secondary and confines public chart colors to the owner-expiry bridge", () => {
    const allCss = cssFiles(SOURCE_DIR).map((file) => readFileSync(file, "utf-8")).join("\n");
    const dataTokens = readFileSync(
      resolve(SOURCE_DIR, "styles/tokens/color/data.css"),
      "utf-8",
    );
    const publicCharts = [
      "components/emissions/emissions-chart.module.css",
      "components/dashboard/revenue-chart.module.css",
    ].map((file) => readFileSync(resolve(SOURCE_DIR, file), "utf-8"));

    expect(allCss).not.toMatch(/--color-secondary(?:-|\b)/);
    expect(dataTokens).toContain("Lint exemption owner: brand-token-architecture");
    expect(dataTokens).toContain("Expiry: org public-chart palette delivery");
    for (const chart of publicCharts) {
      expect(chart).toContain("--legacy-public-chart-");
      expect(chart).not.toMatch(/--color-(?:accent|accent-hover|secondary|success|error)\b/);
    }
  });
});
