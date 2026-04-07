import { describe, it, expect, vi, afterEach } from "vitest";

vi.doMock("../../src/config.js", () => ({
  config: { IMGPROXY_URL: undefined, IMGPROXY_KEY: undefined, IMGPROXY_SALT: undefined, S3_BUCKET: "snc-storage" },
}));

const { resolveCreatorUrls } = await import("../../src/lib/creator-url.js");

// ── resolveCreatorUrls ──

describe("resolveCreatorUrls", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("returns proxy URL paths when avatarKey and bannerKey are set", () => {
    const result = resolveCreatorUrls({
      id: "creator-abc",
      avatarKey: "avatars/creator-abc.jpg",
      bannerKey: "banners/creator-abc.jpg",
    });
    expect(result.avatarUrl).toBe("/api/creators/creator-abc/avatar");
    expect(result.bannerUrl).toBe("/api/creators/creator-abc/banner");
    expect(result.avatar).toBeNull();
    expect(result.banner).toBeNull();
  });

  it("returns null avatarUrl when avatarKey is null", () => {
    const result = resolveCreatorUrls({
      id: "creator-abc",
      avatarKey: null,
      bannerKey: "banners/creator-abc.jpg",
    });
    expect(result.avatarUrl).toBeNull();
    expect(result.bannerUrl).toBe("/api/creators/creator-abc/banner");
  });

  it("returns null bannerUrl when bannerKey is null", () => {
    const result = resolveCreatorUrls({
      id: "creator-abc",
      avatarKey: "avatars/creator-abc.jpg",
      bannerKey: null,
    });
    expect(result.avatarUrl).toBe("/api/creators/creator-abc/avatar");
    expect(result.bannerUrl).toBeNull();
  });

  it("returns both null when both keys are null", () => {
    const result = resolveCreatorUrls({
      id: "creator-abc",
      avatarKey: null,
      bannerKey: null,
    });
    expect(result.avatarUrl).toBeNull();
    expect(result.bannerUrl).toBeNull();
    expect(result.avatar).toBeNull();
    expect(result.banner).toBeNull();
  });

  it("uses the profile id in the generated URL path", () => {
    const result = resolveCreatorUrls({
      id: "my-creator-id-123",
      avatarKey: "some-key",
      bannerKey: null,
    });
    expect(result.avatarUrl).toContain("my-creator-id-123");
  });
});
