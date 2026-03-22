import { describe, it, expect } from "vitest";

import { toSlug } from "../../src/services/slug.js";

// ── toSlug tests ──

describe("toSlug", () => {
  it('converts "My Cool Track" to "my-cool-track"', () => {
    expect(toSlug("My Cool Track")).toBe("my-cool-track");
  });

  it('converts "  Spaces  And---Dashes  " to "spaces-and-dashes"', () => {
    expect(toSlug("  Spaces  And---Dashes  ")).toBe("spaces-and-dashes");
  });

  it('strips leading and trailing hyphens from "-leading-and-trailing-"', () => {
    expect(toSlug("-leading-and-trailing-")).toBe("leading-and-trailing");
  });

  it('preserves underscores in "under_scores_ok"', () => {
    expect(toSlug("under_scores_ok")).toBe("under_scores_ok");
  });

  it('strips special characters from "Special!@#Characters"', () => {
    expect(toSlug("Special!@#Characters")).toBe("specialcharacters");
  });

  it('lowercases "AB" to "ab"', () => {
    expect(toSlug("AB", 80)).toBe("ab");
  });

  it("truncates to maxLength when exceeded", () => {
    const result = toSlug("Very Long Name That Exceeds Limit", 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns empty string for all-special-character input", () => {
    expect(toSlug("!@#$%^&*()")).toBe("");
  });

  it("collapses multiple spaces to single hyphen", () => {
    expect(toSlug("a   b   c")).toBe("a-b-c");
  });

  it("handles numeric input", () => {
    expect(toSlug("Track 42")).toBe("track-42");
  });

  it("uses default maxLength of 80", () => {
    const longName = "a".repeat(100);
    expect(toSlug(longName)).toHaveLength(80);
  });

  it("collapses multiple consecutive hyphens to one", () => {
    expect(toSlug("a---b---c")).toBe("a-b-c");
  });

  it("handles a mix of hyphens from spaces and literal hyphens", () => {
    expect(toSlug("hello - world")).toBe("hello-world");
  });
});
