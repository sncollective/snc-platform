import { z } from "zod";

// ── Public Constants ──

export const SOCIAL_PLATFORMS = [
  "bandcamp",
  "spotify",
  "apple-music",
  "soundcloud",
  "youtube-music",
  "tidal",
  "instagram",
  "tiktok",
  "twitter",
  "mastodon",
  "youtube",
  "website",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { displayName: string; urlPattern?: RegExp }
> = {
  bandcamp: {
    displayName: "Bandcamp",
    urlPattern: /^https?:\/\/[a-zA-Z0-9-]+\.bandcamp\.com(\/.*)?$/,
  },
  spotify: {
    displayName: "Spotify",
    urlPattern: /^https?:\/\/(open\.)?spotify\.com\/.+$/,
  },
  "apple-music": {
    displayName: "Apple Music",
    urlPattern: /^https?:\/\/music\.apple\.com\/.+$/,
  },
  soundcloud: {
    displayName: "SoundCloud",
    urlPattern: /^https?:\/\/(www\.)?soundcloud\.com\/.+$/,
  },
  "youtube-music": {
    displayName: "YouTube Music",
    urlPattern: /^https?:\/\/music\.youtube\.com\/.+$/,
  },
  tidal: {
    displayName: "Tidal",
    urlPattern: /^https?:\/\/(www\.|listen\.)?tidal\.com\/.+$/,
  },
  instagram: {
    displayName: "Instagram",
    urlPattern: /^https?:\/\/(www\.)?instagram\.com\/.+$/,
  },
  tiktok: {
    displayName: "TikTok",
    urlPattern: /^https?:\/\/(www\.)?tiktok\.com\/.+$/,
  },
  twitter: {
    displayName: "Twitter / X",
    urlPattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+$/,
  },
  mastodon: { displayName: "Mastodon" },
  youtube: {
    displayName: "YouTube",
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/.+$/,
  },
  website: { displayName: "Website" },
};

export const MAX_SOCIAL_LINKS = 20;

export const SocialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string().url(),
  label: z.string().max(100).optional(),
});

export type SocialLink = z.infer<typeof SocialLinkSchema>;

// ── Creator Member Roles ──

export const CREATOR_MEMBER_ROLES = ["owner", "editor", "viewer"] as const;
export type CreatorMemberRole = (typeof CREATOR_MEMBER_ROLES)[number];
export const CreatorMemberRoleSchema = z.enum(CREATOR_MEMBER_ROLES);

export const CREATOR_ROLE_PERMISSIONS = {
  owner:  { editProfile: true,  manageContent: true,  manageScheduling: true,  manageMembers: true,  viewPrivate: true  },
  editor: { editProfile: true,  manageContent: true,  manageScheduling: true,  manageMembers: false, viewPrivate: true  },
  viewer: { editProfile: false, manageContent: false, manageScheduling: false, manageMembers: false, viewPrivate: true  },
} as const satisfies Record<CreatorMemberRole, Record<string, boolean>>;

export type CreatorPermission = keyof (typeof CREATOR_ROLE_PERMISSIONS)["owner"];

// ── Public Schemas ──

export const HANDLE_REGEX = /^[a-z0-9_-]{3,30}$/;

export const UpdateCreatorProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  handle: z
    .string()
    .regex(HANDLE_REGEX, "Handle must be 3–30 characters: lowercase letters, digits, _ or -")
    .optional()
    .nullable(),
  socialLinks: z
    .array(SocialLinkSchema)
    .max(MAX_SOCIAL_LINKS, `Maximum ${MAX_SOCIAL_LINKS} links allowed`)
    .optional()
    .refine(
      (links) => {
        if (!links) return true;
        for (const link of links) {
          const config = PLATFORM_CONFIG[link.platform];
          if (config.urlPattern && !config.urlPattern.test(link.url)) {
            return false;
          }
        }
        return true;
      },
      { message: "One or more URLs do not match their platform's expected format" },
    )
    .refine(
      (links) => {
        if (!links) return true;
        const platforms = links.map((l) => l.platform);
        return new Set(platforms).size === platforms.length;
      },
      { message: "Duplicate platforms are not allowed" },
    ),
});

export const CreatorProfileResponseSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  handle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  socialLinks: z.array(SocialLinkSchema),
  contentCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreatorListItemSchema = CreatorProfileResponseSchema.extend({
  canManage: z.boolean().optional(),
  isSubscribed: z.boolean().optional(),
  subscriberCount: z.number().int().min(0).optional(),
  lastPublishedAt: z.string().nullable().optional(),
});

export const CreatorListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

export const CreatorListResponseSchema = z.object({
  items: z.array(CreatorListItemSchema),
  nextCursor: z.string().nullable(),
});

export const CreateCreatorSchema = z.object({
  displayName: z.string().min(1).max(100),
  handle: z.string().regex(HANDLE_REGEX).optional(),
});

export const CreatorMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  role: CreatorMemberRoleSchema,
  joinedAt: z.string(),
});

export const AddCreatorMemberSchema = z.object({
  userId: z.string(),
  role: CreatorMemberRoleSchema,
});

export const UpdateCreatorMemberSchema = z.object({
  role: CreatorMemberRoleSchema,
});

export const CreatorMembersResponseSchema = z.object({
  members: z.array(CreatorMemberSchema),
});

export const CreatorMemberCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
});

export const CandidatesQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const CandidatesResponseSchema = z.object({
  candidates: z.array(CreatorMemberCandidateSchema),
});

// ── Public Types ──

export type UpdateCreatorProfile = z.infer<typeof UpdateCreatorProfileSchema>;
export type CreatorProfileResponse = z.infer<typeof CreatorProfileResponseSchema>;
export type CreatorListItem = z.infer<typeof CreatorListItemSchema>;
export type CreatorListQuery = z.infer<typeof CreatorListQuerySchema>;
export type CreatorListResponse = z.infer<typeof CreatorListResponseSchema>;
export type CreateCreator = z.infer<typeof CreateCreatorSchema>;
export type CreatorMember = z.infer<typeof CreatorMemberSchema>;
export type AddCreatorMember = z.infer<typeof AddCreatorMemberSchema>;
export type UpdateCreatorMember = z.infer<typeof UpdateCreatorMemberSchema>;
export type CreatorMembersResponse = z.infer<typeof CreatorMembersResponseSchema>;
export type CreatorMemberCandidate = z.infer<typeof CreatorMemberCandidateSchema>;
export type CandidatesQuery = z.infer<typeof CandidatesQuerySchema>;
export type CandidatesResponse = z.infer<typeof CandidatesResponseSchema>;
