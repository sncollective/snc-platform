import { describe, expect, it, vi } from "vitest";

import { ok } from "@snc/shared";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

const mockFindCreatorProfile = vi.fn();
const mockGetPressConfig = vi.fn();
const mockGetPressDraftConfig = vi.fn();
const mockUpsertPressConfig = vi.fn();
const mockPublishPressConfig = vi.fn();
const mockUnpublishPressConfig = vi.fn();
const mockDiscardPressDraft = vi.fn();
const mockRequireCreatorPermission = vi.fn();
const mockCanUseAsset = vi.fn();
const mockStorageDownload = vi.fn();
const mockBuildPressImageUrl = vi.fn();
const mockRenderOnePagerPdf = vi.fn();
const mockRenderCreatorOneSheetPdf = vi.fn();
const mockRenderReleaseOneSheetPdf = vi.fn();

const libraryKey = `library/aa/${"a".repeat(64)}.jpg`;
const secondLibraryKey = `library/bb/${"b".repeat(64)}.png`;

const profile = {
  id: "creator_test123",
  displayName: "Test Creator",
  bio: "A test creator",
  handle: "test-creator",
  avatarKey: null,
  bannerKey: null,
  brandColor: null,
  socialLinks: [],
  status: "active" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const release = {
  slug: "the-illusionist",
  title: "The Illusionist",
  catalogNumber: "SNCR-001",
  releaseDate: "2026-08-06",
  format: "Single",
  genre: "Alternative",
  isrc: "US-SNC-26-00001",
  upc: null,
  duration: "3:42",
  personnel: ["Animal Future"],
  writtenBy: "Animal Future",
  producedBy: null,
  mixedMasteredBy: null,
  copyrightLine: "2026 S/NC Records",
  publisherLine: null,
  label: "S/NC Records",
  fcc: "clean" as const,
  artKey: null,
};

const banner = {
  key: `creators/${profile.id}/press/banner.jpg`,
  alt: "Test Creator on stage",
  credit: "Photo: Test Photographer",
  crop: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 },
};

const content = {
  enabled: true,
  template: "A" as const,
  tagline: "A concise tagline",
  shortBio: "A test creator short bio",
  longBio: null,
  forFansOf: ["Alternative pop"],
  banner,
  aboutPhoto: null,
  members: [],
  streamingLinks: [{ label: "Bandcamp", url: "https://example.com/listen" }],
  liveDatesUrl: null,
  standoutTrack: {
    title: "Get to You",
    url: "https://example.com/get-to-you",
    streamsLabel: "14.5k streams",
  },
  highlights: [],
  pressContactEmail: "press@example.com",
  pressQuotes: [],
  location: "Philadelphia, PA",
  photos: [],
  gallery: [],
  releases: [release],
};

