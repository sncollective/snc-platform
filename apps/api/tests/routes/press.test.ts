import { describe, expect, it, vi } from "vitest";

import { ok } from "@snc/shared";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

const mockFindCreatorProfile = vi.fn();
const mockGetPressConfig = vi.fn();
const mockUpsertPressConfig = vi.fn();
const mockRequireCreatorPermission = vi.fn();
const mockStorageUpload = vi.fn();

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

const content = {
  enabled: true,
  shortBio: "A test creator short bio",
  longBio: null,
  forFansOf: ["Alternative pop"],
  streamingLinks: [{ label: "Bandcamp", url: "https://example.com/listen" }],
  liveDatesUrl: null,
  standoutTrack: {
    title: "Get to You",
    url: "https://example.com/get-to-you",
    streamsLabel: "14.5k streams",
  },
  pressContactEmail: "press@example.com",
  location: "Philadelphia, PA",
  photos: [],
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
      storage: { upload: mockStorageUpload },
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
    expect(body.content).toEqual(content);
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
