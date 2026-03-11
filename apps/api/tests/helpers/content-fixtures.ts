import type { ContentResponse, ContentType, Visibility } from "@snc/shared";

// ── Private Types ──

type DbContentRow = {
  id: string;
  creatorId: string;
  type: ContentType;
  title: string;
  body: string | null;
  description: string | null;
  visibility: Visibility;
  thumbnailKey: string | null;
  mediaKey: string | null;
  coverArtKey: string | null;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Public API ──

export const makeMockContent = (
  overrides?: Partial<ContentResponse>,
): ContentResponse => ({
  id: "content-test-1",
  creatorId: "user_test123",
  type: "written",
  title: "Test Post",
  body: "Test body content",
  description: "A test post",
  visibility: "public",
  thumbnailUrl: null,
  mediaUrl: null,
  coverArtUrl: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

export const makeMockDbContent = (
  overrides?: Partial<DbContentRow>,
): DbContentRow => ({
  id: "content-test-1",
  creatorId: "user_test123",
  type: "written",
  title: "Test Post",
  body: "Test body content",
  description: "A test post",
  visibility: "public",
  thumbnailKey: null,
  mediaKey: null,
  coverArtKey: null,
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
