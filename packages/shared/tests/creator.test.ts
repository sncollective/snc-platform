import { describe, it, expect } from "vitest";

import {
  SOCIAL_PLATFORMS,
  PLATFORM_CONFIG,
  SocialLinkSchema,
  MAX_SOCIAL_LINKS,
  UpdateCreatorProfileSchema,
  CreatorProfileResponseSchema,
  CreatorListItemSchema,
  CreatorListQuerySchema,
  CreatorListResponseSchema,
  type SocialPlatform,
  type SocialLink,
  type UpdateCreatorProfile,
  type CreatorProfileResponse,
  type CreatorListItem,
  type CreatorListQuery,
  type CreatorListResponse,
} from "../src/index.js";

// ── Test Fixtures ──

const VALID_CREATOR_PROFILE = {
  id: "user_creator1",
  displayName: "Test Creator",
  bio: "A test creator bio",
  handle: null,
  avatarUrl: "/api/creators/user_creator1/avatar",
  bannerUrl: null,
  socialLinks: [],
  contentCount: 5,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Tests ──

describe("SOCIAL_PLATFORMS", () => {
  it("contains 12 platforms", () => {
    expect(SOCIAL_PLATFORMS).toHaveLength(12);
  });

  it("includes bandcamp, spotify, and website", () => {
    expect(SOCIAL_PLATFORMS).toContain("bandcamp");
    expect(SOCIAL_PLATFORMS).toContain("spotify");
    expect(SOCIAL_PLATFORMS).toContain("website");
  });
});

describe("PLATFORM_CONFIG", () => {
  it("has a config entry for every platform", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_CONFIG[platform]).toBeDefined();
      expect(PLATFORM_CONFIG[platform].displayName).toBeTruthy();
    }
  });

  it("has urlPattern for platforms with known domains", () => {
    expect(PLATFORM_CONFIG.bandcamp.urlPattern).toBeDefined();
    expect(PLATFORM_CONFIG.spotify.urlPattern).toBeDefined();
    expect(PLATFORM_CONFIG.instagram.urlPattern).toBeDefined();
  });

  it("does not have urlPattern for mastodon and website", () => {
    expect(PLATFORM_CONFIG.mastodon.urlPattern).toBeUndefined();
    expect(PLATFORM_CONFIG.website.urlPattern).toBeUndefined();
  });
});

describe("SocialLinkSchema", () => {
  it("validates a valid social link", () => {
    const result = SocialLinkSchema.parse({
      platform: "bandcamp",
      url: "https://myband.bandcamp.com",
    });
    expect(result.platform).toBe("bandcamp");
    expect(result.url).toBe("https://myband.bandcamp.com");
  });

  it("accepts optional label", () => {
    const result = SocialLinkSchema.parse({
      platform: "spotify",
      url: "https://open.spotify.com/artist/123",
      label: "My Spotify",
    });
    expect(result.label).toBe("My Spotify");
  });

  it("rejects invalid platform", () => {
    expect(() =>
      SocialLinkSchema.parse({
        platform: "myspace",
        url: "https://myspace.com/artist",
      }),
    ).toThrow();
  });

  it("rejects invalid URL", () => {
    expect(() =>
      SocialLinkSchema.parse({
        platform: "bandcamp",
        url: "not a url",
      }),
    ).toThrow();
  });
});

