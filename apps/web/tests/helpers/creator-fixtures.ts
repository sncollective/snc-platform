import type {
  CreatorListItem,
  CreatorProfileResponse,
  CreatorMember,
  CreatorMemberCandidate,
} from "@snc/shared";

// ── Public API ──

export function makeMockCreatorListItem(
  overrides?: Partial<CreatorListItem>,
): CreatorListItem {
  return {
    id: "user_test123",
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
    id: "user_test123",
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

export function makeMockCreatorMember(
  overrides?: Partial<CreatorMember>,
): CreatorMember {
  return {
    userId: "user_test123",
    displayName: "Test Creator",
    role: "owner",
    joinedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeMockMemberCandidate(
  overrides?: Partial<CreatorMemberCandidate>,
): CreatorMemberCandidate {
  return {
    id: "user_candidate1",
    name: "Candidate User",
    email: "candidate@example.com",
    roles: ["creator"],
    ...overrides,
  };
}
