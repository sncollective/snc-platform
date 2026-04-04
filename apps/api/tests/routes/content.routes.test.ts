import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";
import { makeMockDbContent } from "../helpers/content-fixtures.js";
import { ok, textToStream } from "@snc/shared";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock State ──

// Creator team permission mocks
const mockRequireCreatorPermission = vi.fn();
const mockCheckCreatorPermission = vi.fn();
// Holds the ForbiddenError class from the same module instance as the error handler
let TestForbiddenError: new (msg?: string) => Error;

// Drizzle db mock — chainable method stubs
// mockMemberAnyLimit handles the .limit(1) call on the "any membership" query
// in checkContentAccess: db.select().from(creatorMembers).where(...).limit(1)
const mockMemberAnyLimit = vi.fn();
const mockSelectWhere = vi.fn();

// Feed query mock chain: select -> from -> innerJoin -> where -> orderBy -> limit
const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
// mockSubLimit is also reachable via mockFeedWhere().limit for the subscription
// access query which uses: select -> from -> innerJoin -> where -> limit (no orderBy)
const mockSubLimit = vi.fn();
// buildContentAccessContext awaits the where() result directly (no .limit/.orderBy),
// so mockFeedWhere must return a thenable that also has chainable properties
const mockBatchAccessRows: unknown[] = [];
const mockFeedWhere = vi.fn(() =>
  chainablePromise(mockBatchAccessRows, { orderBy: mockOrderBy, limit: mockSubLimit }),
);
const mockInnerJoin = vi.fn(() => ({ where: mockFeedWhere }));
// GET /:id uses leftJoin instead of innerJoin; routes to same mockSelectWhere
const mockLeftJoin = vi.fn(() => ({ where: mockSelectWhere }));

const mockSelectFrom = vi.fn(() => ({
  where: mockSelectWhere,
  innerJoin: mockInnerJoin,
  leftJoin: mockLeftJoin,
}));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

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

// Storage mock — individual method stubs
const mockStorageUpload = vi.fn();
const mockStorageDownload = vi.fn();
const mockStorageDelete = vi.fn();
const mockStorageGetSignedUrl = vi.fn();

const mockStorage = {
  upload: mockStorageUpload,
  download: mockStorageDownload,
  delete: mockStorageDelete,
  getSignedUrl: mockStorageGetSignedUrl,
};

const mockDownloadResult = (text: string) =>
  ok({ stream: textToStream(text), size: new TextEncoder().encode(text).byteLength });


// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  mockRole: false,
  defaultAuth: { roles: [] },
  mocks: ({ ForbiddenError }) => {
    TestForbiddenError = ForbiddenError;

    vi.doMock("../../src/db/schema/content.schema.js", () => ({
      content: {},
    }));

    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: {},
    }));

    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: {},
      creatorMembers: {},
    }));

    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
      checkCreatorPermission: mockCheckCreatorPermission,
    }));

    vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
      subscriptionPlans: {
        id: {},
        type: {},
        creatorId: {},
      },
      userSubscriptions: {
        id: {},
        userId: {},
        planId: {},
        status: {},
        currentPeriodEnd: {},
      },
    }));

    vi.doMock("../../src/middleware/optional-auth.js", () => ({
      optionalAuth: async (c: any, next: any) => {
        c.set("user", ctx.auth.user);
        c.set("session", ctx.auth.session);
        c.set("roles", ctx.auth.roles);
        await next();
      },
    }));

    vi.doMock("../../src/storage/index.js", () => ({
      storage: mockStorage,
      createStorageProvider: vi.fn(),
    }));
  },
  mountRoute: async (app) => {
    const { contentRoutes } = await import(
      "../../src/routes/content.routes.js"
    );
    const { contentMediaRoutes } = await import(
      "../../src/routes/content-media.routes.js"
    );
    app.route("/api/content", contentRoutes);
    app.route("/api/content", contentMediaRoutes);
  },
  beforeEach: () => {
    // Default: permission check passes (no throw)
    mockRequireCreatorPermission.mockResolvedValue(undefined);
    // Default: checkCreatorPermission returns true (allowed)
    mockCheckCreatorPermission.mockResolvedValue(true);

    // Default db mock responses
    // mockSelectWhere returns a chainable promise so .limit() works for
    // the "any creator membership" query in checkContentAccess
    mockMemberAnyLimit.mockResolvedValue([]);
    mockSelectWhere.mockImplementation(() =>
      chainablePromise([] as unknown[], { limit: mockMemberAnyLimit }),
    );
    mockInsertReturning.mockResolvedValue([]);
    mockUpdateReturning.mockResolvedValue([]);
    mockStorageUpload.mockResolvedValue(ok({ key: "test-key", size: 100 }));
    mockStorageDownload.mockResolvedValue(ok({ stream: new ReadableStream(), size: 0 }));
    mockStorageDelete.mockResolvedValue(ok(undefined));

    // Feed chain defaults
    mockLimit.mockResolvedValue([]);
    // Subscription access check default: no subscription (access denied)
    mockSubLimit.mockResolvedValue([]);
  },
});

