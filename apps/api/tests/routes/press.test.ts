import { describe, expect, it, vi } from "vitest";

import { ok } from "@snc/shared";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

const mockFindCreatorProfile = vi.fn();
const mockGetPressConfig = vi.fn();
const mockUpsertPressConfig = vi.fn();
const mockRequireCreatorPermission = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageDownload = vi.fn();
const mockBuildPressImageUrl = vi.fn();

const profile = {
  id: "creator_test123",
  displayName: "Test Creator",
  bio: "A test creator",
  handle: "test-creator",
  avatarKey: null,
  bannerKey: null,
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
      upsertPressConfig: mockUpsertPressConfig,
    }));
    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
    }));
    vi.doMock("../../src/storage/index.js", () => ({
      storage: {
        upload: mockStorageUpload,
        download: mockStorageDownload,
      },
    }));
    vi.doMock("../../src/lib/imgproxy.js", () => ({
      buildPressImageUrl: mockBuildPressImageUrl,
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
    mockUpsertPressConfig.mockResolvedValue(
      ok({ ...content, shortBio: "Updated bio" }),
    );
    mockRequireCreatorPermission.mockResolvedValue(undefined);
    mockStorageUpload.mockResolvedValue(ok(undefined));
    mockBuildPressImageUrl.mockImplementation((image, slot, width) => ({
      src: `https://images.example/${slot}/${width}/${image.key}`,
      srcSet: `https://images.example/${slot}/${width}/${image.key} ${width}w`,
      sizes: "100vw",
    }));
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
        src: `https://images.example/banner/1920/${banner.key}`,
        srcSet: `https://images.example/banner/1920/${banner.key} 1920w`,
        sizes: "100vw",
      },
    });
    expect(mockBuildPressImageUrl).toHaveBeenCalledWith(banner, "banner", 1920);
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
  });
});

describe("GET /api/creators/:creatorId/press/one-pager.pdf", () => {
  it("matches the literal PDF route and returns a PDF response", async () => {
    ctx.auth.user = null;

    const res = await json("GET", "/api/creators/test-creator/press/one-pager.pdf");
    const body = Buffer.from(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    expect(body.subarray(0, 4).toString("ascii")).toBe("%PDF");
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

  it("returns 400 for an invalid patch", async () => {
    const res = await json("PATCH", "/api/creators/test-creator/press-config", {
      pressContactEmail: "not-an-email",
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

describe("POST /api/creators/:creatorId/press/photos", () => {
  it("stores a photo under the creator press prefix and returns its key", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File(["image data"], "Shoot Photo 01.JPG", { type: "image/jpeg" }),
    );

    const res = await ctx.app.request(
      "/api/creators/test-creator/press/photos",
      { method: "POST", body: formData },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ key: "creators/creator_test123/press/shoot-photo-01.jpg" });
    expect(mockStorageUpload).toHaveBeenCalledWith(
      "creators/creator_test123/press/shoot-photo-01.jpg",
      expect.anything(),
      expect.objectContaining({ contentType: "image/jpeg", contentLength: 10 }),
    );
  });

  it("returns 403 when the user lacks editProfile permission", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValueOnce(
      new ForbiddenError("Not a member"),
    );
    const formData = new FormData();
    formData.append("file", new File(["image data"], "photo.jpg", { type: "image/jpeg" }));

    const res = await ctx.app.request(
      "/api/creators/test-creator/press/photos",
      { method: "POST", body: formData },
    );

    expect(res.status).toBe(403);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request(
      "/api/creators/test-creator/press/photos",
      { method: "POST", body: new FormData() },
    );

    expect(res.status).toBe(401);
  });
});