const ctx = setupRouteTest({
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: () => {
    vi.doMock("../../src/lib/creator-helpers.js", () => ({
      findCreatorProfile: mockFindCreatorProfile,
    }));
    vi.doMock("../../src/services/press.js", () => ({
      getPressConfig: mockGetPressConfig,
      getPressDraftConfig: mockGetPressDraftConfig,
      upsertPressConfig: mockUpsertPressConfig,
      publishPressConfig: mockPublishPressConfig,
      unpublishPressConfig: mockUnpublishPressConfig,
      discardPressDraft: mockDiscardPressDraft,
    }));
    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
    }));
    vi.doMock("../../src/services/library.js", () => ({
      canUseAsset: mockCanUseAsset,
    }));
    vi.doMock("../../src/storage/index.js", () => ({
      storage: {
        download: mockStorageDownload,
      },
    }));
    vi.doMock("../../src/lib/imgproxy.js", () => ({
      buildPressImageUrl: mockBuildPressImageUrl,
    }));
    vi.doMock("../../src/services/press-pdf.js", () => ({
      ONE_SHEET_ORIENTATIONS: ["auto", "horizontal", "vertical"],
      PDF_EXPORT_THEMES: ["light", "dark"],
      renderOnePagerPdf: mockRenderOnePagerPdf,
      renderCreatorOneSheetPdf: mockRenderCreatorOneSheetPdf,
      renderReleaseOneSheetPdf: mockRenderReleaseOneSheetPdf,
    }));
    vi.doMock("../../src/middleware/optional-auth.js", () => ({
      optionalAuth: async (c: any, next: any) => {
        c.set("user", ctx.auth.user);
        c.set("session", ctx.auth.session);
        c.set("roles", ctx.auth.roles);
        await next();
      },
    }));
  },
  mountRoute: async (app) => {
    const { pressRoutes } = await import("../../src/routes/press.routes.js");
    app.route("/api/creators", pressRoutes);
  },
  beforeEach: () => {
    mockFindCreatorProfile.mockResolvedValue(profile);
    mockGetPressConfig.mockResolvedValue(ok(content));
    mockGetPressDraftConfig.mockResolvedValue(ok(content));
    mockUpsertPressConfig.mockResolvedValue(
      ok({ ...content, shortBio: "Updated bio" }),
    );
    mockPublishPressConfig.mockResolvedValue(ok(content));
    mockUnpublishPressConfig.mockResolvedValue(ok({ ...content, enabled: false }));
    mockDiscardPressDraft.mockResolvedValue(ok(content));
    mockRequireCreatorPermission.mockResolvedValue(undefined);
    mockCanUseAsset.mockResolvedValue(true);
    mockBuildPressImageUrl.mockImplementation((image, slot, width) => ({
      src: `https://images.example/${slot}/${width}/${image.key}`,
      srcSet: `https://images.example/${slot}/${width}/${image.key} ${width}w`,
      sizes: "100vw",
    }));
    const pdf = Buffer.from("%PDF route fixture");
    mockRenderOnePagerPdf.mockResolvedValue(pdf);
    mockRenderCreatorOneSheetPdf.mockResolvedValue(pdf);
    mockRenderReleaseOneSheetPdf.mockResolvedValue(pdf);
    mockStorageDownload.mockResolvedValue(
      ok({
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("image data"));
            controller.close();
          },
        }),
        size: 10,
      }),
    );
  },
});

const json = (method: string, path: string, body?: unknown) =>
  ctx.app.request(path, {
    method,
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });

