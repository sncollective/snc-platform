import { describe, it, expect } from "vitest";

import {
  CONTENT_TYPES,
  VISIBILITY,
  CONTENT_STATUSES,
  ContentTypeSchema,
  VisibilitySchema,
  CreateContentSchema,
  UpdateContentSchema,
  ContentResponseSchema,
  FeedQuerySchema,
  FeedItemSchema,
  FeedResponseSchema,
  DraftQuerySchema,
  getContentStatus,
  type ContentType,
  type Visibility,
  type ContentStatus,
  type CreateContent,
  type UpdateContent,
  type ContentResponse,
  type FeedQuery,
  type FeedItem,
  type FeedResponse,
  type DraftQuery,
} from "../src/index.js";

// ── Test Fixtures ──

const VALID_CONTENT_RESPONSE = {
  id: "content_abc123",
  creatorId: "user_creator1",
  slug: "test-post",
  type: "written" as const,
  title: "Test Post",
  body: "This is the body of the post.",
  description: "A test post description",
  visibility: "public" as const,
  sourceType: "upload" as const,
  thumbnailUrl: null,
  mediaUrl: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const VALID_FEED_ITEM = {
  ...VALID_CONTENT_RESPONSE,
  creatorName: "Test Creator",
  creatorHandle: "test-creator",
};

// ── Tests ──

describe("CONTENT_TYPES", () => {
  it("contains exactly the three expected content types", () => {
    expect(CONTENT_TYPES).toStrictEqual(["video", "audio", "written"]);
  });

  it("has length 3", () => {
    expect(CONTENT_TYPES).toHaveLength(3);
  });
});

describe("VISIBILITY", () => {
  it("contains exactly the two expected visibility values", () => {
    expect(VISIBILITY).toStrictEqual(["public", "subscribers"]);
  });

  it("has length 2", () => {
    expect(VISIBILITY).toHaveLength(2);
  });
});

describe("ContentTypeSchema", () => {
  it.each(["video", "audio", "written"])('accepts "%s"', (type) => {
    expect(ContentTypeSchema.parse(type)).toBe(type);
  });

  it('rejects "podcast"', () => {
    expect(() => ContentTypeSchema.parse("podcast")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => ContentTypeSchema.parse("")).toThrow();
  });
});

describe("VisibilitySchema", () => {
  it.each(["public", "subscribers"])('accepts "%s"', (v) => {
    expect(VisibilitySchema.parse(v)).toBe(v);
  });

  it('rejects "private"', () => {
    expect(() => VisibilitySchema.parse("private")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => VisibilitySchema.parse("")).toThrow();
  });
});

describe("CreateContentSchema", () => {
  const CREATOR_ID = "creator_abc123";

  it("validates a minimal valid input (title + type)", () => {
    const result = CreateContentSchema.parse({
      creatorId: CREATOR_ID,
      title: "My Post",
      type: "written",
    });
    expect(result.creatorId).toBe(CREATOR_ID);
    expect(result.title).toBe("My Post");
    expect(result.type).toBe("written");
    expect(result.visibility).toBe("public"); // default
  });

  it("validates a full valid input with all fields", () => {
    const result = CreateContentSchema.parse({
      creatorId: CREATOR_ID,
      title: "My Video",
      type: "video",
      description: "A great video",
      visibility: "subscribers",
      body: "Some body text",
    });
    expect(result.visibility).toBe("subscribers");
    expect(result.description).toBe("A great video");
    expect(result.body).toBe("Some body text");
  });

  it("defaults visibility to 'public' when omitted", () => {
    const result = CreateContentSchema.parse({
      creatorId: CREATOR_ID,
      title: "Post",
      type: "audio",
    });
    expect(result.visibility).toBe("public");
  });

  it("rejects missing title", () => {
    expect(() =>
      CreateContentSchema.parse({ creatorId: CREATOR_ID, type: "written" }),
    ).toThrow();
  });

  it("rejects missing type", () => {
    expect(() =>
      CreateContentSchema.parse({ creatorId: CREATOR_ID, title: "Post" }),
    ).toThrow();
  });

  it("rejects empty title (min length 1)", () => {
    expect(() =>
      CreateContentSchema.parse({ creatorId: CREATOR_ID, title: "", type: "written" }),
    ).toThrow();
  });

  it("rejects title exceeding 200 characters", () => {
    expect(() =>
      CreateContentSchema.parse({
        creatorId: CREATOR_ID,
        title: "x".repeat(201),
        type: "written",
      }),
    ).toThrow();
  });

  it("accepts title at exactly 200 characters", () => {
    const result = CreateContentSchema.parse({
      creatorId: CREATOR_ID,
      title: "x".repeat(200),
      type: "written",
    });
    expect(result.title).toHaveLength(200);
  });

  it("rejects description exceeding 2000 characters", () => {
    expect(() =>
      CreateContentSchema.parse({
        creatorId: CREATOR_ID,
        title: "Post",
        type: "written",
        description: "x".repeat(2001),
      }),
    ).toThrow();
  });

  it("accepts description at exactly 2000 characters", () => {
    const result = CreateContentSchema.parse({
      creatorId: CREATOR_ID,
      title: "Post",
      type: "written",
      description: "x".repeat(2000),
    });
    expect(result.description).toHaveLength(2000);
  });

  it("rejects invalid content type", () => {
    expect(() =>
      CreateContentSchema.parse({
        creatorId: CREATOR_ID,
        title: "Post",
        type: "podcast",
      }),
    ).toThrow();
  });

  it("rejects invalid visibility", () => {
    expect(() =>
      CreateContentSchema.parse({
        title: "Post",
        type: "written",
        visibility: "private",
      }),
    ).toThrow();
  });

  it("creates content as draft (no publishImmediately field)", () => {
    const result = CreateContentSchema.parse({
      creatorId: CREATOR_ID,
      title: "Post",
      type: "written",
    });
    expect(result).not.toHaveProperty("publishImmediately");
  });
});

describe("UpdateContentSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = UpdateContentSchema.parse({});
    expect(result).toStrictEqual({});
  });

  it("accepts a partial update with title only", () => {
    const result = UpdateContentSchema.parse({ title: "New Title" });
    expect(result.title).toBe("New Title");
  });

  it("accepts a partial update with description only", () => {
    const result = UpdateContentSchema.parse({
      description: "Updated desc",
    });
    expect(result.description).toBe("Updated desc");
  });

  it("accepts a partial update with visibility only", () => {
    const result = UpdateContentSchema.parse({
      visibility: "subscribers",
    });
    expect(result.visibility).toBe("subscribers");
  });

  it("accepts a partial update with body only", () => {
    const result = UpdateContentSchema.parse({ body: "Updated body" });
    expect(result.body).toBe("Updated body");
  });

  it("rejects empty title when provided (min length 1)", () => {
    expect(() => UpdateContentSchema.parse({ title: "" })).toThrow();
  });

  it("rejects title exceeding 200 characters when provided", () => {
    expect(() =>
      UpdateContentSchema.parse({ title: "x".repeat(201) }),
    ).toThrow();
  });

  it("rejects description exceeding 2000 characters when provided", () => {
    expect(() =>
      UpdateContentSchema.parse({ description: "x".repeat(2001) }),
    ).toThrow();
  });

  it("rejects invalid visibility when provided", () => {
    expect(() =>
      UpdateContentSchema.parse({ visibility: "private" }),
    ).toThrow();
  });

  it("accepts clearThumbnail: true", () => {
    const result = UpdateContentSchema.parse({ clearThumbnail: true });
    expect(result.clearThumbnail).toBe(true);
  });

  it("accepts clearMedia: true", () => {
    const result = UpdateContentSchema.parse({ clearMedia: true });
    expect(result.clearMedia).toBe(true);
  });

  it("accepts clearThumbnail and clearMedia together", () => {
    const result = UpdateContentSchema.parse({ clearThumbnail: true, clearMedia: true });
    expect(result.clearThumbnail).toBe(true);
    expect(result.clearMedia).toBe(true);
  });

  it("omits clearThumbnail when not provided", () => {
    const result = UpdateContentSchema.parse({});
    expect(result.clearThumbnail).toBeUndefined();
    expect(result.clearMedia).toBeUndefined();
  });
});

