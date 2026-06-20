import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

// Regression guard for the CSS-Modules silent-undefined bug class.
//
// A `.secondaryButton` reference shipped in ConnectButton (manage/streaming.tsx) while the
// class did NOT exist in button.module.css. CSS Modules returned `undefined`, the button
// rendered unstyled at 19px (failing WCAG 2.5.8). Vitest's default CSS-Modules handling
// returns the *key string* for any accessed property — existing or not — so a render-based
// `className` assertion cannot catch this. The only reliable guard is static: every
// `buttonStyles.X` reference must resolve to a `.X` rule actually defined in the stylesheet.

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../../../src");

/** Read the shared button stylesheet and the streaming route that consumes it. */
function read(rel: string): string {
  return readFileSync(resolve(srcDir, rel), "utf8");
}

/** Extract class selectors (`.foo`) defined at rule-start in a CSS module. */
function definedClasses(css: string): Set<string> {
  const names = new Set<string>();
  for (const m of css.matchAll(/^\.([A-Za-z][\w-]*)/gm)) {
    names.add(m[1]!);
  }
  return names;
}

/** Extract `buttonStyles.X` property accesses from a consumer module. */
function referencedClasses(tsx: string): Set<string> {
  const names = new Set<string>();
  for (const m of tsx.matchAll(/\bbuttonStyles\.([A-Za-z][\w$]*)/g)) {
    names.add(m[1]!);
  }
  return names;
}

describe("button.module.css contract", () => {
  const defined = definedClasses(read("styles/button.module.css"));

  it("defines the shared button classes consumers depend on", () => {
    // If any of these is renamed/removed, every `buttonStyles.X` consumer silently
    // unstyles — assert the contract holds.
    expect(defined).toContain("primaryButton");
    expect(defined).toContain("secondaryButton");
    expect(defined).toContain("primaryButtonLink");
  });

  it("resolves every buttonStyles.* reference in the streaming manage route", () => {
    // The route where the original undefined-class bug shipped (ConnectButton).
    const referenced = referencedClasses(read("routes/creators/$creatorId/manage/streaming.tsx"));
    expect(referenced.size).toBeGreaterThan(0);
    const missing = [...referenced].filter((cls) => !defined.has(cls));
    expect(missing).toEqual([]);
  });
});