describe("GET /api/creators/:creatorId/press", () => {
  it("returns enabled press content without authentication", async () => {
    ctx.auth.user = null;

    const res = await json("GET", "/api/creators/test-creator/press");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.creator).toEqual({
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      location: content.location,
    });
    expect(body.content).toEqual({
      ...content,
      banner: {
        ...banner,
        src: `https://images.example/banner/2250/${banner.key}`,
        srcSet: `https://images.example/banner/2250/${banner.key} 2250w`,
        sizes: "100vw",
      },
    });
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(banner, "banner", 2250);
    expect(mockFindCreatorProfile).toHaveBeenCalledWith("test-creator", {
      activeOnly: true,
    });
  });

  it("returns 404 when press is disabled", async () => {
    mockGetPressConfig.mockResolvedValueOnce(ok({ ...content, enabled: false }));

    const res = await json("GET", "/api/creators/test-creator/press");

    expect(res.status).toBe(404);
  });

  it("returns 404 for an inactive creator", async () => {
    mockFindCreatorProfile.mockResolvedValueOnce(undefined);

    const res = await json("GET", "/api/creators/test-creator/press");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/creators/:creatorId/press/releases/:releaseSlug", () => {
  it("returns the requested release one-sheet without authentication", async () => {
    ctx.auth.user = null;

    const res = await json(
      "GET",
      "/api/creators/test-creator/press/releases/the-illusionist",
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(release);
  });

  it("returns 404 for an unknown release slug", async () => {
    const res = await json(
      "GET",
      "/api/creators/test-creator/press/releases/unknown",
    );

    expect(res.status).toBe(404);
  });

  it("returns the requested release as a PDF one-sheet", async () => {
    const res = await json(
      "GET",
      "/api/creators/test-creator/press/releases/the-illusionist/one-sheet.pdf",
    );
    const body = Buffer.from(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    expect(body.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(mockRenderReleaseOneSheetPdf).toHaveBeenCalledWith({
      release,
      creatorId: profile.id,
      pressPageUrl: "http://localhost:3080/creators/test-creator/press",
      exportIdentity: {
        producingUnit: "records",
        federationHandle: profile.handle,
        creatorBrandColor: null,
        theme: "light",
      },
    });
  });

  it("rate-limits release PDF rendering after six requests per IP", async () => {
    const path = "/api/creators/test-creator/press/releases/the-illusionist/one-sheet.pdf";
    const headers = { "x-forwarded-for": "203.0.113.42" };

    for (let index = 0; index < 6; index++) {
      const res = await ctx.app.request(path, { headers });
      expect(res.status).toBe(200);
    }

    const blocked = await ctx.app.request(path, { headers });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
    expect(await blocked.json()).toMatchObject({
      error: { code: "RATE_LIMIT_EXCEEDED" },
    });
    expect(mockRenderReleaseOneSheetPdf).toHaveBeenCalledTimes(6);
  });
});

describe("GET /api/creators/:creatorId/press/one-pager.pdf", () => {
  it("prints the live template with an explicit Records export identity", async () => {
    ctx.auth.user = null;

    const res = await json("GET", "/api/creators/test-creator/press/one-pager.pdf");
    const body = Buffer.from(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    expect(body.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(mockRenderOnePagerPdf).toHaveBeenCalledWith({
      pageUrl: "http://localhost:3080/creators/test-creator/press",
      exportIdentity: {
        producingUnit: "records",
        federationHandle: profile.handle,
        creatorBrandColor: null,
        theme: "light",
      },
    });
  });
});

describe("GET /api/creators/:creatorId/press/one-sheet.pdf", () => {
  it("passes the Records identity, orientation, and custom QR URL to the curated renderer", async () => {
    const destinationUrl = "https://linktr.ee/custom-test";
    const res = await json(
      "GET",
      `/api/creators/test-creator/press/one-sheet.pdf?orientation=vertical&url=${encodeURIComponent(destinationUrl)}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    expect(mockRenderCreatorOneSheetPdf).toHaveBeenCalledWith(expect.objectContaining({
      content,
      pressPageUrl: "http://localhost:3080/creators/test-creator/press",
      exportIdentity: {
        producingUnit: "records",
        federationHandle: profile.handle,
        creatorBrandColor: null,
        theme: "light",
      },
      destinationUrl,
      orientation: "vertical",
    }));
  });

  it("threads a dark export theme and rejects unknown themes", async () => {
    const dark = await json(
      "GET",
      "/api/creators/test-creator/press/one-sheet.pdf?theme=dark",
    );
    expect(dark.status).toBe(200);
    expect(mockRenderCreatorOneSheetPdf).toHaveBeenCalledWith(expect.objectContaining({
      exportIdentity: expect.objectContaining({ theme: "dark" }),
    }));

    const light = await json(
      "GET",
      "/api/creators/test-creator/press/one-sheet.pdf",
    );
    expect(light.status).toBe(200);
    expect(mockRenderCreatorOneSheetPdf).toHaveBeenLastCalledWith(expect.objectContaining({
      exportIdentity: expect.objectContaining({ theme: "light" }),
    }));

    const invalid = await json(
      "GET",
      "/api/creators/test-creator/press/one-sheet.pdf?theme=sepia",
    );
    expect(invalid.status).toBe(400);
  });

  it("rejects non-HTTP QR destinations", async () => {
    const res = await json(
      "GET",
      `/api/creators/test-creator/press/one-sheet.pdf?url=${encodeURIComponent("javascript:alert(1)")}`,
    );
    expect(res.status).toBe(400);
    expect(mockRenderCreatorOneSheetPdf).not.toHaveBeenCalled();
  });

  it("maps an exhausted density ladder to a 400 with actionable guidance", async () => {
    const { BrowserPdfSinglePageFitError } = await import("../../src/services/browser-pdf.js");
    mockRenderCreatorOneSheetPdf.mockRejectedValueOnce(
      new BrowserPdfSinglePageFitError("Press one-sheet does not fit one page: vertical content overflow"),
    );

    const res = await json("GET", "/api/creators/test-creator/press/one-sheet.pdf");

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("does not fit one page even at compressed density"),
      },
    });
  });
});

describe("GET /api/creators/:creatorId/press/photos/:index", () => {
  it("streams an owned press photo with its image MIME type", async () => {
    const key = `creators/${profile.id}/press/hero.jpg`;
    mockGetPressConfig.mockResolvedValueOnce(ok({ ...content, photos: [key] }));

    const res = await json("GET", "/api/creators/test-creator/press/photos/0");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(await res.text()).toBe("image data");
    expect(mockStorageDownload).toHaveBeenCalledWith(key);
  });

  it("streams a persisted library reference without changing the v1 HTTP contract", async () => {
    mockGetPressConfig.mockResolvedValueOnce(ok({ ...content, photos: [libraryKey] }));

    const res = await json("GET", "/api/creators/test-creator/press/photos/0");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Disposition")).toBe(
      `inline; filename="${"a".repeat(64)}.jpg"`,
    );
    expect(res.headers.get("Location")).toBeNull();
    expect(await res.text()).toBe("image data");
    expect(mockCanUseAsset).not.toHaveBeenCalled();
    expect(mockStorageDownload).toHaveBeenCalledWith(libraryKey);
  });

  it("returns 404 without reading storage when the configured key is foreign", async () => {
    mockGetPressConfig.mockResolvedValueOnce(
      ok({ ...content, photos: ["content/another-creator/subscriber-only.jpg"] }),
    );

    const res = await json("GET", "/api/creators/test-creator/press/photos/0");

    expect(res.status).toBe(404);
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });

  it("returns 404 cleanly when the creator has no press photos", async () => {
    const res = await json("GET", "/api/creators/test-creator/press/photos/0");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/creators/:creatorId/press/image-source", () => {
  it("streams an owned legacy photo for an authorized editor", async () => {
    const key = `creators/${profile.id}/press/legacy hero.jpg`;

    const res = await json(
      "GET",
      `/api/creators/test-creator/press/image-source?key=${encodeURIComponent(key)}`,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("image data");
    expect(mockRequireCreatorPermission).toHaveBeenCalledWith(
      expect.any(String),
      profile.id,
      "editProfile",
      [],
    );
    expect(mockStorageDownload).toHaveBeenCalledWith(key);
  });

  it("does not stream a foreign legacy key", async () => {
    const key = "creators/another-creator/press/private.jpg";

    const res = await json(
      "GET",
      `/api/creators/test-creator/press/image-source?key=${encodeURIComponent(key)}`,
    );

    expect(res.status).toBe(404);
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });
});

describe("GET /api/creators/:creatorId/press-config", () => {
  it("returns the full config for a creator member", async () => {
    const res = await json("GET", "/api/creators/test-creator/press-config");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(content);
    expect(mockBuildPressImageUrl).not.toHaveBeenCalled();
    expect(mockRequireCreatorPermission).toHaveBeenCalledWith(
      ctx.auth.user!.id,
      profile.id,
      "editProfile",
    );
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;

    const res = await json("GET", "/api/creators/test-creator/press-config");

    expect(res.status).toBe(401);
    expect(mockFindCreatorProfile).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/creators/:creatorId/press-config", () => {
  it("returns 403 for a non-member", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValueOnce(
      new ForbiddenError("Not a member"),
    );

    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      shortBio: "No access",
    });

    expect(res.status).toBe(403);
    expect(mockUpsertPressConfig).not.toHaveBeenCalled();
  });

  it("accepts publish-invalid fields in a saved draft", async () => {
    const patch = {
      members: [{ name: "" }],
      highlights: [{ eyebrow: "Release", title: "", url: "coming-soon" }],
      streamingLinks: [{ label: "Spotify", url: "open.spotify/draft" }],
      liveDatesUrl: "dates pending",
      pressContactEmail: "not-an-email",
      pressQuotes: [],
    };

    const res = await json("PATCH", "/api/creators/test-creator/press-config", patch);

    expect(res.status).toBe(200);
    expect(mockUpsertPressConfig).toHaveBeenCalledWith(profile.id, {
      ...patch,
      streamingLinks: [{ ...patch.streamingLinks[0], service: "website" }],
    });
  });

  it("returns 400 when a draft violates the structural contract", async () => {
    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      template: "C",
    });

    expect(res.status).toBe(400);
    expect(mockUpsertPressConfig).not.toHaveBeenCalled();
  });

  it("returns 400 when photos contain a foreign object key", async () => {
    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      photos: ["creators/another-creator/press/private.jpg"],
    });

    expect(res.status).toBe(400);
    expect(mockUpsertPressConfig).not.toHaveBeenCalled();
  });

  it("returns 400 when release art contains a foreign object key", async () => {
    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      releases: [{ ...release, artKey: "content/another-creator/subscriber-only.jpg" }],
    });

    expect(res.status).toBe(400);
    expect(mockUpsertPressConfig).not.toHaveBeenCalled();
  });

  it("authorizes every image-bearing field and de-duplicates library checks", async () => {
    const ownedLegacyKey = `creators/${profile.id}/press/legacy.jpg`;
    const patch = {
      banner: { key: libraryKey, alt: "Banner" },
      aboutPhoto: { key: secondLibraryKey, alt: "About" },
      members: [{ name: "Member", photo: { key: libraryKey, alt: "Member" } }],
      highlights: [{ eyebrow: "Review", title: "Highlight", coverArt: { key: libraryKey, alt: "Cover" } }],
      gallery: [{ key: libraryKey, alt: "Gallery" }],
      photos: [libraryKey, ownedLegacyKey],
      releases: [{ ...release, artKey: secondLibraryKey }],
    };

    const res = await json("PATCH", "/api/creators/test-creator/press-config", patch);

    expect(res.status).toBe(200);
    expect(mockCanUseAsset).toHaveBeenCalledTimes(2);
    expect(mockCanUseAsset).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: false },
      libraryKey,
    );
    expect(mockCanUseAsset).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: false },
      secondLibraryKey,
    );
    expect(mockUpsertPressConfig).toHaveBeenCalledWith(profile.id, patch);
  });

  it.each([
    ["private foreign", libraryKey],
    ["requestable without grant", secondLibraryKey],
  ])("rejects an unavailable %s library key before writing", async (_label, key) => {
    mockCanUseAsset.mockResolvedValueOnce(false);

    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      gallery: [{ key, alt: "Unavailable" }],
    });

    expect(res.status).toBe(400);
    expect(mockUpsertPressConfig).not.toHaveBeenCalled();
  });

  it("rejects malformed and arbitrary namespaces without querying the library", async () => {
    for (const key of [
      `library/aa/${"A".repeat(64)}.jpg`,
      "library/not-a-key.jpg",
      "content/another-creator/photo.jpg",
    ]) {
      const res = await json("PATCH", "/api/creators/test-creator/press-config", {
        gallery: [{ key, alt: "Invalid" }],
      });
      expect(res.status).toBe(400);
    }
    expect(mockCanUseAsset).not.toHaveBeenCalled();
    expect(mockUpsertPressConfig).not.toHaveBeenCalled();
  });

  it("passes the admin actor through the library authorization boundary", async () => {
    ctx.auth.roles = ["admin"];

    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      gallery: [{ key: libraryKey, alt: "Admin image" }],
    });

    expect(res.status).toBe(200);
    expect(mockCanUseAsset).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: true },
      libraryKey,
    );
  });

  it("upserts and returns updated content for a member", async () => {
    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      shortBio: "Updated bio",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...content, shortBio: "Updated bio" });
    expect(mockUpsertPressConfig).toHaveBeenCalledWith(profile.id, {
      shortBio: "Updated bio",
    });
  });
});

describe("POST /api/creators/:creatorId/press-config/publish", () => {
  it("publishes the pending draft for an authorized editor", async () => {
    const res = await json("POST", "/api/creators/test-creator/press-config/publish");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(content);
    expect(mockPublishPressConfig).toHaveBeenCalledWith(profile.id);
  });

  it("enforces edit permission before publishing", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValueOnce(new ForbiddenError("Not a member"));

    const res = await json("POST", "/api/creators/test-creator/press-config/publish");

    expect(res.status).toBe(403);
    expect(mockPublishPressConfig).not.toHaveBeenCalled();
  });
});

describe("POST /api/creators/:creatorId/press-config/unpublish", () => {
  it("takes the live press page offline for an authorized editor", async () => {
    const res = await json("POST", "/api/creators/test-creator/press-config/unpublish");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...content, enabled: false });
    expect(mockUnpublishPressConfig).toHaveBeenCalledWith(profile.id);
  });

  it("enforces edit permission before unpublishing", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValueOnce(new ForbiddenError("Not a member"));

    const res = await json("POST", "/api/creators/test-creator/press-config/unpublish");

    expect(res.status).toBe(403);
    expect(mockUnpublishPressConfig).not.toHaveBeenCalled();
  });
});

describe("POST /api/creators/:creatorId/press-config/discard-draft", () => {
  it("discards the pending draft for an authorized editor", async () => {
    const res = await json("POST", "/api/creators/test-creator/press-config/discard-draft");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(content);
    expect(mockDiscardPressDraft).toHaveBeenCalledWith(profile.id);
  });
});

describe("POST /api/creators/:creatorId/press/image-preview", () => {
  const request = {
    key: libraryKey,
    crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 },
    slot: "gallery",
    width: 960,
  };

  it("returns the exact signed descriptor for an authorized crop", async () => {
    const res = await json(
      "POST",
      "/api/creators/test-creator/press/image-preview",
      request,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      src: `https://images.example/gallery/960/${libraryKey}`,
      srcSet: `https://images.example/gallery/960/${libraryKey} 960w`,
      sizes: "100vw",
    });
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(
      { key: libraryKey, alt: "", crop: request.crop },
      "gallery",
      960,
    );
  });

  it("returns 401 without attempting authorization or signing", async () => {
    ctx.auth.user = null;

    const res = await json(
      "POST",
      "/api/creators/test-creator/press/image-preview",
      request,
    );

    expect(res.status).toBe(401);
    expect(mockCanUseAsset).not.toHaveBeenCalled();
    expect(mockBuildPressImageUrl).not.toHaveBeenCalled();
  });

  it("returns 403 when the user lacks creator permission", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValueOnce(new ForbiddenError("Not a member"));

    const res = await json(
      "POST",
      "/api/creators/test-creator/press/image-preview",
      request,
    );

    expect(res.status).toBe(403);
    expect(mockCanUseAsset).not.toHaveBeenCalled();
    expect(mockBuildPressImageUrl).not.toHaveBeenCalled();
  });

  it("returns 400 without signing an unavailable library asset", async () => {
    mockCanUseAsset.mockResolvedValueOnce(false);

    const res = await json(
      "POST",
      "/api/creators/test-creator/press/image-preview",
      request,
    );

    expect(res.status).toBe(400);
    expect(mockBuildPressImageUrl).not.toHaveBeenCalled();
  });
});
