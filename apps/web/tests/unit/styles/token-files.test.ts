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
  "elevation.css",
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

  it("retains the reduced-motion reset", () => {
    const motion = readTokenFile("motion.css");

    expect(motion).toContain("prefers-reduced-motion: reduce");
    expect(motion).toContain("--duration-normal: 0ms");
  });
});
