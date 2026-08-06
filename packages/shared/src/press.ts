import { z } from "zod";

// ── Press Config ──

/** Return whether a Garage key belongs to a creator's dedicated press namespace. */
export const isOwnedPressKey = (key: string, creatorId: string): boolean =>
  key.startsWith(`creators/${creatorId}/press/`);

/** A labeled public listening destination for a creator. */
export const PressStreamingLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});
export type PressStreamingLink = z.infer<typeof PressStreamingLinkSchema>;

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
  shortBio: z.string().nullable().optional(),
  longBio: z.string().nullable().optional(),
  forFansOf: z.array(z.string()).default([]),
  streamingLinks: z.array(PressStreamingLinkSchema).default([]),
  liveDatesUrl: z.string().url().nullable().optional(),
  standoutTrack: PressStandoutTrackSchema.nullable(),
  pressContactEmail: z.string().email().nullable().optional(),
  location: z.string().nullable().optional(),
  photos: z.array(z.string()).default([]),
  releases: PressReleasesSchema.default([]),
});
export type PressContent = z.infer<typeof PressContentSchema>;

/** Patch shape for updating a creator's press config (all fields optional, no defaults). */
export const PressConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  shortBio: z.string().nullable().optional(),
  longBio: z.string().nullable().optional(),
  forFansOf: z.array(z.string()).optional(),
  streamingLinks: z.array(PressStreamingLinkSchema).optional(),
  liveDatesUrl: z.string().url().nullable().optional(),
  standoutTrack: PressStandoutTrackSchema.nullable().optional(),
  pressContactEmail: z.string().email().nullable().optional(),
  location: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  releases: PressReleasesSchema.optional(),
});
export type PressConfigPatch = z.infer<typeof PressConfigPatchSchema>;

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
  shortBio: null,
  longBio: null,
  forFansOf: [],
  streamingLinks: [],
  liveDatesUrl: null,
  standoutTrack: null,
  pressContactEmail: null,
  location: null,
  photos: [],
  releases: [],
};