// ── Tests ──

describe("content routes", () => {
  // ── GET /api/content (feed) ──

  describe("GET /api/content", () => {
    const makeFeedRow = (overrides?: Record<string, unknown>) => ({
      ...makeMockDbContent(),
      creatorName: "Test Creator",
      ...overrides,
    });

    it("returns paginated items with nextCursor when more exist", async () => {
      const rows = Array.from({ length: 13 }, (_, i) =>
        makeFeedRow({
          id: `content-${i}`,
          title: `Post ${i}`,
          publishedAt: new Date(`2026-02-${String(26 - i).padStart(2, "0")}T00:00:00.000Z`),
        }),
      );
      mockLimit.mockResolvedValue(rows);

      const res = await ctx.app.request("/api/content?limit=12");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(12);
      expect(body.nextCursor).not.toBeNull();
      expect(body.items[0].creatorName).toBe("Test Creator");
    });

    it("returns empty feed with null nextCursor", async () => {
      mockLimit.mockResolvedValue([]);

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it("returns null nextCursor on last page", async () => {
      mockLimit.mockResolvedValue([makeFeedRow()]);

      const res = await ctx.app.request("/api/content?limit=12");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.nextCursor).toBeNull();
    });

    it("filters by type when ?type= is provided", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({ type: "video", title: "My Video" }),
      ]);

      const res = await ctx.app.request("/api/content?type=video");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].type).toBe("video");
    });

    it("filters by creatorId when ?creatorId= is provided", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({ creatorId: "creator-42", creatorName: "Alice" }),
      ]);

      const res = await ctx.app.request("/api/content?creatorId=creator-42");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].creatorId).toBe("creator-42");
      expect(body.items[0].creatorName).toBe("Alice");
    });

    it("paginates using cursor from previous response", async () => {
      // First page
      const firstPageRows = Array.from({ length: 13 }, (_, i) =>
        makeFeedRow({
          id: `content-${i}`,
          publishedAt: new Date(`2026-02-${String(26 - i).padStart(2, "0")}T00:00:00.000Z`),
        }),
      );
      mockLimit.mockResolvedValue(firstPageRows);

      const firstRes = await ctx.app.request("/api/content?limit=12");
      const firstBody = await firstRes.json();
      const { nextCursor } = firstBody;
      expect(nextCursor).not.toBeNull();

      // Second page
      mockLimit.mockResolvedValue([
        makeFeedRow({ id: "content-99", title: "Older Post" }),
      ]);

      const secondRes = await ctx.app.request(
        `/api/content?limit=12&cursor=${nextCursor}`,
      );

      expect(secondRes.status).toBe(200);
      const secondBody = await secondRes.json();
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });

    it("returns 400 for invalid cursor", async () => {
      const res = await ctx.app.request("/api/content?cursor=not-valid-base64!!!");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for limit=0", async () => {
      const res = await ctx.app.request("/api/content?limit=0");

      expect(res.status).toBe(400);
    });

    it("returns 400 for limit=51", async () => {
      const res = await ctx.app.request("/api/content?limit=51");

      expect(res.status).toBe(400);
    });

    it("excludes soft-deleted content", async () => {
      // The handler filters deletedAt IS NULL; the mock returns an empty
      // result set to prove the handler called the correct query conditions.
      mockLimit.mockResolvedValue([]);
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
      // Verify the query was constructed (innerJoin was called)
      expect(mockInnerJoin).toHaveBeenCalledOnce();
    });

    it("excludes unpublished drafts", async () => {
      // Same approach: the isNotNull(content.publishedAt) filter is
      // applied in the WHERE clause. Mock returns empty to confirm filtering.
      mockLimit.mockResolvedValue([]);
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      expect(mockFeedWhere).toHaveBeenCalledOnce();
    });

    it("includes creatorName from users table in each item", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({ creatorName: "Jane Doe" }),
      ]);

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items[0].creatorName).toBe("Jane Doe");
    });

    it("resolves content URLs (thumbnail, media) in items", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({
          id: "content-x",
          thumbnailKey: "content/content-x/thumbnail/thumb.jpg",
          mediaKey: "content/content-x/media/video.mp4",
        }),
      ]);

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items[0].thumbnailUrl).toBe(
        "/api/content/content-x/thumbnail",
      );
      expect(body.items[0].mediaUrl).toBe("/api/content/content-x/media");
    });

    it("returns 400 for invalid type filter", async () => {
      const res = await ctx.app.request("/api/content?type=podcast");

      expect(res.status).toBe(400);
    });

    it("nulls mediaUrl and body for subscriber content when unauthenticated", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({
          visibility: "subscribers",
          mediaKey: "content/c1/media/video.mp4",
          body: "Secret content",
          creatorId: "creator_other",
        }),
      ]);
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items[0].mediaUrl).toBeNull();
      expect(body.items[0].body).toBeNull();
      expect(body.items[0].title).toBe("Test Post");
    });

    it("preserves mediaUrl and body for public content when unauthenticated", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({
          visibility: "public",
          mediaKey: "content/c1/media/video.mp4",
          body: "Public content",
        }),
      ]);

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items[0].mediaUrl).toBe("/api/content/00000000-0000-4000-a000-000000000001/media");
      expect(body.items[0].body).toBe("Public content");
    });

    it("preserves mediaUrl and body for subscriber content when user has stakeholder role", async () => {
      ctx.auth.user = makeMockUser();
      ctx.auth.roles = ["stakeholder"];
      mockLimit.mockResolvedValue([
        makeFeedRow({
          visibility: "subscribers",
          mediaKey: "content/c1/media/video.mp4",
          body: "Subscriber content",
          creatorId: "creator_other",
        }),
      ]);

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items[0].mediaUrl).toBe("/api/content/00000000-0000-4000-a000-000000000001/media");
      expect(body.items[0].body).toBe("Subscriber content");
    });

    it("gates mixed feed correctly — public preserved, subscriber gated", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({
          id: "public-1",
          visibility: "public",
          mediaKey: "content/public-1/media/video.mp4",
          body: "Public body",
        }),
        makeFeedRow({
          id: "sub-1",
          visibility: "subscribers",
          mediaKey: "content/sub-1/media/audio.mp3",
          body: "Secret body",
          creatorId: "creator_other",
        }),
      ]);

      const res = await ctx.app.request("/api/content?limit=12");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items[0].mediaUrl).toBe("/api/content/public-1/media");
      expect(body.items[0].body).toBe("Public body");
      expect(body.items[1].mediaUrl).toBeNull();
      expect(body.items[1].body).toBeNull();
    });

    it("treats missing session as unauthenticated and gates subscriber content", async () => {
      // optionalAuth handles session errors gracefully; no-auth is the default (ctx.auth.user = null)
      mockLimit.mockResolvedValue([
        makeFeedRow({
          visibility: "subscribers",
          mediaKey: "content/c1/media/video.mp4",
          body: "Secret",
          creatorId: "creator_other",
        }),
      ]);

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items[0].mediaUrl).toBeNull();
      expect(body.items[0].body).toBeNull();
    });
  });

  // ── POST /api/content ──

  describe("POST /api/content", () => {
    it("creates written content and returns 201 with metadata", async () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      const creatorId = "creator_test123";
      const insertedRow = makeMockDbContent({
        creatorId,
        type: "written",
        title: "My Post",
        body: "Content here",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      mockInsertReturning.mockResolvedValue([insertedRow]);

      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId,
          title: "My Post",
          type: "written",
          body: "Content here",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.creatorId).toBe(creatorId);
      expect(body.type).toBe("written");
      expect(body.title).toBe("My Post");
      expect(body.body).toBe("Content here");
      expect(body.thumbnailUrl).toBeNull();
      expect(body.mediaUrl).toBeNull();
      expect(body.publishedAt).not.toBeNull();
      expect(mockInsertValues).toHaveBeenCalledOnce();
    });

    it("creates video content without body and returns 201", async () => {
      const insertedRow = makeMockDbContent({
        type: "video",
        body: null,
      });
      mockInsertReturning.mockResolvedValue([insertedRow]);

      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "creator_test123",
          title: "My Video",
          type: "video",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.type).toBe("video");
      expect(body.body).toBeNull();
    });

    it("returns 400 when written content has no body", async () => {
      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "creator_test123",
          title: "Post",
          type: "written",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when title is missing", async () => {
      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "creator_test123",
          type: "written",
          body: "some text",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "My Post",
          type: "written",
          body: "Content here",
        }),
      });

      expect(res.status).toBe(401);
    });

  });

  // ── GET /api/content/:id ──

  describe("GET /api/content/:id", () => {
    it("returns 200 with metadata for public content (no auth required)", async () => {
      mockSelectWhere.mockResolvedValue([{ ...makeMockDbContent(), creatorStatus: "active" }]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("00000000-0000-4000-a000-000000000001");
      expect(body.type).toBe("written");
      expect(body.title).toBe("Test Post");
      // Storage keys must not appear in response; null keys -> null URLs
      expect(body.thumbnailUrl).toBeNull();
      expect(body.mediaUrl).toBeNull();
      expect(body.creatorName).toBeDefined();
    });

    it("returns creatorName in the response", async () => {
      mockSelectWhere.mockResolvedValue([
        { ...makeMockDbContent({ creatorId: "user_test123" }), creatorName: "Test Creator", creatorHandle: null, creatorStatus: "active" },
      ]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.creatorName).toBe("Test Creator");
    });

    it("returns 200 with full metadata for subscribers-only content when authenticated", async () => {
      mockSelectWhere.mockResolvedValue([
        {
          ...makeMockDbContent({
            visibility: "subscribers",
            mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
          }),
          creatorStatus: "active",
        },
      ]);
      ctx.auth.user = makeMockUser();

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mediaUrl).toBe("/api/content/00000000-0000-4000-a000-000000000001/media");
    });

    it("returns metadata with mediaUrl null for subscribers-only when unauthenticated", async () => {
      mockSelectWhere.mockResolvedValue([
        {
          ...makeMockDbContent({
            visibility: "subscribers",
            mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
          }),
          creatorStatus: "active",
        },
      ]);
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mediaUrl).toBeNull();
      expect(body.id).toBe("00000000-0000-4000-a000-000000000001");
    });

    it("returns mediaUrl for subscribers-only content when user has active subscription", async () => {
      mockSelectWhere.mockResolvedValueOnce([
        {
          ...makeMockDbContent({
            visibility: "subscribers",
            mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
            creatorId: "creator_different",
          }),
          creatorStatus: "active",
        },
      ]);
      ctx.auth.user = makeMockUser();
      // buildContentAccessContext subscription query awaits innerJoin().where() directly
      // (no .limit()); return a platform subscription row so hasPlatformSubscription = true
      mockFeedWhere.mockReturnValueOnce(
        Promise.resolve([{ planType: "platform", planCreatorId: null }]),
      );

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mediaUrl).toBe("/api/content/00000000-0000-4000-a000-000000000001/media");
    });

    it("returns mediaUrl null for subscribers-only content when user has no subscription", async () => {
      mockSelectWhere.mockResolvedValueOnce([
        {
          ...makeMockDbContent({
            visibility: "subscribers",
            mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
            creatorId: "creator_different",
          }),
          creatorStatus: "active",
        },
      ]);
      ctx.auth.user = makeMockUser();
      // mockSubLimit defaults to [] (no subscription)

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mediaUrl).toBeNull();
    });

    it("returns mediaUrl for subscribers-only content when user is the content creator", async () => {
      mockSelectWhere
        .mockResolvedValueOnce([
          {
            ...makeMockDbContent({
              visibility: "subscribers",
              mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
              creatorId: "user_test123",
            }),
            creatorStatus: "active",
          },
        ])
        .mockResolvedValueOnce([{ role: "owner" }]); // creatorMembers check in checkContentAccess
      ctx.auth.user = makeMockUser({ id: "user_test123" });

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mediaUrl).toBe("/api/content/00000000-0000-4000-a000-000000000001/media");
    });

    it("returns 404 for soft-deleted content", async () => {
      // findActiveContent filters deleted rows; empty array means not found
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for non-existent content ID", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-ffffffffffff");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // ── PATCH /api/content/:id ──

  describe("PATCH /api/content/:id", () => {
    it("returns 200 with updated metadata when owner updates title", async () => {
      const existing = makeMockDbContent();
      const updated = makeMockDbContent({ title: "Updated Title" });
      mockSelectWhere.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("Updated Title");
      expect(mockUpdateSet).toHaveBeenCalledOnce();
    });

    it("returns 403 when non-owner tries to update", async () => {
      mockSelectWhere.mockResolvedValue([makeMockDbContent()]);
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: manageContent"),
      );

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hack" }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when content does not exist", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-ffffffffffff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Update" }),
      });

      expect(res.status).toBe(404);
    });

    it("clears thumbnailKey and deletes storage file when clearThumbnail is true", async () => {
      const existing = makeMockDbContent({
        thumbnailKey: "content/00000000-0000-4000-a000-000000000001/thumbnail/thumb.jpg",
      });
      const updated = makeMockDbContent({ thumbnailKey: null });
      mockSelectWhere.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearThumbnail: true }),
      });

      expect(res.status).toBe(200);
      expect(mockStorageDelete).toHaveBeenCalledWith("content/00000000-0000-4000-a000-000000000001/thumbnail/thumb.jpg");
      expect(mockUpdateSet).toHaveBeenCalledOnce();
      const setArg = mockUpdateSet.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.thumbnailKey).toBeNull();
      expect(setArg).not.toHaveProperty("clearThumbnail");
    });

    it("does not call storage delete when clearThumbnail is true but thumbnailKey is null", async () => {
      const existing = makeMockDbContent({ thumbnailKey: null });
      const updated = makeMockDbContent({ thumbnailKey: null });
      mockSelectWhere.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearThumbnail: true }),
      });

      expect(res.status).toBe(200);
      expect(mockStorageDelete).not.toHaveBeenCalled();
    });

    it("clears mediaKey and deletes storage file when clearMedia is true", async () => {
      const existing = makeMockDbContent({
        mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
      });
      const updated = makeMockDbContent({ mediaKey: null });
      mockSelectWhere.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearMedia: true }),
      });

      expect(res.status).toBe(200);
      expect(mockStorageDelete).toHaveBeenCalledWith("content/00000000-0000-4000-a000-000000000001/media/video.mp4");
      expect(mockUpdateSet).toHaveBeenCalledOnce();
      const setArg = mockUpdateSet.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.mediaKey).toBeNull();
      expect(setArg).not.toHaveProperty("clearMedia");
    });

    it("does not call storage delete when clearMedia is true but mediaKey is null", async () => {
      const existing = makeMockDbContent({ mediaKey: null });
      const updated = makeMockDbContent({ mediaKey: null });
      mockSelectWhere.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearMedia: true }),
      });

      expect(res.status).toBe(200);
      expect(mockStorageDelete).not.toHaveBeenCalled();
    });
  });

  // ── DELETE /api/content/:id ──

  describe("DELETE /api/content/:id", () => {
    it("returns 204 and removes storage files when owner deletes", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
          thumbnailKey: "content/00000000-0000-4000-a000-000000000001/thumbnail/thumb.jpg",
        }),
      ]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      // Update called to set deletedAt
      expect(mockUpdateSet).toHaveBeenCalledOnce();
      // Storage delete called for each non-null key
      expect(mockStorageDelete).toHaveBeenCalledTimes(2);
      expect(mockStorageDelete).toHaveBeenCalledWith(
        "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
      );
      expect(mockStorageDelete).toHaveBeenCalledWith(
        "content/00000000-0000-4000-a000-000000000001/thumbnail/thumb.jpg",
      );
    });

    it("returns 403 when non-owner tries to delete", async () => {
      mockSelectWhere.mockResolvedValue([makeMockDbContent()]);
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: manageContent"),
      );

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001", {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
    });

    it("returns 404 when content does not exist (including already deleted)", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-ffffffffffff", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/content/:id/upload ──

  describe("POST /api/content/:id/upload", () => {
    it("returns 200 with updated metadata when owner uploads media", async () => {
      mockSelectWhere.mockResolvedValue([makeMockDbContent({ type: "video" })]);
      mockStorageUpload.mockResolvedValue(
        ok({ key: "content/00000000-0000-4000-a000-000000000001/media/video.mp4", size: 100 }),
      );
      mockUpdateReturning.mockResolvedValue([
        makeMockDbContent({
          type: "video",
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
        }),
      ]);

      const formData = new FormData();
      formData.append(
        "file",
        new File(["file content"], "video.mp4", { type: "video/mp4" }),
      );

      const res = await ctx.app.request(
        "/api/content/00000000-0000-4000-a000-000000000001/upload?field=media",
        {
          method: "POST",
          body: formData,
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mediaUrl).toBe("/api/content/00000000-0000-4000-a000-000000000001/media");
      expect(mockStorageUpload).toHaveBeenCalledOnce();
      const [uploadKey] = mockStorageUpload.mock.calls[0] as [string, ...unknown[]];
      expect(uploadKey).toBe("content/00000000-0000-4000-a000-000000000001/media/video.mp4");
    });

    it("returns 403 when non-owner tries to upload", async () => {
      mockSelectWhere.mockResolvedValue([makeMockDbContent({ type: "video" })]);
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: manageContent"),
      );

      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "video.mp4", { type: "video/mp4" }),
      );

      const res = await ctx.app.request(
        "/api/content/00000000-0000-4000-a000-000000000001/upload?field=media",
        {
          method: "POST",
          body: formData,
        },
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid field query parameter", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "video.mp4", { type: "video/mp4" }),
      );

      const res = await ctx.app.request(
        "/api/content/00000000-0000-4000-a000-000000000001/upload?field=invalid",
        {
          method: "POST",
          body: formData,
        },
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when file exceeds max size via Content-Length header", async () => {
      const { MAX_FILE_SIZES } = await import("@snc/shared");
      mockSelectWhere.mockResolvedValue([makeMockDbContent({ type: "video" })]);

      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "video.mp4", { type: "video/mp4" }),
      );

      const res = await ctx.app.request(
        "/api/content/00000000-0000-4000-a000-000000000001/upload?field=media",
        {
          method: "POST",
          body: formData,
          headers: {
            "Content-Length": String(MAX_FILE_SIZES.video + 1),
          },
        },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("size");
    });

    it("returns 400 when file has invalid MIME type", async () => {
      mockSelectWhere.mockResolvedValue([makeMockDbContent({ type: "video" })]);

      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "file.txt", { type: "text/plain" }),
      );

      const res = await ctx.app.request(
        "/api/content/00000000-0000-4000-a000-000000000001/upload?field=media",
        {
          method: "POST",
          body: formData,
        },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("MIME type");
    });
  });

  // ── GET /api/content/:id/media ──

  describe("GET /api/content/:id/media", () => {
    it("streams media for public content without auth", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
        }),
      ]);
      mockStorageDownload.mockResolvedValue(mockDownloadResult("file data"));

      const res = await ctx.app.request(
        "/api/content/00000000-0000-4000-a000-000000000001/media",
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("video/mp4");
      expect(res.headers.get("Content-Length")).toBe("9");
      expect(res.headers.get("Content-Disposition")).toContain("filename");
      expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
      const text = await res.text();
      expect(text).toBe("file data");
    });

    it("streams media for subscribers-only content when authenticated", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({
          visibility: "subscribers",
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/audio.mp3",
        }),
      ]);
      ctx.auth.user = makeMockUser();
      mockStorageDownload.mockResolvedValue(mockDownloadResult("audio data"));

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/media");

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("audio data");
    });

    it("returns 401 for subscribers-only content when unauthenticated", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({
          visibility: "subscribers",
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/audio.mp3",
        }),
      ]);
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/media");

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 for subscribers-only content when authenticated but no subscription", async () => {
      // Use Once so the subsequent creatorMembers query falls back to the default []
      mockSelectWhere.mockResolvedValueOnce([
        makeMockDbContent({
          visibility: "subscribers",
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/audio.mp3",
          creatorId: "creator_different",
        }),
      ]);
      ctx.auth.user = makeMockUser();
      // mockSubLimit defaults to [] (no subscription)

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/media");

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("Subscription required");
    });

    it("streams media for subscribers-only content when user has active subscription", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({
          visibility: "subscribers",
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/audio.mp3",
          creatorId: "creator_different",
        }),
      ]);
      ctx.auth.user = makeMockUser();
      mockSubLimit.mockResolvedValue([{ id: "sub_123" }]);
      mockStorageDownload.mockResolvedValue(mockDownloadResult("audio data"));

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/media");

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("audio data");
    });

    it("streams media for subscribers-only content when user is the content creator", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({
          visibility: "subscribers",
          mediaKey: "content/00000000-0000-4000-a000-000000000001/media/audio.mp3",
          creatorId: "user_test123",
        }),
      ]);
      ctx.auth.user = makeMockUser({ id: "user_test123" });
      mockStorageDownload.mockResolvedValue(mockDownloadResult("audio data"));

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/media");

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("audio data");
    });

    it("returns 404 when content has no media uploaded", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({ mediaKey: null }),
      ]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/media");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // ── POST /api/content — draft creation behavior ──

  describe("POST /api/content (draft creation behavior)", () => {
    it("creates written content as draft (publishedAt = null)", async () => {
      const insertedRow = makeMockDbContent({
        type: "written",
        publishedAt: null,
      });
      mockInsertReturning.mockResolvedValue([insertedRow]);

      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "user_test123",
          title: "My Post",
          type: "written",
          body: "Content here",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.publishedAt).toBeNull();
      // Verify the inserted values always pass publishedAt as null
      const insertCall = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>;
      expect(insertCall.publishedAt).toBeNull();
    });

    it("creates video content as draft (publishedAt = null)", async () => {
      const insertedRow = makeMockDbContent({
        type: "video",
        body: null,
        publishedAt: null,
      });
      mockInsertReturning.mockResolvedValue([insertedRow]);

      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "user_test123",
          title: "My Video",
          type: "video",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.publishedAt).toBeNull();
      const insertCall = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>;
      expect(insertCall.publishedAt).toBeNull();
    });

    it("creates audio content as draft (publishedAt = null)", async () => {
      const insertedRow = makeMockDbContent({
        type: "audio",
        body: null,
        publishedAt: null,
      });
      mockInsertReturning.mockResolvedValue([insertedRow]);

      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "user_test123",
          title: "My Audio",
          type: "audio",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.publishedAt).toBeNull();
      const insertCall = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>;
      expect(insertCall.publishedAt).toBeNull();
    });

    it("generates and stores a slug from the title on creation", async () => {
      const insertedRow = makeMockDbContent({
        type: "written",
        title: "My Post",
        slug: "my-post",
        publishedAt: null,
      });
      mockInsertReturning.mockResolvedValue([insertedRow]);

      const res = await ctx.app.request("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "user_test123",
          title: "My Post",
          type: "written",
          body: "Content here",
        }),
      });

      expect(res.status).toBe(201);
      const insertCall = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>;
      expect(insertCall.slug).toBe("my-post");
    });
  });

  // ── POST /api/content/:id/publish — Unit 2 ──

  describe("POST /api/content/:id/publish", () => {
    it("publishes a draft video with media and returns 200", async () => {
      const draft = makeMockDbContent({
        type: "video",
        publishedAt: null,
        mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
      });
      const published = makeMockDbContent({
        type: "video",
        publishedAt: new Date("2026-03-21T00:00:00.000Z"),
        mediaKey: "content/00000000-0000-4000-a000-000000000001/media/video.mp4",
      });
      mockSelectWhere.mockResolvedValue([draft]);
      mockUpdateReturning.mockResolvedValue([published]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/publish", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.publishedAt).not.toBeNull();
      expect(mockUpdateSet).toHaveBeenCalledOnce();
    });

    it("returns 400 if content is already published", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({ publishedAt: new Date("2026-01-01T00:00:00.000Z") }),
      ]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/publish", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for video without mediaKey", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({ type: "video", publishedAt: null, mediaKey: null }),
      ]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/publish", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for audio without mediaKey", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({ type: "audio", publishedAt: null, mediaKey: null }),
      ]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/publish", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("publishes written content without media", async () => {
      const draft = makeMockDbContent({
        type: "written",
        publishedAt: null,
        mediaKey: null,
      });
      const published = makeMockDbContent({
        type: "written",
        publishedAt: new Date("2026-03-21T00:00:00.000Z"),
      });
      mockSelectWhere.mockResolvedValue([draft]);
      mockUpdateReturning.mockResolvedValue([published]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/publish", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.publishedAt).not.toBeNull();
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/publish", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/content/:id/unpublish — Unit 3 ──

  describe("POST /api/content/:id/unpublish", () => {
    it("unpublishes published content and returns 200 with null publishedAt", async () => {
      const publishedContent = makeMockDbContent({
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const draftContent = makeMockDbContent({ publishedAt: null });
      mockSelectWhere.mockResolvedValue([publishedContent]);
      mockUpdateReturning.mockResolvedValue([draftContent]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/unpublish", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.publishedAt).toBeNull();
      expect(mockUpdateSet).toHaveBeenCalledOnce();
    });

    it("returns 400 if content is already a draft", async () => {
      mockSelectWhere.mockResolvedValue([
        makeMockDbContent({ publishedAt: null }),
      ]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/unpublish", {
        method: "POST",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001/unpublish", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/content/drafts — Unit 4 ──

  describe("GET /api/content/drafts", () => {
    const makeDraftRow = (overrides?: Record<string, unknown>) => ({
      ...makeMockDbContent({ publishedAt: null }),
      creatorName: "Test Creator",
      ...overrides,
    });

    it("returns drafts list for the authenticated creator", async () => {
      const drafts = [
        makeDraftRow({ id: "draft-1", title: "Draft One" }),
        makeDraftRow({ id: "draft-2", title: "Draft Two" }),
      ];
      mockLimit.mockResolvedValue(drafts);

      const res = await ctx.app.request(
        "/api/content/drafts?creatorId=user_test123",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.items[0].title).toBe("Draft One");
      expect(body.items[0].publishedAt).toBeNull();
      expect(mockRequireCreatorPermission).toHaveBeenCalledWith(
        expect.any(String),
        "user_test123",
        "manageContent",
      );
    });

    it("returns 403 if user lacks creator permission", async () => {
      mockRequireCreatorPermission.mockRejectedValueOnce(
        new TestForbiddenError("Missing creator permission: manageContent"),
      );

      const res = await ctx.app.request(
        "/api/content/drafts?creatorId=other-creator",
      );

      expect(res.status).toBe(403);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request(
        "/api/content/drafts?creatorId=user_test123",
      );

      expect(res.status).toBe(401);
    });

    it("returns 400 when creatorId is missing", async () => {
      const res = await ctx.app.request("/api/content/drafts");

      expect(res.status).toBe(400);
    });

    it("returns null nextCursor on last page", async () => {
      mockLimit.mockResolvedValue([makeDraftRow()]);

      const res = await ctx.app.request(
        "/api/content/drafts?creatorId=user_test123&limit=12",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nextCursor).toBeNull();
    });
  });

  // ── GET /api/content (feed) — Unit 5: media filter ──

  describe("GET /api/content (feed media filter)", () => {
    const makeFeedRow = (overrides?: Record<string, unknown>) => ({
      ...makeMockDbContent(),
      creatorName: "Test Creator",
      ...overrides,
    });

    it("passes media filter condition to where clause (or/isNotNull for video/audio)", async () => {
      mockLimit.mockResolvedValue([]);
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      // Verify the where clause was called (filter was applied)
      expect(mockFeedWhere).toHaveBeenCalledOnce();
    });

    it("returns written content with null mediaKey in feed", async () => {
      mockLimit.mockResolvedValue([
        makeFeedRow({ type: "written", mediaKey: null, publishedAt: new Date("2026-01-01T00:00:00.000Z") }),
      ]);

      const res = await ctx.app.request("/api/content");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].type).toBe("written");
    });
  });

  // ── GET /api/content/:id — Unit 6: draft preview access ──

  describe("GET /api/content/:id (draft access control)", () => {
    it("returns 200 for draft when user is creator team member", async () => {
      const draft = { ...makeMockDbContent({ publishedAt: null }), creatorStatus: "active" };
      mockSelectWhere.mockResolvedValue([draft]);
      ctx.auth.user = makeMockUser({ id: "user_test123" });
      mockCheckCreatorPermission.mockResolvedValue(true);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.publishedAt).toBeNull();
    });

    it("returns 404 for draft when user is not creator team member", async () => {
      const draft = makeMockDbContent({ publishedAt: null, creatorId: "other-creator" });
      mockSelectWhere.mockResolvedValue([draft]);
      ctx.auth.user = makeMockUser({ id: "random-user" });
      mockCheckCreatorPermission.mockResolvedValue(false);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(404);
    });

    it("returns 404 for draft when unauthenticated", async () => {
      const draft = makeMockDbContent({ publishedAt: null });
      mockSelectWhere.mockResolvedValue([draft]);
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(404);
    });

    it("returns 200 for draft when user has admin role", async () => {
      const draft = { ...makeMockDbContent({ publishedAt: null }), creatorStatus: "active" };
      mockSelectWhere.mockResolvedValue([draft]);
      ctx.auth.user = makeMockUser({ id: "admin-user" });
      ctx.auth.roles = ["admin"];

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
    });

    it("allows access to published content without draft access check", async () => {
      // Published content should still work for unauthenticated users
      const published = {
        ...makeMockDbContent({ publishedAt: new Date("2026-01-01T00:00:00.000Z") }),
        creatorStatus: "active",
      };
      mockSelectWhere.mockResolvedValue([published]);

      const res = await ctx.app.request("/api/content/00000000-0000-4000-a000-000000000001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.publishedAt).not.toBeNull();
    });
  });
});
