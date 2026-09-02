import { z } from "zod";

// ── Press Config ──

/** Return whether a Garage key belongs to a creator's dedicated press namespace. */
export const isOwnedPressKey = (key: string, creatorId: string): boolean =>
  key.startsWith(`creators/${creatorId}/press/`);

/** Streaming service identifiers used by press-page templates. */
export const PressStreamingServiceSchema = z.enum([
  "spotify",
  "apple-music",
  "amazon-music",
  "youtube",
  "bandcamp",
  "soundcloud",
  "tidal",
  "website",
]);
export type PressStreamingService = z.infer<typeof PressStreamingServiceSchema>;

/** Infer a streaming service from a URL host, falling back to a website link. */
export const inferService = (url: string): PressStreamingService => {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "website";
  }

  const matchesHost = (domain: string): boolean =>
    hostname === domain || hostname.endsWith(`.${domain}`);

  if (matchesHost("spotify.com")) return "spotify";
  if (matchesHost("music.apple.com")) return "apple-music";
  if (matchesHost("music.amazon.com")) return "amazon-music";
  if (matchesHost("youtube.com") || matchesHost("youtu.be")) return "youtube";
  if (matchesHost("bandcamp.com")) return "bandcamp";
  if (matchesHost("soundcloud.com")) return "soundcloud";
  if (matchesHost("tidal.com")) return "tidal";
  return "website";
};

const PressStreamingLinkShapeSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  service: PressStreamingServiceSchema.optional(),
});

const normalizeStreamingService = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  if (!("service" in candidate) && typeof candidate.url === "string") {
    return { ...candidate, service: inferService(candidate.url) };
  }
  return value;
};

/** A listening destination, accepting and normalizing the live v1 link shape. */
export const PressStreamingLinkSchema = z.preprocess(
  normalizeStreamingService,
  PressStreamingLinkShapeSchema,
);
export type PressStreamingLink = z.infer<typeof PressStreamingLinkSchema>;

const canonicalizeNormalizedValue = (value: number): number =>
  Math.round(value * 1_000_000) / 1_000_000;

const NormalizedCoordinateSchema = z.number().finite().min(0).max(1);
const NormalizedDimensionSchema = z.number().finite().positive().max(1);

const PressImageCropInputSchema = z
  .object({
    x: NormalizedCoordinateSchema,
    y: NormalizedCoordinateSchema,
    width: NormalizedDimensionSchema,
    height: NormalizedDimensionSchema,
  })
  .refine((crop) => crop.x + crop.width <= 1, {
    path: ["width"],
    message: "Crop width must remain within the source image",
  })
  .refine((crop) => crop.y + crop.height <= 1, {
    path: ["height"],
    message: "Crop height must remain within the source image",
  });

/** A normalized source-image crop rectangle, canonicalized for stable persistence. */
export const PressImageCropSchema = PressImageCropInputSchema.transform((crop) => ({
  x: canonicalizeNormalizedValue(crop.x),
  y: canonicalizeNormalizedValue(crop.y),
  width: canonicalizeNormalizedValue(crop.width),
  height: canonicalizeNormalizedValue(crop.height),
}))
  .refine((crop) => crop.width > 0 && crop.x + crop.width <= 1, {
    path: ["width"],
    message: "Canonical crop width must be positive and remain within the source image",
  })
  .refine((crop) => crop.height > 0 && crop.y + crop.height <= 1, {
    path: ["height"],
    message: "Canonical crop height must be positive and remain within the source image",
  });
export type PressImageCrop = z.infer<typeof PressImageCropSchema>;

/** Fixed press-image slots and their output aspect ratios. */
export type PressImageSlot = {
  banner: "3/1";
  about: "4/5";
  member: "1/1";
  gallery: "4/3";
  cover: "1/1";
};

export const PRESS_IMAGE_SLOT_RATIOS = {
  banner: "3/1",
  about: "4/5",
  member: "1/1",
  gallery: "4/3",
  cover: "1/1",
} as const satisfies PressImageSlot;