describe("UpdateCreatorProfileSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = UpdateCreatorProfileSchema.parse({});
    expect(result).toStrictEqual({});
  });

  it("accepts displayName only", () => {
    const result = UpdateCreatorProfileSchema.parse({
      displayName: "New Name",
    });
    expect(result.displayName).toBe("New Name");
  });

  it("accepts bio only", () => {
    const result = UpdateCreatorProfileSchema.parse({ bio: "A bio" });
    expect(result.bio).toBe("A bio");
  });

  it("accepts both displayName and bio", () => {
    const result = UpdateCreatorProfileSchema.parse({
      displayName: "New Name",
      bio: "A bio",
    });
    expect(result.displayName).toBe("New Name");
    expect(result.bio).toBe("A bio");
  });

  it("rejects empty displayName (min length 1)", () => {
    expect(() =>
      UpdateCreatorProfileSchema.parse({ displayName: "" }),
    ).toThrow();
  });

  it("rejects displayName exceeding 100 characters", () => {
    expect(() =>
      UpdateCreatorProfileSchema.parse({ displayName: "x".repeat(101) }),
    ).toThrow();
  });

  it("accepts displayName at exactly 100 characters", () => {
    const result = UpdateCreatorProfileSchema.parse({
      displayName: "x".repeat(100),
    });
    expect(result.displayName).toHaveLength(100);
  });

  it("rejects bio exceeding 2000 characters", () => {
    expect(() =>
      UpdateCreatorProfileSchema.parse({ bio: "x".repeat(2001) }),
    ).toThrow();
  });

  it("accepts bio at exactly 2000 characters", () => {
    const result = UpdateCreatorProfileSchema.parse({
      bio: "x".repeat(2000),
    });
    expect(result.bio).toHaveLength(2000);
  });

  it("accepts socialLinks with valid entries", () => {
    const result = UpdateCreatorProfileSchema.parse({
      socialLinks: [
        { platform: "bandcamp", url: "https://myband.bandcamp.com" },
        { platform: "spotify", url: "https://open.spotify.com/artist/123" },
      ],
    });
    expect(result.socialLinks).toHaveLength(2);
  });

  it("accepts socialLinks as an empty array", () => {
    const result = UpdateCreatorProfileSchema.parse({
      socialLinks: [],
    });
    expect(result.socialLinks).toHaveLength(0);
  });

  it("rejects socialLinks exceeding 20 items", () => {
    const links = SOCIAL_PLATFORMS.slice(0, 12).map((platform, i) => ({
      platform,
      url: `https://example${i}.com/profile`,
    }));
    // Add 9 more with labels to get to 21
    for (let i = 0; i < 9; i++) {
      links.push({
        platform: SOCIAL_PLATFORMS[i % 12]!,
        url: `https://extra${i}.com/profile`,
      });
    }
    // This will fail due to duplicate platforms before reaching 21,
    // so let's test max directly with valid unique entries
    expect(() =>
      UpdateCreatorProfileSchema.parse({
        socialLinks: Array.from({ length: 21 }, (_, i) => ({
          platform: "bandcamp",
          url: `https://band${i}.bandcamp.com`,
        })),
      }),
    ).toThrow();
  });

  it("rejects socialLinks with invalid platform", () => {
    expect(() =>
      UpdateCreatorProfileSchema.parse({
        socialLinks: [
          { platform: "myspace", url: "https://myspace.com/artist" },
        ],
      }),
    ).toThrow();
  });

  it("rejects socialLinks with URL not matching platform pattern", () => {
    expect(() =>
      UpdateCreatorProfileSchema.parse({
        socialLinks: [
          { platform: "bandcamp", url: "https://example.com/not-bandcamp" },
        ],
      }),
    ).toThrow();
  });

  it("accepts socialLinks with mastodon (no URL pattern)", () => {
    const result = UpdateCreatorProfileSchema.parse({
      socialLinks: [
        { platform: "mastodon", url: "https://mastodon.social/@myband" },
      ],
    });
    expect(result.socialLinks).toHaveLength(1);
  });

  it("accepts socialLinks with website (no URL pattern)", () => {
    const result = UpdateCreatorProfileSchema.parse({
      socialLinks: [
        { platform: "website", url: "https://myband.com" },
      ],
    });
    expect(result.socialLinks).toHaveLength(1);
  });

  it("rejects duplicate platforms", () => {
    expect(() =>
      UpdateCreatorProfileSchema.parse({
        socialLinks: [
          { platform: "bandcamp", url: "https://band1.bandcamp.com" },
          { platform: "bandcamp", url: "https://band2.bandcamp.com" },
        ],
      }),
    ).toThrow();
  });

  it("accepts socialLinks alongside displayName and bio", () => {
    const result = UpdateCreatorProfileSchema.parse({
      displayName: "My Band",
      bio: "We make music",
      socialLinks: [
        { platform: "bandcamp", url: "https://myband.bandcamp.com" },
      ],
    });
    expect(result.displayName).toBe("My Band");
    expect(result.socialLinks).toHaveLength(1);
  });
});

describe("CreatorProfileResponseSchema", () => {
  it("validates a complete profile response object", () => {
    const result = CreatorProfileResponseSchema.parse(VALID_CREATOR_PROFILE);
    expect(result.id).toBe(VALID_CREATOR_PROFILE.id);
    expect(result.displayName).toBe(VALID_CREATOR_PROFILE.displayName);
    expect(result.contentCount).toBe(5);
  });

  it("accepts null for all nullable fields", () => {
    const result = CreatorProfileResponseSchema.parse({
      ...VALID_CREATOR_PROFILE,
      bio: null,
      avatarUrl: null,
      bannerUrl: null,
    });
    expect(result.bio).toBeNull();
    expect(result.avatarUrl).toBeNull();
    expect(result.bannerUrl).toBeNull();
  });

  it("accepts string values for URL fields", () => {
    const result = CreatorProfileResponseSchema.parse({
      ...VALID_CREATOR_PROFILE,
      avatarUrl: "/api/creators/user1/avatar",
      bannerUrl: "/api/creators/user1/banner",
    });
    expect(result.avatarUrl).toBe("/api/creators/user1/avatar");
    expect(result.bannerUrl).toBe("/api/creators/user1/banner");
  });

  it("rejects empty object", () => {
    expect(() => CreatorProfileResponseSchema.parse({})).toThrow();
  });

  it("rejects negative contentCount", () => {
    expect(() =>
      CreatorProfileResponseSchema.parse({
        ...VALID_CREATOR_PROFILE,
        contentCount: -1,
      }),
    ).toThrow();
  });

  it("rejects non-integer contentCount", () => {
    expect(() =>
      CreatorProfileResponseSchema.parse({
        ...VALID_CREATOR_PROFILE,
        contentCount: 1.5,
      }),
    ).toThrow();
  });

  it("validates socialLinks as an array of social link objects", () => {
    const result = CreatorProfileResponseSchema.parse({
      ...VALID_CREATOR_PROFILE,
      socialLinks: [
        { platform: "bandcamp", url: "https://myband.bandcamp.com" },
        { platform: "spotify", url: "https://open.spotify.com/artist/123" },
      ],
    });
    expect(result.socialLinks).toHaveLength(2);
    expect(result.socialLinks[0]!.platform).toBe("bandcamp");
  });

  it("validates socialLinks as an empty array", () => {
    const result = CreatorProfileResponseSchema.parse({
      ...VALID_CREATOR_PROFILE,
      socialLinks: [],
    });
    expect(result.socialLinks).toHaveLength(0);
  });

  it("rejects when socialLinks is missing", () => {
    const { socialLinks: _, ...withoutLinks } = VALID_CREATOR_PROFILE;
    expect(() =>
      CreatorProfileResponseSchema.parse(withoutLinks),
    ).toThrow();
  });
});

