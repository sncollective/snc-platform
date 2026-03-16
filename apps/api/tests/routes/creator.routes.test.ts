import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import { makeMockDbCreatorProfile } from "../helpers/creator-fixtures.js";
import { ok, textToStream } from "@snc/shared";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Creator Team Mock ──

const mockRequireCreatorPermission = vi.fn();
// Holds the ForbiddenError class from the same module instance as the error handler
// (captured in mocks() callback since vi.resetModules() runs between tests)
let TestForbiddenError: new (msg?: string) => Error;

// ── Storage Mock ──

const mockStorageUpload = vi.fn();
const mockStorageDownload = vi.fn();
const mockStorageDelete = vi.fn();

const mockStorage = {
  upload: mockStorageUpload,
  download: mockStorageDownload,
  delete: mockStorageDelete,
  getSignedUrl: vi.fn(),
};

const mockDownloadResult = (text: string) =>
  ok({ stream: textToStream(text), size: new TextEncoder().encode(text).byteLength });

// ── Mock DB Chains ──

// Simple select queries: select → from → where (returns promise directly)
const mockSelectWhere = vi.fn();

// List query chain: select → from → where → orderBy → limit
const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));

// Batch count query chain: select → from → where → groupBy
const mockGroupBy = vi.fn();

const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

// INSERT chain (for ensureCreatorProfile and upsert in PATCH)
const mockInsertReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn(() => ({
  returning: mockInsertReturning,
}));
const mockInsertValues = vi.fn(() => ({
  returning: mockInsertReturning,
  onConflictDoNothing: mockOnConflictDoNothing,
}));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

// UPDATE chain
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() =>
  chainablePromise(undefined, { returning: mockUpdateReturning }),
);
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: { roles: ["subscriber", "creator"] },
  mocks: ({ ForbiddenError }) => {
    TestForbiddenError = ForbiddenError;

    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: {},
      creatorMembers: {},
    }));

    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
      getCreatorMemberships: vi.fn().mockResolvedValue([]),
    }));

    vi.doMock("../../src/db/schema/content.schema.js", () => ({
      content: {},
    }));

    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: {},
      userRoles: {},
    }));

    vi.doMock("../../src/storage/index.js", () => ({
      storage: mockStorage,
      createStorageProvider: vi.fn(),
    }));
  },
  mountRoute: async (app) => {
    const { creatorRoutes } = await import(
      "../../src/routes/creator.routes.js"
    );
    app.route("/api/creators", creatorRoutes);
  },
  beforeEach: () => {
    // Re-establish SELECT chain after clearAllMocks.
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockImplementation(() => ({
      where: mockSelectWhere,
      orderBy: vi.fn(() => ({ limit: mockLimit })),
    }));

    // Default db mock responses
    mockSelectWhere.mockResolvedValue([]);
    mockLimit.mockResolvedValue([]);
    mockGroupBy.mockResolvedValue([]);
    mockInsertReturning.mockResolvedValue([]);
    mockUpdateReturning.mockResolvedValue([]);

    // Re-establish INSERT chain
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
      onConflictDoNothing: mockOnConflictDoNothing,
    });
    mockOnConflictDoNothing.mockReturnValue({
      returning: mockInsertReturning,
    });

    // Re-establish UPDATE chain
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockImplementation(() =>
      chainablePromise(undefined, { returning: mockUpdateReturning }),
    );

    // Default storage mock responses
    mockStorageUpload.mockResolvedValue(ok({ key: "test-key", size: 100 }));
    mockStorageDownload.mockResolvedValue(ok({ stream: new ReadableStream(), size: 0 }));
    mockStorageDelete.mockResolvedValue(ok(undefined));

    // Default: permission check passes (no throw)
    mockRequireCreatorPermission.mockResolvedValue(undefined);
  },
});

// ── Tests ──

