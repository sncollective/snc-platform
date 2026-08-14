import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { APPEARANCE_BOOTSTRAP_SCRIPT } from "../../../src/lib/appearance/appearance-bootstrap.js";

const GLOBAL_CSS = resolve(import.meta.dirname, "../../../src/styles/global.css");
const SPINE_CSS = resolve(import.meta.dirname, "../../../src/styles/tokens/color/spine.css");

function runBootstrap({
  storedValue = null,
  systemDark = false,
  blockStorage = false,
}: {
  readonly storedValue?: string | null;
  readonly systemDark?: boolean;
  readonly blockStorage?: boolean;
}) {
  const attributes = new Map<string, string>();
  const setAttribute = vi.fn((name: string, value: string) => attributes.set(name, value));
  const fakeWindow = {
    localStorage: {
      getItem: () => {
        if (blockStorage) throw new DOMException("Storage blocked", "SecurityError");
        return storedValue;
      },
    },
    matchMedia: vi.fn(() => ({ matches: systemDark })),
  };
  const fakeDocument = { documentElement: { setAttribute } };

  Function("window", "document", APPEARANCE_BOOTSTRAP_SCRIPT)(fakeWindow, fakeDocument);
  return { attributes, fakeWindow, setAttribute };
}

describe("appearance first-paint bootstrap", () => {
  it("only reads, resolves, and sets the two appearance attributes", () => {
    const { attributes, fakeWindow, setAttribute } = runBootstrap({
      storedValue: "system",
      systemDark: true,
    });

    expect(attributes).toEqual(
      new Map([
        ["data-theme-preference", "system"],
        ["data-theme", "dark"],
      ]),
    );
    expect(setAttribute).toHaveBeenCalledTimes(2);
    expect(fakeWindow.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(APPEARANCE_BOOTSTRAP_SCRIPT).not.toContain("addEventListener");
  });

  it("uses system mode when bootstrap storage access is blocked", () => {
    const { attributes } = runBootstrap({ blockStorage: true, systemDark: false });

    expect(attributes.get("data-theme-preference")).toBe("system");
    expect(attributes.get("data-theme")).toBe("light");
  });

  it("keeps the no-attribute system CSS fallback valid when CSP blocks the bootstrap", () => {
    const attributes = new Map<string, string>();
    const globalCss = readFileSync(GLOBAL_CSS, "utf-8");
    const spineCss = readFileSync(SPINE_CSS, "utf-8");

    // Simulate CSP by not executing the bootstrap at all. An explicit stored preference may
    // flash as system until hydration; the accepted fallback is still a valid system paint.
    expect(attributes.has("data-theme")).toBe(false);
    expect(globalCss).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*?:root:not\(\[data-theme\]\)\s*\{\s*color-scheme:\s*dark;/,
    );
    expect(spineCss).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*?:root:not\(\[data-theme\]\)/,
    );
  });
});
