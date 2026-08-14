import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

// Contract guard for the content-card badge treatment (operator feedback 2026-08-14):
// badges OVERLAID ON MEDIA must use the guaranteed-contrast on-media contract
// (--color-overlay-strong scrim + --color-on-media ink), never the mode-aware
// page-surface pairing (--color-text over a transparent category tint), which
// collapses when imagery shares a hue with the badge or lacks contrast.
// Inline badges on the card body surface keep the surface treatment. Showcase
// overlay borders carry the resolved item voice, with the category hue as the
// parent-item fallback; non-showcase borders remain category-colored.

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, "../../../src/components/content/content-card.module.css");
const css = readFileSync(cssPath, "utf-8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(m, `missing rule ${selector}`).not.toBeNull();
  return m?.[1] ?? "";
}

describe("content-card badge contrast contract", () => {
  it("overlay badges use the on-media treatment, overriding the per-type surface pairing", () => {
    // :not(.badgeInline) bumps specificity above the single-class per-type rules,
    // so the overlay badge gets scrim + on-media ink regardless of type class.
    const overlay = rule(".badge:not(.badgeInline)");

    expect(overlay).toContain("background: var(--color-overlay-strong)");
    expect(overlay).toContain("color: var(--color-on-media)");
    expect(overlay).not.toContain("--color-text");
    expect(overlay).not.toContain("-tint");
  });

  it.each(["Video", "Audio", "Written"])(
    "keeps non-showcase and inline %s badges on the category treatment",
    (type) => {
      const r = rule(`.badge${type}`);

      expect(r).toContain(`border: 1px solid var(--color-badge-${type.toLowerCase()})`);
      // Surface pairing (inline case): category tint + ordinary text ink.
      expect(r).toContain(`background: var(--color-badge-${type.toLowerCase()}-tint`);
      expect(r).toContain("color: var(--color-text)");
      expect(r).not.toContain("--item-unit-accent");
    },
  );

  it.each(["Video", "Audio", "Written"])(
    "gives showcase overlay %s badge borders the unit voice with category fallback",
    (type) => {
      const category = type.toLowerCase();
      const r = rule(`.showcaseItem .badge${type}:not(.badgeInline)`);

      expect(r).toContain(
        `border-color: var(--item-unit-accent, var(--color-badge-${category}))`,
      );
      expect(r).not.toMatch(/(?:^|;)\s*(?:background|color)\s*:/);
    },
  );

  it("no per-type rule or overlay base regresses to raw color literals", () => {
    for (const selector of [".badge", ".badgeVideo", ".badgeAudio", ".badgeWritten"]) {
      const r = rule(selector);

      expect(r, `${selector} should not hardcode colors`).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});