describe("ContentResponseSchema", () => {
  it("validates a complete content response object", () => {
    const result = ContentResponseSchema.parse(VALID_CONTENT_RESPONSE);
    expect(result.id).toBe(VALID_CONTENT_RESPONSE.id);
    expect(result.creatorId).toBe(VALID_CONTENT_RESPONSE.creatorId);
    expect(result.type).toBe("written");
    expect(result.title).toBe(VALID_CONTENT_RESPONSE.title);
  });

  it("accepts null for all nullable fields", () => {
    const result = ContentResponseSchema.parse({
      ...VALID_CONTENT_RESPONSE,
      body: null,
      description: null,
      thumbnailUrl: null,
      mediaUrl: null,
      publishedAt: null,
    });
    expect(result.body).toBeNull();
    expect(result.description).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
    expect(result.mediaUrl).toBeNull();
    expect(result.publishedAt).toBeNull();
  });

  it("accepts string values for URL fields", () => {
    const result = ContentResponseSchema.parse({
      ...VALID_CONTENT_RESPONSE,
      thumbnailUrl: "/api/content/abc/thumbnail",
      mediaUrl: "/api/content/abc/media",
    });
    expect(result.thumbnailUrl).toBe("/api/content/abc/thumbnail");
    expect(result.mediaUrl).toBe("/api/content/abc/media");
  });

  it("rejects empty object", () => {
    expect(() => ContentResponseSchema.parse({})).toThrow();
  });

  it("rejects when required field id is missing", () => {
    const { id, ...rest } = VALID_CONTENT_RESPONSE;
    expect(() => ContentResponseSchema.parse(rest)).toThrow();
  });

  it("rejects invalid content type in response", () => {
    expect(() =>
      ContentResponseSchema.parse({
        ...VALID_CONTENT_RESPONSE,
        type: "podcast",
      }),
    ).toThrow();
  });

  it("rejects invalid visibility in response", () => {
    expect(() =>
      ContentResponseSchema.parse({
        ...VALID_CONTENT_RESPONSE,
        visibility: "private",
      }),
    ).toThrow();
  });
});