/** Maximum delivery width used to preview and render each fixed press-image slot. */
export const PRESS_IMAGE_SLOT_WIDTHS = {
  banner: 1920,
  about: 720,
  member: 480,
  gallery: 960,
  cover: 480,
} as const satisfies Record<keyof PressImageSlot, number>;

export const PressImageSlotSchema = z.enum([
  "banner",
  "about",
  "member",
  "gallery",
  "cover",
]);
export type PressImageSlotName = keyof PressImageSlot;

/** A press image: an opaque storage key with required alternative text. */
export const PressImageSchema = z.object({
  key: z.string().min(1),
  alt: z.string(),
  credit: z.string().nullable().optional(),
  crop: PressImageCropSchema.optional(),
});
export type PressImage = z.infer<typeof PressImageSchema>;

/** A named band member shown on the press page. */
export const PressMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  photo: PressImageSchema.nullable().optional(),
  bio: z.string().nullable().optional(),
});
export type PressMember = z.infer<typeof PressMemberSchema>;

/** A flexible, orderable highlight rendered on the press page. */
export const PressHighlightSchema = z.object({
  eyebrow: z.string(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  metric: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  coverArt: PressImageSchema.nullable().optional(),
});
export type PressHighlight = z.infer<typeof PressHighlightSchema>;

/** A track whose existing traction anchors the creator's press story. */
export const PressStandoutTrackSchema = z.object({
  title: z.string(),
  url: z.string().url().nullable(),
  streamsLabel: z.string().nullable(),
});
export type PressStandoutTrack = z.infer<typeof PressStandoutTrackSchema>;

/** Editable metadata for a release-specific press one-sheet. */
export const ReleaseOneSheetSchema = z.object({
  slug: z
    .string()
    .min(1, "Release slug is required")
    .regex(/^[a-z0-9-]+$/, "Release slug must contain only lowercase letters, numbers, and hyphens"),
  title: z.string(),
  catalogNumber: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  isrc: z.string().nullable().optional(),
  upc: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  personnel: z.array(z.string()).default([]),
  writtenBy: z.string().nullable().optional(),
  producedBy: z.string().nullable().optional(),
  mixedMasteredBy: z.string().nullable().optional(),
  copyrightLine: z.string().nullable().optional(),
  publisherLine: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  fcc: z.enum(["clean", "explicit"]).nullable(),
  artKey: z.string().nullable().optional(),
});
export type ReleaseOneSheet = z.infer<typeof ReleaseOneSheetSchema>;

const PressReleasesSchema = z.array(ReleaseOneSheetSchema).refine(
  (releases) => new Set(releases.map((release) => release.slug)).size === releases.length,
  { message: "Release slugs must be unique" },
);

/** Per-creator press-page configuration (the editable surface). */
export const PressContentSchema = z.object({
  enabled: z.boolean().default(false),
  template: z.enum(["A", "B"]).default("A"),
  tagline: z.string().nullable().optional(),
  shortBio: z.string().nullable().optional(),
  longBio: z.string().nullable().optional(),
  forFansOf: z.array(z.string()).default([]),
  banner: PressImageSchema.nullable().optional(),
  aboutPhoto: PressImageSchema.nullable().optional(),
  members: z.array(PressMemberSchema).default([]),
  streamingLinks: z.array(PressStreamingLinkSchema).default([]),
  liveDatesUrl: z.string().url().nullable().optional(),
  standoutTrack: PressStandoutTrackSchema.nullable().optional(),
  highlights: z.array(PressHighlightSchema).default([]),
  pressContactEmail: z.string().email().nullable().optional(),
  bookingContactEmail: z.string().email().nullable().optional(),
  location: z.string().nullable().optional(),
  photos: z.array(z.string()).default([]),
  gallery: z.array(PressImageSchema).default([]),
  releases: PressReleasesSchema.default([]),
});
export type PressContent = z.infer<typeof PressContentSchema>;

const DraftPressStreamingLinkSchema = z.preprocess(
  normalizeStreamingService,
  PressStreamingLinkShapeSchema.extend({ url: z.string() }),
);
const DraftPressMemberSchema = PressMemberSchema.extend({ name: z.string() });
const DraftPressHighlightSchema = PressHighlightSchema.extend({
  title: z.string(),
  url: z.string().nullable().optional(),
});
const DraftPressStandoutTrackSchema = PressStandoutTrackSchema.extend({
  url: z.string().nullable(),
});

/**
 * Complete editor draft contract. Drafts preserve structurally valid but
 * publish-incomplete values; the strict PressContentSchema remains the live boundary.
 */
export const DraftPressContentSchema = PressContentSchema.extend({
  members: z.array(DraftPressMemberSchema).default([]),
  streamingLinks: z.array(DraftPressStreamingLinkSchema).default([]),
  liveDatesUrl: z.string().nullable().optional(),
  standoutTrack: DraftPressStandoutTrackSchema.nullable().optional(),
  highlights: z.array(DraftPressHighlightSchema).default([]),
  pressContactEmail: z.string().nullable().optional(),
  bookingContactEmail: z.string().nullable().optional(),
});
export type DraftPressContent = z.infer<typeof DraftPressContentSchema>;

/** Patch shape for updating a creator's strict published press config. */
export const PressConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  template: z.enum(["A", "B"]).optional(),
  tagline: z.string().nullable().optional(),
  shortBio: z.string().nullable().optional(),
  longBio: z.string().nullable().optional(),
  forFansOf: z.array(z.string()).optional(),
  banner: PressImageSchema.nullable().optional(),
  aboutPhoto: PressImageSchema.nullable().optional(),
  members: z.array(PressMemberSchema).optional(),
  streamingLinks: z.array(PressStreamingLinkSchema).optional(),
  liveDatesUrl: z.string().url().nullable().optional(),
  standoutTrack: PressStandoutTrackSchema.nullable().optional(),
  highlights: z.array(PressHighlightSchema).optional(),
  pressContactEmail: z.string().email().nullable().optional(),
  bookingContactEmail: z.string().email().nullable().optional(),
  location: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  gallery: z.array(PressImageSchema).optional(),
  releases: PressReleasesSchema.optional(),
});
export type PressConfigPatch = z.infer<typeof PressConfigPatchSchema>;