describe("creator routes", () => {
  // ── GET /api/creators ──

  describe("GET /api/creators", () => {
    it("returns paginated list of creators with content counts", async () => {
      const profiles = [
        makeMockDbCreatorProfile({
          id: "user_1",
          displayName: "Creator One",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
        makeMockDbCreatorProfile({
          id: "user_2",
          displayName: "Creator Two",
          createdAt: new Date("2026-01-15T00:00:00.000Z"),
        }),
        makeMockDbCreatorProfile({
          id: "user_3",
          displayName: "Creator Three",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ];

      // List query: where → orderBy → limit (returns 3 profiles = 2 + 1 extra)
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockLimit.mockResolvedValueOnce(profiles);

      // Batch content count for user_1 and user_2
      mockSelectWhere.mockReturnValueOnce({ groupBy: mockGroupBy });
      mockGroupBy.mockResolvedValueOnce([
        { creatorId: "user_1", count: 5 },
        { creatorId: "user_2", count: 3 },
      ]);

      const res = await ctx.app.request("/api/creators?limit=2");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.items[0].displayName).toBe("Creator One");
      expect(body.items[0].contentCount).toBe(5);
      expect(body.items[1].contentCount).toBe(3);
      expect(body.nextCursor).not.toBeNull();
    });

    it("returns empty list when no creators exist", async () => {
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockLimit.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/creators");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it("resolves avatar and banner URLs from storage keys", async () => {
      const profile = makeMockDbCreatorProfile({
        avatarKey: "avatars/user_test123.jpg",
        bannerKey: "banners/user_test123.jpg",
      });

      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockLimit.mockResolvedValueOnce([profile]);
      // Batch content count for 1 profile
      mockSelectWhere.mockReturnValueOnce({ groupBy: mockGroupBy });
      mockGroupBy.mockResolvedValueOnce([{ creatorId: "user_test123", count: 0 }]);

      const res = await ctx.app.request("/api/creators");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].avatarUrl).toBe(
        "/api/creators/user_test123/avatar",
      );
      expect(body.items[0].bannerUrl).toBe(
        "/api/creators/user_test123/banner",
      );
    });

    it("supports cursor-based pagination for second page", async () => {
      // Encode a valid cursor
      const cursor = Buffer.from(
        JSON.stringify({
          createdAt: "2026-01-15T00:00:00.000Z",
          id: "user_2",
        }),
      ).toString("base64url");

      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockLimit.mockResolvedValueOnce([]);

      const res = await ctx.app.request(`/api/creators?cursor=${cursor}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
      // Verify the chain was called (list query was executed)
      expect(mockOrderBy).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalled();
    });

    it("returns socialLinks for each creator in list", async () => {
      const profiles = [
        makeMockDbCreatorProfile({
          id: "user_1",
          displayName: "Creator One",
          socialLinks: [
            { platform: "bandcamp", url: "https://creator1.bandcamp.com" },
          ],
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
        makeMockDbCreatorProfile({
          id: "user_2",
          displayName: "Creator Two",
          socialLinks: [],
          createdAt: new Date("2026-01-15T00:00:00.000Z"),
        }),
      ];

      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockLimit.mockResolvedValueOnce(profiles);

      // Batch content count for both profiles
      mockSelectWhere.mockReturnValueOnce({ groupBy: mockGroupBy });
      mockGroupBy.mockResolvedValueOnce([
        { creatorId: "user_1", count: 5 },
        { creatorId: "user_2", count: 3 },
      ]);

      const res = await ctx.app.request("/api/creators");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.items[0].socialLinks).toEqual([
        { platform: "bandcamp", url: "https://creator1.bandcamp.com" },
      ]);
      expect(body.items[1].socialLinks).toEqual([]);
    });
  });

  // ── GET /api/creators/:creatorId ──

  describe("GET /api/creators/:creatorId", () => {
    it("returns creator profile with content count", async () => {
      const dbProfile = makeMockDbCreatorProfile();

      // findCreatorProfile query
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      // getContentCount query
      mockSelectWhere.mockResolvedValueOnce([{ count: 7 }]);

      const res = await ctx.app.request("/api/creators/user_test123");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("user_test123");
      expect(body.displayName).toBe("Test Creator");
      expect(body.contentCount).toBe(7);
      expect(body.bio).toBe("A test creator bio");
    });

    it("returns 404 for non-existent creator", async () => {
      // findCreatorProfile → empty (no profile)
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/creators/nonexistent-creator");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns socialLinks in profile response", async () => {
      const socialLinks = [
        { platform: "bandcamp" as const, url: "https://myband.bandcamp.com" },
        { platform: "spotify" as const, url: "https://open.spotify.com/artist/123" },
      ];
      const dbProfile = makeMockDbCreatorProfile({ socialLinks });

      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const res = await ctx.app.request("/api/creators/user_test123");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.socialLinks).toEqual(socialLinks);
    });

    it("returns empty socialLinks when none configured", async () => {
      const dbProfile = makeMockDbCreatorProfile();

      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const res = await ctx.app.request("/api/creators/user_test123");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.socialLinks).toEqual([]);
    });
  });

  // ── PATCH /api/creators/:creatorId ──

  describe("PATCH /api/creators/:creatorId", () => {
    it("updates displayName and bio for owner", async () => {
      const dbProfile = makeMockDbCreatorProfile();
      const updatedProfile = makeMockDbCreatorProfile({
        displayName: "New Name",
        bio: "New bio",
      });

      // findCreatorProfile → existing profile
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      // update returning
      mockUpdateReturning.mockResolvedValueOnce([updatedProfile]);
      // getContentCount
      mockSelectWhere.mockResolvedValueOnce([{ count: 3 }]);

      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "New Name", bio: "New bio" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.displayName).toBe("New Name");
      expect(body.bio).toBe("New bio");
      expect(body.contentCount).toBe(3);
    });

    it("returns 404 when no profile exists to update", async () => {
      // requireCreatorPermission passes, but findCreatorProfile returns empty
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "New Name" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 403 when non-owner tries to update", async () => {
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: editProfile"),
      );

      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Hacked Name" }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when non-creator role tries to update", async () => {
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: editProfile"),
      );

      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Some Name" }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Some Name" }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 for invalid fields", async () => {
      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("updates socialLinks with valid entries", async () => {
      const socialLinks = [
        { platform: "bandcamp", url: "https://myband.bandcamp.com" },
        { platform: "spotify", url: "https://open.spotify.com/artist/123" },
      ];
      const dbProfile = makeMockDbCreatorProfile();
      const updatedProfile = makeMockDbCreatorProfile({ socialLinks });

      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      mockUpdateReturning.mockResolvedValueOnce([updatedProfile]);
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialLinks }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.socialLinks).toEqual(socialLinks);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ socialLinks }),
      );
    });

    it("clears socialLinks with empty array", async () => {
      const dbProfile = makeMockDbCreatorProfile({
        socialLinks: [
          { platform: "bandcamp", url: "https://myband.bandcamp.com" },
        ],
      });
      const updatedProfile = makeMockDbCreatorProfile({ socialLinks: [] });

      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      mockUpdateReturning.mockResolvedValueOnce([updatedProfile]);
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialLinks: [] }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.socialLinks).toEqual([]);
    });

    it("rejects socialLinks with invalid platform", async () => {
      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialLinks: [{ platform: "myspace", url: "https://myspace.com/band" }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects socialLinks with invalid URL", async () => {
      const res = await ctx.app.request("/api/creators/user_test123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialLinks: [{ platform: "bandcamp", url: "not a url" }],
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/creators/:creatorId/avatar ──

  describe("POST /api/creators/:creatorId/avatar", () => {
    it("uploads avatar and returns updated profile for owner", async () => {
      const dbProfile = makeMockDbCreatorProfile({ avatarKey: null });
      const updatedProfile = makeMockDbCreatorProfile({
        avatarKey: "creators/user_test123/avatar/photo.jpg",
      });

      // findCreatorProfile → existing profile without avatarKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      // update returning
      mockUpdateReturning.mockResolvedValueOnce([updatedProfile]);
      // getContentCount
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const formData = new FormData();
      formData.append("file", new File(["image data"], "photo.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/avatar", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.avatarUrl).toBe("/api/creators/user_test123/avatar");
      expect(mockStorageUpload).toHaveBeenCalledOnce();
      const [uploadKey] = mockStorageUpload.mock.calls[0] as [string, ...unknown[]];
      expect(uploadKey).toMatch(/^creators\/user_test123\/avatar\//);
      expect(mockUpdateReturning).toHaveBeenCalledOnce();
    });

    it("deletes old avatar when re-uploading", async () => {
      const dbProfile = makeMockDbCreatorProfile({
        avatarKey: "old-key/avatar/old.jpg",
      });
      const updatedProfile = makeMockDbCreatorProfile({
        avatarKey: "creators/user_test123/avatar/new.jpg",
      });

      // findCreatorProfile → profile with existing avatarKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      // update returning
      mockUpdateReturning.mockResolvedValueOnce([updatedProfile]);
      // getContentCount
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const formData = new FormData();
      formData.append("file", new File(["new image"], "new.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/avatar", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(200);
      expect(mockStorageDelete).toHaveBeenCalledWith("old-key/avatar/old.jpg");
      expect(mockStorageUpload).toHaveBeenCalledOnce();
    });

    it("returns 403 when non-owner uploads", async () => {
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: editProfile"),
      );

      const formData = new FormData();
      formData.append("file", new File(["data"], "photo.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/avatar", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when non-creator role uploads", async () => {
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: editProfile"),
      );

      const formData = new FormData();
      formData.append("file", new File(["data"], "photo.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/avatar", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid MIME type", async () => {
      const formData = new FormData();
      formData.append("file", new File(["data"], "doc.txt", { type: "text/plain" }));

      const res = await ctx.app.request("/api/creators/user_test123/avatar", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("returns 400 when Content-Length exceeds limit", async () => {
      const res = await ctx.app.request("/api/creators/user_test123/avatar", {
        method: "POST",
        headers: { "content-length": "20000000" },
        body: new FormData(),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ── POST /api/creators/:creatorId/banner ──

  describe("POST /api/creators/:creatorId/banner", () => {
    it("uploads banner and returns updated profile for owner", async () => {
      const dbProfile = makeMockDbCreatorProfile({ bannerKey: null });
      const updatedProfile = makeMockDbCreatorProfile({
        bannerKey: "creators/user_test123/banner/header.jpg",
      });

      // findCreatorProfile → existing profile without bannerKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      // update returning
      mockUpdateReturning.mockResolvedValueOnce([updatedProfile]);
      // getContentCount
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const formData = new FormData();
      formData.append("file", new File(["banner data"], "header.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/banner", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bannerUrl).toBe("/api/creators/user_test123/banner");
      expect(mockStorageUpload).toHaveBeenCalledOnce();
      const [uploadKey] = mockStorageUpload.mock.calls[0] as [string, ...unknown[]];
      expect(uploadKey).toMatch(/^creators\/user_test123\/banner\//);
      expect(mockUpdateReturning).toHaveBeenCalledOnce();
    });

    it("deletes old banner when re-uploading", async () => {
      const dbProfile = makeMockDbCreatorProfile({
        bannerKey: "old-banner-key/banner/old.jpg",
      });
      const updatedProfile = makeMockDbCreatorProfile({
        bannerKey: "creators/user_test123/banner/new.jpg",
      });

      // findCreatorProfile → profile with existing bannerKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      // update returning
      mockUpdateReturning.mockResolvedValueOnce([updatedProfile]);
      // getContentCount
      mockSelectWhere.mockResolvedValueOnce([{ count: 0 }]);

      const formData = new FormData();
      formData.append("file", new File(["new banner"], "new.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/banner", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(200);
      expect(mockStorageDelete).toHaveBeenCalledWith("old-banner-key/banner/old.jpg");
      expect(mockStorageUpload).toHaveBeenCalledOnce();
    });

    it("returns 403 when non-owner uploads", async () => {
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: editProfile"),
      );

      const formData = new FormData();
      formData.append("file", new File(["data"], "banner.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/banner", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when non-creator role uploads", async () => {
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: editProfile"),
      );

      const formData = new FormData();
      formData.append("file", new File(["data"], "banner.jpg", { type: "image/jpeg" }));

      const res = await ctx.app.request("/api/creators/user_test123/banner", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 when Content-Length exceeds limit", async () => {
      const res = await ctx.app.request("/api/creators/user_test123/banner", {
        method: "POST",
        headers: { "content-length": "20000000" },
        body: new FormData(),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for invalid MIME type", async () => {
      const formData = new FormData();
      formData.append("file", new File(["data"], "banner.txt", { type: "text/plain" }));

      const res = await ctx.app.request("/api/creators/user_test123/banner", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });
  });

  // ── GET /api/creators/:creatorId/avatar ──

  describe("GET /api/creators/:creatorId/avatar", () => {
    it("streams avatar image with correct headers", async () => {
      const dbProfile = makeMockDbCreatorProfile({
        avatarKey: "creators/user_test123/avatar/photo.jpg",
      });

      // findCreatorProfile → profile with avatarKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      mockStorageDownload.mockResolvedValueOnce(mockDownloadResult("image data"));

      const res = await ctx.app.request("/api/creators/user_test123/avatar");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
      expect(res.headers.get("Content-Disposition")).toContain("inline");
      const body = await res.text();
      expect(body).toBe("image data");
    });

    it("returns 404 when no avatar uploaded", async () => {
      const dbProfile = makeMockDbCreatorProfile({ avatarKey: null });

      // findCreatorProfile → profile with null avatarKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);

      const res = await ctx.app.request("/api/creators/user_test123/avatar");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when creator profile does not exist", async () => {
      // findCreatorProfile → not found
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/creators/user_test123/avatar");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // ── GET /api/creators/:creatorId/banner ──

  describe("GET /api/creators/:creatorId/banner", () => {
    it("streams banner image with correct headers", async () => {
      const dbProfile = makeMockDbCreatorProfile({
        bannerKey: "creators/user_test123/banner/header.png",
      });

      // findCreatorProfile → profile with bannerKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);
      mockStorageDownload.mockResolvedValueOnce(mockDownloadResult("banner data"));

      const res = await ctx.app.request("/api/creators/user_test123/banner");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
      expect(res.headers.get("Content-Disposition")).toContain("inline");
      const body = await res.text();
      expect(body).toBe("banner data");
    });

    it("returns 404 when no banner uploaded", async () => {
      const dbProfile = makeMockDbCreatorProfile({ bannerKey: null });

      // findCreatorProfile → profile with null bannerKey
      mockSelectWhere.mockResolvedValueOnce([dbProfile]);

      const res = await ctx.app.request("/api/creators/user_test123/banner");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when creator profile does not exist", async () => {
      // findCreatorProfile → not found
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await ctx.app.request("/api/creators/user_test123/banner");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
