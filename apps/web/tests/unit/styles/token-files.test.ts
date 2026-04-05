import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TOKENS_DIR = resolve(import.meta.dirname, "../../../src/styles/tokens");
const GLOBAL_CSS = resolve(import.meta.dirname, "../../../src/styles/global.css");

const EXPECTED_TOKEN_FILES = [
  "color.css",
  "typography.css",
  "spacing.css",
  "elevation.css",
  "motion.css",
  "radius.css",
];

describe("design token files", () => {
  it("all expected token files exist", () => {
    for (const file of EXPECTED_TOKEN_FILES) {
      expect(existsSync(resolve(TOKENS_DIR, file)), `${file} should exist`).toBe(true);
    }
  });

  it("global.css imports all token files", () => {
    const globalCss = readFileSync(GLOBAL_CSS, "utf-8");
    for (const file of EXPECTED_TOKEN_FILES) {
      expect(globalCss).toContain(`@import "./tokens/${file}"`);
    }
  });

  it("global.css has no :root token definitions except aliases", () => {
    const globalCss = readFileSync(GLOBAL_CSS, "utf-8");
    // Extract all :root blocks
    const rootBlocks = globalCss.match(/:root\s*\{[^}]+\}/g) ?? [];
    for (const block of rootBlocks) {
      // Each property in a :root block should reference var() (alias) not a literal value
      const properties = block.match(/--[\w-]+:\s*[^;]+/g) ?? [];
      for (const prop of properties) {
        const [name, value] = prop.split(/:\s*/) as [string, string];
        expect(value.trim()).toMatch(
          /^var\(/,
          `${name} in global.css :root should be an alias (var() reference), not a literal value. Move literal definitions to token files.`,
        );
      }
    }
  });

  it("each token file defines only :root custom properties", () => {
    for (const file of EXPECTED_TOKEN_FILES) {
      const content = readFileSync(resolve(TOKENS_DIR, file), "utf-8");
      // Strip comments and @media blocks for this check
      const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
      const withoutMedia = withoutComments.replace(/@media[^{]+\{[^}]*:root\s*\{[^}]*\}[^}]*\}/g, "");
      // Only :root selectors should remain (no element selectors, no classes)
      const selectors = withoutMedia.match(/[^@\s{][^{]*(?=\s*\{)/g) ?? [];
      for (const selector of selectors) {
        expect(selector.trim()).toBe(":root");
      }
    }
  });

  it("motion.css includes prefers-reduced-motion reset", () => {
    const motion = readFileSync(resolve(TOKENS_DIR, "motion.css"), "utf-8");
    expect(motion).toContain("prefers-reduced-motion: reduce");
    expect(motion).toContain("--duration-normal: 0ms");
  });
});
