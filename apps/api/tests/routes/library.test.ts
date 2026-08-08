import { describe, expect, it, vi } from "vitest";

import { ok } from "@snc/shared";

import { makeMockUser } from "../helpers/auth-fixtures.js";
import { setupRouteTest } from "../helpers/route-test-factory.js";

const mockFindCreatorProfile = vi.fn();
const mockRequireCreatorPermission = vi.fn();
const mockUploadLibraryAsset = vi.fn();
const mockListLibraryAssets = vi.fn();
const mockGetLibraryAsset = vi.fn();
const mockDeleteLibraryAsset = vi.fn();
const mockGrantLibraryAssetUse = vi.fn();
const mockRevokeLibraryAssetUse = vi.fn();

const profile = {
  id: "creator_test123",
  displayName: "Test Creator",
  bio: null,
  handle: "test-creator",
  avatarKey: null,
  bannerKey: null,
  socialLinks: [],
  status: "active" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const asset = {
  id: "00000000-0000-4000-a000-000000000001",
  creatorId: profile.id,
  blobSha256: "a".repeat(64),
  sharing: "private" as const,
  originalFilename: "image.png",
  createdAt: "2026-01-01T00:00:00.000Z",
  storageKey: `library/aa/${"a".repeat(64)}.png`,
  mimeType: "image/png" as const,
  size: 4,
  width: 1,
  height: 1,
  canUse: true,
  useStatus: "own" as const,
};

const ctx = setupRouteTest({
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: ({ UnauthorizedError }) => {
    // The shared route-test helper's auth mock predates role hydration. Override
    // it here because admin-vs-creator registration is part of this route contract.
    vi.doMock("../../src/middleware/require-auth.js", () => ({
      requireAuth: async (c: any, next: any) => {
        if (!ctx.auth.user) throw new UnauthorizedError();
        c.set("user", ctx.auth.user);
        c.set("session", ctx.auth.session);
        c.set("roles", ctx.auth.roles);
        await next();
      },
    }));
    vi.doMock("../../src/lib/creator-helpers.js", () => ({
      findCreatorProfile: mockFindCreatorProfile,
    }));
    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
    }));
    vi.doMock("../../src/services/library.js", () => ({
      uploadLibraryAsset: mockUploadLibraryAsset,
      listLibraryAssets: mockListLibraryAssets,
      getLibraryAsset: mockGetLibraryAsset,
      deleteLibraryAsset: mockDeleteLibraryAsset,
      grantLibraryAssetUse: mockGrantLibraryAssetUse,
      revokeLibraryAssetUse: mockRevokeLibraryAssetUse,
    }));
  },
  mountRoute: async (app) => {
    const { libraryRoutes } = await import("../../src/routes/library.routes.js");
    app.route("/api/creators", libraryRoutes);
  },
  beforeEach: () => {
    mockFindCreatorProfile.mockResolvedValue(profile);
    mockRequireCreatorPermission.mockResolvedValue(undefined);
    mockUploadLibraryAsset.mockResolvedValue(ok({ asset, deduped: false }));
    mockListLibraryAssets.mockResolvedValue(ok({ items: [asset], nextCursor: null }));
    mockGetLibraryAsset.mockResolvedValue(ok(asset));
    mockDeleteLibraryAsset.mockResolvedValue(ok(undefined));
    mockGrantLibraryAssetUse.mockResolvedValue(ok(undefined));
    mockRevokeLibraryAssetUse.mockResolvedValue(ok(undefined));
  },
});

describe("content library routes", () => {
  it("uploads a multipart image with sharing after creator authorization", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3, 4])], "image.png", { type: "image/png" }));
    form.append("sharing", "requestable");

    const response = await ctx.app.request("/api/creators/test-creator/library/assets", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ...asset, deduped: false });
    expect(mockRequireCreatorPermission).toHaveBeenCalledWith(
      ctx.auth.user!.id,
      profile.id,
      "editProfile",
      [],
    );
    expect(mockUploadLibraryAsset).toHaveBeenCalledWith(
      profile.id,
      expect.objectContaining({ declaredType: "image/png", size: 4 }),
      "requestable",
    );
  });

  it("registers an admin upload as platform-submitted", async () => {
    ctx.auth.roles = ["admin"];
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1])], "image.png", { type: "image/png" }));

    const response = await ctx.app.request("/api/creators/test-creator/library/assets", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(200);
    expect(mockUploadLibraryAsset).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ size: 1 }),
      "private",
    );
  });

  it("returns 401 before resolving the creator when unauthenticated", async () => {
    ctx.auth.user = null;
    const response = await ctx.app.request("/api/creators/test-creator/library/assets");

    expect(response.status).toBe(401);
    expect(mockFindCreatorProfile).not.toHaveBeenCalled();
  });

  it("returns 403 before touching the library when permission is denied", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValueOnce(new ForbiddenError("Not a member"));
    const response = await ctx.app.request("/api/creators/test-creator/library/assets");

    expect(response.status).toBe(403);
    expect(mockListLibraryAssets).not.toHaveBeenCalled();
  });

  it("passes browse actor and keyset options to list/get/delete", async () => {
    const listResponse = await ctx.app.request(
      "/api/creators/test-creator/library/assets?limit=1",
    );
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({ items: [asset], nextCursor: null });
    expect(mockListLibraryAssets).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: false },
      { limit: 1 },
    );

    const getResponse = await ctx.app.request(
      `/api/creators/test-creator/library/assets/${asset.id}`,
    );
    expect(getResponse.status).toBe(200);
    expect(mockGetLibraryAsset).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: false },
      asset.id,
    );

    const deleteResponse = await ctx.app.request(
      `/api/creators/test-creator/library/assets/${asset.id}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(204);
    expect(mockDeleteLibraryAsset).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: false },
      asset.id,
    );
  });

  it("grants and revokes requestable-asset use", async () => {
    const grantResponse = await ctx.app.request(
      `/api/creators/test-creator/library/assets/${asset.id}/grants`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ granteeCreatorId: "creator-other" }),
      },
    );
    expect(grantResponse.status).toBe(204);
    expect(mockGrantLibraryAssetUse).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: false },
      asset.id,
      "creator-other",
      ctx.auth.user!.id,
    );

    const revokeResponse = await ctx.app.request(
      `/api/creators/test-creator/library/assets/${asset.id}/grants/creator-other`,
      { method: "DELETE" },
    );
    expect(revokeResponse.status).toBe(204);
    expect(mockRevokeLibraryAssetUse).toHaveBeenCalledWith(
      { creatorId: profile.id, isAdmin: false },
      asset.id,
      "creator-other",
    );
  });
});