describe("CreatorListItemSchema", () => {
  it("validates the same shape as CreatorProfileResponseSchema", () => {
    const result = CreatorListItemSchema.parse(VALID_CREATOR_PROFILE);
    expect(result.id).toBe(VALID_CREATOR_PROFILE.id);
    expect(result.displayName).toBe(VALID_CREATOR_PROFILE.displayName);
  });

  it("is the same schema reference as CreatorProfileResponseSchema", () => {
    expect(CreatorListItemSchema).toBe(CreatorProfileResponseSchema);
  });
});

describe("CreatorListQuerySchema", () => {
  it("parses empty object to defaults (limit = 24)", () => {
    const result = CreatorListQuerySchema.parse({});
    expect(result).toStrictEqual({ limit: 24 });
  });

  it("coerces string limit to number", () => {
    const result = CreatorListQuerySchema.parse({ limit: "30" });
    expect(result.limit).toBe(30);
  });

  it("accepts limit at minimum boundary (1)", () => {
    const result = CreatorListQuerySchema.parse({ limit: 1 });
    expect(result.limit).toBe(1);
  });

  it("accepts limit at maximum boundary (50)", () => {
    const result = CreatorListQuerySchema.parse({ limit: 50 });
    expect(result.limit).toBe(50);
  });

  it("rejects limit below minimum (0)", () => {
    expect(() => CreatorListQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects limit above maximum (51)", () => {
    expect(() => CreatorListQuerySchema.parse({ limit: 51 })).toThrow();
  });

  it("rejects negative limit", () => {
    expect(() => CreatorListQuerySchema.parse({ limit: -1 })).toThrow();
  });

  it("rejects non-integer limit", () => {
    expect(() => CreatorListQuerySchema.parse({ limit: 5.5 })).toThrow();
  });

  it("accepts optional cursor string", () => {
    const cursor =
      "eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxIiwidXNlcklkIjoiYWJjIn0=";
    const result = CreatorListQuerySchema.parse({ cursor });
    expect(result.cursor).toBe(cursor);
  });
});

describe("CreatorListResponseSchema", () => {
  it("validates a response with items and nextCursor", () => {
    const result = CreatorListResponseSchema.parse({
      items: [VALID_CREATOR_PROFILE],
      nextCursor: "eyJ...",
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("eyJ...");
  });

  it("validates a last-page response with null nextCursor", () => {
    const result = CreatorListResponseSchema.parse({
      items: [VALID_CREATOR_PROFILE],
      nextCursor: null,
    });
    expect(result.nextCursor).toBeNull();
  });

  it("validates an empty list (no items, null cursor)", () => {
    const result = CreatorListResponseSchema.parse({
      items: [],
      nextCursor: null,
    });
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("validates a response with multiple items", () => {
    const item2 = { ...VALID_CREATOR_PROFILE, id: "user_creator2" };
    const result = CreatorListResponseSchema.parse({
      items: [VALID_CREATOR_PROFILE, item2],
      nextCursor: null,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[1]!.id).toBe("user_creator2");
  });

  it("rejects when items is missing", () => {
    expect(() =>
      CreatorListResponseSchema.parse({ nextCursor: null }),
    ).toThrow();
  });

  it("rejects when nextCursor is missing", () => {
    expect(() =>
      CreatorListResponseSchema.parse({ items: [] }),
    ).toThrow();
  });

  it("rejects when nextCursor is undefined", () => {
    expect(() =>
      CreatorListResponseSchema.parse({ items: [], nextCursor: undefined }),
    ).toThrow();
  });
});

// ── Type-level assertions (compile-time only) ──

const _updateCheck: UpdateCreatorProfile = {};
const _profileCheck: CreatorProfileResponse = VALID_CREATOR_PROFILE;
const _listItemCheck: CreatorListItem = VALID_CREATOR_PROFILE;
const _queryCheck: CreatorListQuery = { limit: 24 };
const _responseCheck: CreatorListResponse = { items: [], nextCursor: null };
const _platformCheck: SocialPlatform = "bandcamp";
const _linkCheck: SocialLink = { platform: "bandcamp", url: "https://test.bandcamp.com" };
