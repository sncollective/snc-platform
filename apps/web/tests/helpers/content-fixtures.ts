import type { FeedItem } from "@snc/shared";

// ── Public API ──

export function makeMockFeedItem(overrides?: Partial<FeedItem>): FeedItem {
  return {
    id: "content-1",
    creatorId: "user-1",
    creatorName: "Test Creator",
    type: "written",
    title: "Test Post",
    body: "Test body content",
    description: "A test post",
    visibility: "public",
    sourceType: "upload",
    thumbnailUrl: null,
    mediaUrl: null,
    coverArtUrl: null,
    publishedAt: "2026-02-26T00:00:00.000Z",
    createdAt: "2026-02-26T00:00:00.000Z",
    updatedAt: "2026-02-26T00:00:00.000Z",
    ...overrides,
  };
}
