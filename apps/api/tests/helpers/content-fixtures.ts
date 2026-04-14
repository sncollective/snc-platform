import type { ContentResponse, ContentType, Visibility, SourceType } from "@snc/shared";

// ── Private Types ──

type DbContentRow = {
  id: string;
  creatorId: string;
  type: ContentType;
  title: string;
  slug: string | null;
  body: string | null;
  description: string | null;
  visibility: Visibility;
  sourceType: SourceType;
  thumbnailKey: string | null;
  mediaKey: string | null;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  processingStatus: string | null;
  transcodedMediaKey: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  bitrate: number | null;
};

// ── Public API ──

export const makeMockContent = (
  overrides?: Partial<ContentResponse>,
): ContentResponse => ({
  id: "00000000-0000-4000-a000-000000000001",
  creatorId: "user_test123",
  slug: "test-post",
  type: "written",
  title: "Test Post",
  body: "Test body content",
  description: "A test post",
  visibility: "public",
  sourceType: "upload",
  thumbnailUrl: null,
  thumbnail: null,
  mediaUrl: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  processingStatus: null,
  videoCodec: null,
  audioCodec: null,
  width: null,
  height: null,
  duration: null,
  bitrate: null,
  ...overrides,
});

export const makeMockDbContent = (
  overrides?: Partial<DbContentRow>,
): DbContentRow => ({
  id: "00000000-0000-4000-a000-000000000001",
  creatorId: "user_test123",
  type: "written",
  title: "Test Post",
  slug: "test-post",
  body: "Test body content",
  description: "A test post",
  visibility: "public",
  sourceType: "upload",
  thumbnailKey: null,
  mediaKey: null,
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  processingStatus: null,
  transcodedMediaKey: null,
  videoCodec: null,
  audioCodec: null,
  width: null,
  height: null,
  duration: null,
  bitrate: null,
  ...overrides,
});