describe("FeedQuerySchema", () => {
  it("parses empty object to defaults (limit = 12)", () => {
    const result = FeedQuerySchema.parse({});
    expect(result).toStrictEqual({ limit: 12 });
  });

  it("coerces string limit to number", () => {
    const result = FeedQuerySchema.parse({ limit: "20" });
    expect(result.limit).toBe(20);
  });

  it("accepts limit at minimum boundary (1)", () => {
    const result = FeedQuerySchema.parse({ limit: 1 });
    expect(result.limit).toBe(1);
  });

  it("accepts limit at maximum boundary (50)", () => {
    const result = FeedQuerySchema.parse({ limit: 50 });
    expect(result.limit).toBe(50);
  });

  it("rejects limit below minimum (0)", () => {
    expect(() => FeedQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects limit above maximum (51)", () => {
    expect(() => FeedQuerySchema.parse({ limit: 51 })).toThrow();
  });

  it("rejects negative limit", () => {
    expect(() => FeedQuerySchema.parse({ limit: -1 })).toThrow();
  });

  it("rejects non-integer limit", () => {
    expect(() => FeedQuerySchema.parse({ limit: 5.5 })).toThrow();
  });

  it("accepts valid type filter", () => {
    const result = FeedQuerySchema.parse({ type: "video" });
    expect(result.type).toBe("video");
  });

  it('rejects invalid type "podcast"', () => {
    expect(() => FeedQuerySchema.parse({ type: "podcast" })).toThrow();
  });

  it("accepts optional cursor string", () => {
    const result = FeedQuerySchema.parse({ cursor: "eyJwdWJsaXNoZWRBdCI6IjIwMjYtMDEtMDEiLCJpZCI6ImFiYyJ9" });
    expect(result.cursor).toBe("eyJwdWJsaXNoZWRBdCI6IjIwMjYtMDEtMDEiLCJpZCI6ImFiYyJ9");
  });

  it("accepts optional creatorId", () => {
    const result = FeedQuerySchema.parse({ creatorId: "user-1" });
    expect(result.creatorId).toBe("user-1");
  });

  it("accepts all parameters together", () => {
    const result = FeedQuerySchema.parse({
      limit: "25",
      cursor: "abc",
      type: "audio",
      creatorId: "user-2",
    });
    expect(result).toStrictEqual({
      limit: 25,
      cursor: "abc",
      type: "audio",
      creatorId: "user-2",
    });
  });
});

describe("FeedItemSchema", () => {
  it("validates a feed item with creatorName", () => {
    const result = FeedItemSchema.parse(VALID_FEED_ITEM);
    expect(result.creatorName).toBe("Test Creator");
    expect(result.id).toBe(VALID_CONTENT_RESPONSE.id);
  });

  it("includes all ContentResponseSchema fields", () => {
    const result = FeedItemSchema.parse(VALID_FEED_ITEM);
    expect(result.type).toBe("written");
    expect(result.title).toBe("Test Post");
    expect(result.visibility).toBe("public");
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects when creatorName is missing", () => {
    expect(() => FeedItemSchema.parse(VALID_CONTENT_RESPONSE)).toThrow();
  });

  it("rejects when creatorName is not a string", () => {
    expect(() =>
      FeedItemSchema.parse({ ...VALID_CONTENT_RESPONSE, creatorName: 123 }),
    ).toThrow();
  });

  it("accepts nullable fields from ContentResponseSchema", () => {
    const result = FeedItemSchema.parse({
      ...VALID_FEED_ITEM,
      body: null,
      thumbnailUrl: null,
      mediaUrl: null,
      publishedAt: null,
    });
    expect(result.body).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
  });
});

describe("FeedResponseSchema", () => {
  it("validates a response with items and nextCursor", () => {
    const result = FeedResponseSchema.parse({
      items: [VALID_FEED_ITEM],
      nextCursor: "eyJwdWJsaXNoZWRBdCI6IjIwMjYtMDEtMDEiLCJpZCI6ImFiYyJ9",
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("eyJwdWJsaXNoZWRBdCI6IjIwMjYtMDEtMDEiLCJpZCI6ImFiYyJ9");
  });

  it("validates a last-page response with null nextCursor", () => {
    const result = FeedResponseSchema.parse({
      items: [VALID_FEED_ITEM],
      nextCursor: null,
    });
    expect(result.nextCursor).toBeNull();
  });

  it("validates an empty feed (no items, null cursor)", () => {
    const result = FeedResponseSchema.parse({
      items: [],
      nextCursor: null,
    });
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("validates a response with multiple items", () => {
    const item2 = { ...VALID_FEED_ITEM, id: "content_def456", creatorName: "Other Creator" };
    const result = FeedResponseSchema.parse({
      items: [VALID_FEED_ITEM, item2],
      nextCursor: "cursor123",
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[1]!.creatorName).toBe("Other Creator");
  });

  it("rejects when items is missing", () => {
    expect(() => FeedResponseSchema.parse({ nextCursor: null })).toThrow();
  });

  it("rejects when nextCursor is missing", () => {
    expect(() => FeedResponseSchema.parse({ items: [] })).toThrow();
  });

  it("rejects when nextCursor is undefined (must be null or string)", () => {
    expect(() =>
      FeedResponseSchema.parse({ items: [], nextCursor: undefined }),
    ).toThrow();
  });

  it("rejects invalid items in the array", () => {
    expect(() =>
      FeedResponseSchema.parse({
        items: [{ invalid: true }],
        nextCursor: null,
      }),
    ).toThrow();
  });
});

describe("CONTENT_STATUSES", () => {
  it("contains exactly draft and published", () => {
    expect(CONTENT_STATUSES).toStrictEqual(["draft", "published"]);
  });
});

describe("getContentStatus", () => {
  it('returns "draft" when publishedAt is null', () => {
    const status = getContentStatus({
      publishedAt: null,
      type: "video",
      mediaUrl: null,
    });
    expect(status).toBe("draft");
  });

  it('returns "published" when publishedAt is a non-null string', () => {
    const status = getContentStatus({
      publishedAt: "2026-01-01T00:00:00.000Z",
      type: "video",
      mediaUrl: "/api/content/abc/media",
    });
    expect(status).toBe("published");
  });

  it('returns "draft" for written content with null publishedAt', () => {
    const status = getContentStatus({
      publishedAt: null,
      type: "written",
      mediaUrl: null,
    });
    expect(status).toBe("draft");
  });

  it('returns "published" for written content with publishedAt set', () => {
    const status = getContentStatus({
      publishedAt: "2026-03-01T12:00:00.000Z",
      type: "written",
      mediaUrl: null,
    });
    expect(status).toBe("published");
  });
});

describe("DraftQuerySchema", () => {
  it("parses a minimal valid input with creatorId", () => {
    const result = DraftQuerySchema.parse({ creatorId: "creator-1" });
    expect(result.creatorId).toBe("creator-1");
    expect(result.limit).toBe(12); // default
    expect(result.cursor).toBeUndefined();
  });

  it("parses limit from string", () => {
    const result = DraftQuerySchema.parse({ creatorId: "c1", limit: "25" });
    expect(result.limit).toBe(25);
  });

  it("defaults limit to 12 when omitted", () => {
    const result = DraftQuerySchema.parse({ creatorId: "c1" });
    expect(result.limit).toBe(12);
  });

  it("accepts optional cursor", () => {
    const result = DraftQuerySchema.parse({ creatorId: "c1", cursor: "abc123" });
    expect(result.cursor).toBe("abc123");
  });

  it("rejects when creatorId is missing", () => {
    expect(() => DraftQuerySchema.parse({})).toThrow();
  });

  it("rejects when creatorId is empty string", () => {
    expect(() => DraftQuerySchema.parse({ creatorId: "" })).toThrow();
  });

  it("rejects limit below minimum (0)", () => {
    expect(() => DraftQuerySchema.parse({ creatorId: "c1", limit: "0" })).toThrow();
  });

  it("rejects limit above maximum (51)", () => {
    expect(() => DraftQuerySchema.parse({ creatorId: "c1", limit: "51" })).toThrow();
  });

  it("accepts limit at minimum (1)", () => {
    const result = DraftQuerySchema.parse({ creatorId: "c1", limit: "1" });
    expect(result.limit).toBe(1);
  });

  it("accepts limit at maximum (50)", () => {
    const result = DraftQuerySchema.parse({ creatorId: "c1", limit: "50" });
    expect(result.limit).toBe(50);
  });
});

// ── Type-level assertions (compile-time only) ──

const _contentTypeCheck: ContentType = "video";
const _visibilityCheck: Visibility = "public";
const _contentStatusCheck: ContentStatus = "draft";
const _createContentCheck: CreateContent = {
  title: "Test",
  type: "written",
};
const _updateContentCheck: UpdateContent = { clearThumbnail: true, clearMedia: false };
const _contentResponseCheck: ContentResponse = VALID_CONTENT_RESPONSE;
const _feedQueryCheck: FeedQuery = { limit: 12 };
const _feedItemCheck: FeedItem = { ...VALID_CONTENT_RESPONSE, creatorName: "A", creatorHandle: null };
const _feedResponseCheck: FeedResponse = { items: [], nextCursor: null };
const _draftQueryCheck: DraftQuery = { creatorId: "c1", limit: 12 };
