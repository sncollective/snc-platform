import type { SocialLink } from "@snc/shared";

// ── Private Types ──

type DbCreatorProfileRow = {
  userId: string;
  displayName: string;
  bio: string | null;
  handle: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  socialLinks: SocialLink[];
  createdAt: Date;
  updatedAt: Date;
};

// ── Public API ──

export const makeMockDbCreatorProfile = (
  overrides?: Partial<DbCreatorProfileRow>,
): DbCreatorProfileRow => ({
  userId: "user_test123",
  displayName: "Test Creator",
  bio: "A test creator bio",
  handle: null,
  avatarKey: null,
  bannerKey: null,
  socialLinks: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
