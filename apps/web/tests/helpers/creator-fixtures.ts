import type { CreatorListItem, CreatorProfileResponse } from "@snc/shared";

// ── Public API ──

export function makeMockCreatorListItem(
  overrides?: Partial<CreatorListItem>,
): CreatorListItem {
  return {
    userId: "user_test123",
    displayName: "Test Creator",
    bio: "A test creator bio",
    handle: null,
    avatarUrl: "/api/creators/user_test123/avatar",
    bannerUrl: null,
    socialLinks: [],
    contentCount: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeMockCreatorProfileResponse(
  overrides?: Partial<CreatorProfileResponse>,
): CreatorProfileResponse {
  return {
    userId: "user_test123",
    displayName: "Test Creator",
    bio: "A test creator bio",
    handle: null,
    avatarUrl: "/api/creators/user_test123/avatar",
    bannerUrl: null,
    socialLinks: [],
    contentCount: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
