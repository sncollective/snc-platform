import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const TOKENS_DIR = resolve(import.meta.dirname, "../../../src/styles/tokens");
const GLOBAL_CSS = resolve(import.meta.dirname, "../../../src/styles/global.css");
const ROOT_ROUTE = resolve(import.meta.dirname, "../../../src/routes/__root.tsx");

const COMPOSED_TOKEN_FILES = [
  "color.css",
  "legacy/radius.css",
  "fonts.css",
  "color/spine.css",
  "color/status.css",
  "color/state.css",
  "color/media.css",
  "color/badges.css",
  "color/data.css",
  "color/preview.css",
  "color/illustration.css",
  "color/creator.css",
  "voices/families.css",
  "typography.css",
  "radius.css",
  "geometry.css",
  "voices/resolution.css",
  "spacing.css",
  "elevation.css",
  "motion.css",
  "breakpoints.css",
] as const;

const CANONICAL_OWNER_FILES = COMPOSED_TOKEN_FILES.filter(
  (file) => file !== "color.css" && !file.startsWith("legacy/"),
);

const MODE_FILES = [
  "color/spine.css",
  "color/status.css",
  "color/state.css",
  "color/media.css",
  "color/badges.css",
  "color/data.css",
  "color/illustration.css",
  "color/creator.css",
  "voices/families.css",
  "elevation.css",
] as const;

const VOICES = ["parent", "studio", "tv", "records"] as const;
const VOICE_COLOR_ROLES = [
  "accent",
  "accent-hover",
  "accent-bg",
  "accent-subtle",
  "on-accent",
  "accent2",
] as const;

function readTokenFile(file: string): string {
  return readFileSync(resolve(TOKENS_DIR, file), "utf-8");
}

function declarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1] as string,
      (match[2] as string).replace(/\s+/g, " ").trim(),
    ]),
  );
}

