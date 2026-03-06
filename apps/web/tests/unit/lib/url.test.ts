import { describe, it, expect } from "vitest";

import { buildMediaUrl } from "../../../src/lib/url.js";

describe("buildMediaUrl", () => {
  it("returns null for null input", () => {
    expect(buildMediaUrl(null)).toBeNull();
  });

  it("returns null for empty string input", () => {
    expect(buildMediaUrl("")).toBeNull();
  });

  it("returns the relative path as-is", () => {
    expect(buildMediaUrl("/api/content/123/media")).toBe(
      "/api/content/123/media",
    );
  });

  it("returns a thumbnail path as-is", () => {
    expect(buildMediaUrl("/api/content/123/thumbnail")).toBe(
      "/api/content/123/thumbnail",
    );
  });
});
