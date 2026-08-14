import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const TOKENS_DIR = resolve(import.meta.dirname, "../../../src/styles/tokens");
const RESOLUTION_CSS = readTokenFile("voices/resolution.css");

const ROUTES = ["studio", "tv", "records"] as const;
const COLOR_ALIASES = [
  "accent",
  "accent-hover",
  "accent-bg",
  "accent-subtle",
  "on-accent",
  "accent2",
] as const;
const RADIUS_ALIASES = ["radius", "radius-sm", "radius-md", "radius-lg", "radius-xl"] as const;

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

function routeDeclarations(route: (typeof ROUTES)[number]): Map<string, string> {
  const block = RESOLUTION_CSS.match(
    new RegExp(`\\[data-route=["']${route}["']\\]\\s*\\{([^}]*)\\}`),
  )?.[1];
  expect(block, `resolution.css should define a ${route} route block`).toBeDefined();
  return declarations(block ?? "");
}

function expectedRouteAliases(route: (typeof ROUTES)[number]): Map<string, string> {
  return new Map([
    ...COLOR_ALIASES.map(
      (role) => [`--color-${role}`, `var(--voice-${route}-${role})`] as const,
    ),
    ["--color-link", "var(--color-accent)"],
    ["--color-link-hover", "var(--color-accent-hover)"],
    ...RADIUS_ALIASES.map((alias) => [
      `--${alias}`,
      `var(--voice-${route}-${alias})`,
    ] as const),
    ["--font-body", `var(--font-body-${route})`],
    ["--font-display", `var(--font-display-${route})`],
  ]);
}

const SOURCE_DECLARATIONS = new Map([
  ...declarations(readTokenFile("voices/families.css")),
  ...declarations(readTokenFile("radius.css")),
  ...declarations(readTokenFile("typography.css")),
]);

function resolveVariable(name: string, routeAliases: Map<string, string>): string {
  const seen = new Set<string>();
  let value = routeAliases.get(name) ?? SOURCE_DECLARATIONS.get(name);

  while (value !== undefined) {
    const target = value.match(/^var\((--[\w-]+)\)$/)?.[1];
    if (target === undefined) return value;
    expect(seen.has(target), `${name} should not contain a variable cycle`).toBe(false);
    seen.add(target);
    value = routeAliases.get(target) ?? SOURCE_DECLARATIONS.get(target);
  }

  throw new Error(`${name} resolves through an undeclared variable`);
}

/*
 * jsdom 26 preserves var(...) in getComputedStyle() and returns an empty computed
 * font-family for a declaration that consumes a custom property. These fixtures therefore
 * exercise the stylesheet contract structurally rather than claiming browser-computed CSS.
 */
describe("route voice resolution structural fixtures", () => {
  it.each(ROUTES)("maps every generic alias for the %s route", (route) => {
    expect(routeDeclarations(route)).toEqual(expectedRouteAliases(route));
  });

  it.each(ROUTES)("resolves %s accent and radius aliases to concrete source values", (route) => {
    const aliases = routeDeclarations(route);

    for (const name of ["--color-accent", "--radius", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"]) {
      expect(resolveVariable(name, aliases), `${route} ${name}`).not.toMatch(/^var\(/);
    }
  });

  it.each(ROUTES)("exposes body and display families for %s descendants", (route) => {
    const aliases = routeDeclarations(route);

    expect(aliases.get("--font-body")).toBe(`var(--font-body-${route})`);
    expect(aliases.get("--font-display")).toBe(`var(--font-display-${route})`);
    expect(resolveVariable("--font-body", aliases)).not.toMatch(/^var\(/);
    expect(resolveVariable("--font-display", aliases)).not.toMatch(/^var\(/);
  });

  it("requires leaf route containers to recompute ordinary descendant body copy", () => {
    expect(RESOLUTION_CSS).toContain(
      "Route-container boundary requirement: body resolves its font outside the leaf scope.",
    );
    expect(RESOLUTION_CSS).toContain("[data-route] {\n  font-family: var(--font-body);\n}");
  });

  it("keeps Parent as the fallback and reserves no future override seam", () => {
    expect(RESOLUTION_CSS).not.toMatch(/\[data-route=["']parent["']\]/);
    expect(RESOLUTION_CSS).not.toContain("data-effective-voice");
  });
});