function modeBlock(content: string, mode: "light" | "dark" | "fallback"): string {
  const patterns = {
    light: /:root\s*,\s*\[data-theme=["']light["']\]\s*\{([^}]*)\}/,
    dark: /\[data-theme=["']dark["']\]\s*\{([^}]*)\}/,
    fallback:
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[\s\S]*?:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/,
  } as const;

  const match = content.match(patterns[mode]);
  expect(match, `missing ${mode} mode block`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("design token composition", () => {
  it("uses index.css as the sole global token entry", () => {
    const globalCss = readFileSync(GLOBAL_CSS, "utf-8");
    const imports = [...globalCss.matchAll(/@import\s+["']([^"']+)["'];/g)].map(
      (match) => match[1],
    );

    expect(imports).toEqual(["./tokens/index.css"]);
  });

  it("composes every token file through existing import targets", () => {
    const index = readTokenFile("index.css");
    const imports = [...index.matchAll(/@import\s+["']([^"']+)["'];/g)].map(
      (match) => match[1]?.replace(/^\.\//, ""),
    );

    expect(imports).toEqual(COMPOSED_TOKEN_FILES);
    for (const file of imports) {
      expect(existsSync(resolve(TOKENS_DIR, file as string)), `${file} should exist`).toBe(true);
    }
  });

  it("loads transitional vocabulary before canonical role owners", () => {
    const index = readTokenFile("index.css");

    expect(index.indexOf('@import "./color.css"')).toBeLessThan(
      index.indexOf('@import "./color/spine.css"'),
    );
    expect(index.indexOf('@import "./color.css"')).toBeLessThan(
      index.indexOf('@import "./color/status.css"'),
    );
  });

  it("gives first-paint appearance ownership to the bootstrap before HeadContent", () => {
    const rootRoute = readFileSync(ROOT_ROUTE, "utf-8");
    const bootstrap = rootRoute.indexOf("<script dangerouslySetInnerHTML");
    const headContent = rootRoute.indexOf("<HeadContent />");

    expect(rootRoute).toContain('<html lang="en" suppressHydrationWarning>');
    expect(rootRoute).not.toContain('data-theme="dark"');
    expect(bootstrap).toBeGreaterThan(-1);
    expect(bootstrap).toBeLessThan(headContent);
    expect(rootRoute).toContain('{ name: "color-scheme", content: "light dark" }');
  });
});

describe("mode-aware token roles", () => {
  it.each(MODE_FILES)("%s has role parity and an exact dark system fallback", (file) => {
    const content = readTokenFile(file);
    const light = declarations(modeBlock(content, "light"));
    const dark = declarations(modeBlock(content, "dark"));
    const fallback = declarations(modeBlock(content, "fallback"));

    expect(light.size, `${file} should define at least one mode-aware role`).toBeGreaterThan(0);
    expect([...dark.keys()]).toEqual([...light.keys()]);
    expect([...fallback.keys()]).toEqual([...dark.keys()]);
    expect(fallback).toEqual(dark);
  });

  it("uses the republished opaque dark status backgrounds", () => {
    const dark = declarations(modeBlock(readTokenFile("color/status.css"), "dark"));

    expect(dark.get("--color-success-bg")).toBe("#1E2F2B");
    expect(dark.get("--color-warning-bg")).toBe("#342F21");
    expect(dark.get("--color-error-bg")).toBe("#312028");
    expect(dark.get("--color-info-bg")).toBe("#1C2A3A");
  });

  it.each(["light", "dark"] as const)("defines all six %s color roles for every voice", (mode) => {
    const voiceColors = declarations(modeBlock(readTokenFile("voices/families.css"), mode));
    const expectedNames = VOICES.flatMap((voice) =>
      VOICE_COLOR_ROLES.map((role) => `--voice-${voice}-${role}`),
    );

    expect([...voiceColors.keys()]).toEqual(expectedNames);
  });
});

describe("token ownership boundaries", () => {
  it("gives each canonical token exactly one file owner", () => {
    const owners = new Map<string, Set<string>>();

    for (const file of CANONICAL_OWNER_FILES) {
      for (const name of declarations(readTokenFile(file)).keys()) {
        const tokenOwners = owners.get(name) ?? new Set<string>();
        tokenOwners.add(file);
        owners.set(name, tokenOwners);
      }
    }

    for (const [name, tokenOwners] of owners) {
      expect([...tokenOwners], `${name} has multiple canonical owners`).toHaveLength(1);
    }
  });

  it("keeps voice families color-only, radius families voice-only, and resolution aliases literal-free", () => {
    const voiceColors = declarations(readTokenFile("voices/families.css"));
    const voiceRadii = declarations(readTokenFile("radius.css"));
    const resolvedAliases = declarations(readTokenFile("voices/resolution.css"));

    for (const name of voiceColors.keys()) {
      expect(name).toMatch(
        /^--voice-(parent|studio|tv|records)-(accent|accent-hover|accent-bg|accent-subtle|on-accent|accent2)$/,
      );
    }
    for (const name of voiceRadii.keys()) {
      expect(name).toMatch(/^--voice-(parent|studio|tv|records)-radius(?:-(?:sm|md|lg|xl))?$/);
    }
    for (const value of resolvedAliases.values()) {
      expect(value).toMatch(/^var\(--[\w-]+\)$/);
    }
  });

  it("keeps every voice radius scale complete, ordered, and proportional", () => {
    const voiceRadii = declarations(readTokenFile("radius.css"));
    const pixels = (name: string): number => {
      const value = voiceRadii.get(name);
      expect(value, `${name} should be declared`).toBeDefined();
      expect(value).toMatch(/^\d+px$/);
      return Number.parseInt(value ?? "", 10);
    };

    for (const voice of VOICES) {
      const baseName = `--voice-${voice}-radius`;
      const base = pixels(baseName);
      const sm = pixels(`${baseName}-sm`);
      const lg = pixels(`${baseName}-lg`);
      const xl = pixels(`${baseName}-xl`);

      expect(voiceRadii.get(`${baseName}-md`)).toBe(`var(${baseName})`);
      expect(sm).toBeLessThanOrEqual(base);
      expect(base).toBeLessThanOrEqual(lg);
      expect(lg).toBeLessThanOrEqual(xl);
      expect(sm).toBe(base / 2);
      expect(lg).toBe(base * 1.5);
      expect(xl).toBe(base * 2);
    }
  });

  it("keeps invariant circle and pill geometry out of the voice radius owner", () => {
    const geometry = declarations(readTokenFile("geometry.css"));
    const voiceRadii = declarations(readTokenFile("radius.css"));

    expect(geometry).toEqual(
      new Map([
        ["--radius-circle", "50%"],
        ["--radius-pill", "999px"],
      ]),
    );
    expect(voiceRadii.has("--radius-circle")).toBe(false);
    expect(voiceRadii.has("--radius-pill")).toBe(false);
  });

  it("resolves every Parent generic alias through a declared variable chain", () => {
    const resolution = readTokenFile("voices/resolution.css");
    const resolvedAliases = declarations(resolution);
    const expectedAliases = new Map([
      ["--color-accent", "var(--voice-parent-accent)"],
      ["--color-accent-hover", "var(--voice-parent-accent-hover)"],
      ["--color-accent-bg", "var(--voice-parent-accent-bg)"],
      ["--color-accent-subtle", "var(--voice-parent-accent-subtle)"],
      ["--color-on-accent", "var(--voice-parent-on-accent)"],
      ["--color-accent2", "var(--voice-parent-accent2)"],
      ["--color-link", "var(--color-accent)"],
      ["--color-link-hover", "var(--color-accent-hover)"],
      ["--radius", "var(--voice-parent-radius)"],
      ["--radius-sm", "var(--voice-parent-radius-sm)"],
      ["--radius-md", "var(--voice-parent-radius-md)"],
      ["--radius-lg", "var(--voice-parent-radius-lg)"],
      ["--radius-xl", "var(--voice-parent-radius-xl)"],
      ["--font-body", "var(--font-body-parent)"],
      ["--font-display", "var(--font-display-parent)"],
    ]);
    const declarationsByFile = new Map(
      COMPOSED_TOKEN_FILES.map((file) => [file, declarations(readTokenFile(file))]),
    );
    const declaredNames = new Set(
      CANONICAL_OWNER_FILES.flatMap((file) => [...(declarationsByFile.get(file)?.keys() ?? [])]),
    );

    expect(resolvedAliases).toEqual(expectedAliases);
    for (const name of resolvedAliases.keys()) {
      const owners = COMPOSED_TOKEN_FILES.filter((file) => declarationsByFile.get(file)?.has(name));
      expect(owners, `${name} should have one declaration owner`).toEqual(["voices/resolution.css"]);
    }
    for (const value of resolvedAliases.values()) {
      const target = value.match(/^var\((--[\w-]+)\)$/)?.[1];
      expect(target, `${value} should be a direct variable reference`).toBeDefined();
      expect(declaredNames.has(target ?? ""), `${target} should have a declaration owner`).toBe(true);
    }
    expect(resolution).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|\b\d+(?:\.\d+)?(?:px|rem|em|%)\b/i);
    expect(resolution).toContain("[data-route] {\n  font-family: var(--font-body);\n}");
    expect(resolution).not.toMatch(/\[data-route=["']/);
  });
});

describe("supporting token contracts", () => {
  it("keeps fixed preview surfaces mode-independent", () => {
    const preview = readTokenFile("color/preview.css");

    expect(preview).not.toContain("data-theme");
    expect(declarations(preview)).toEqual(
      new Map([
        ["--preview-light-paper", "#F6F0E7"],
        ["--preview-light-ink", "#1A1A2E"],
        ["--preview-dark-paper", "#171725"],
        ["--preview-dark-ink", "#DDD8CE"],
      ]),
    );
  });

  it("underlines prose links while exempting structural navigation and chrome", () => {
    const globalCss = readFileSync(GLOBAL_CSS, "utf-8");

    expect(globalCss).toContain(
      "a {\n  color: var(--color-link);\n  text-decoration: underline;\n  text-underline-offset: 0.15em;\n}",
    );
    expect(globalCss).toContain("a:hover {\n  color: var(--color-link-hover);\n}");
    expect(globalCss).toContain(
      ':where(nav, [role="navigation"], [role="tablist"]) a {\n  text-decoration: none;\n}',
    );
  });

  it("retains the reduced-motion reset", () => {
    const motion = readTokenFile("motion.css");

    expect(motion).toContain("prefers-reduced-motion: reduce");
    expect(motion).toContain("--duration-normal: 0ms");
  });
});