/**
 * Permissive patch contract for saving editor drafts. It deliberately allows
 * blank member/highlight names and malformed URLs/email until publish validation.
 */
export const DraftPressConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  template: z.enum(["A", "B"]).optional(),
  tagline: z.string().nullable().optional(),
  shortBio: z.string().nullable().optional(),
  longBio: z.string().nullable().optional(),
  forFansOf: z.array(z.string()).optional(),
  banner: PressImageSchema.nullable().optional(),
  aboutPhoto: PressImageSchema.nullable().optional(),
  members: z.array(DraftPressMemberSchema).optional(),
  streamingLinks: z.array(DraftPressStreamingLinkSchema).optional(),
  liveDatesUrl: z.string().nullable().optional(),
  standoutTrack: DraftPressStandoutTrackSchema.nullable().optional(),
  highlights: z.array(DraftPressHighlightSchema).optional(),
  pressContactEmail: z.string().nullable().optional(),
  bookingContactEmail: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  gallery: z.array(PressImageSchema).optional(),
  releases: PressReleasesSchema.optional(),
});
export type DraftPressConfigPatch = z.infer<typeof DraftPressConfigPatchSchema>;

// ── Press Page Payload ──

/** Everything a public creator press page needs in one fetch. */
export const PressPagePayloadSchema = z.object({
  creator: z.object({
    id: z.string(),
    handle: z.string().nullable(),
    displayName: z.string(),
    location: z.string().nullable(),
  }),
  content: PressContentSchema,
});
export type PressPagePayload = z.infer<typeof PressPagePayloadSchema>;

/** Default press config when no row exists. */
export const DEFAULT_PRESS_CONTENT: PressContent = {
  enabled: false,
  template: "A",
  tagline: null,
  shortBio: null,
  longBio: null,
  forFansOf: [],
  banner: null,
  aboutPhoto: null,
  members: [],
  streamingLinks: [],
  liveDatesUrl: null,
  standoutTrack: null,
  highlights: [],
  pressContactEmail: null,
  bookingContactEmail: null,
  location: null,
  photos: [],
  gallery: [],
  releases: [],
};
