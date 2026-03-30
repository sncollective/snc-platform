import { z } from "zod";

// ── Rendition Profiles (SSOT) ──

/** Encoding parameters for a single rendition. */
export type RenditionProfile = {
  readonly width?: number;
  readonly height?: number;
  readonly crf?: number;
  readonly preset?: string;
  readonly audioBitrate: string;
};

export const RENDITION_PROFILES = {
  "1080p": { width: 1920, height: 1080, crf: 18, preset: "medium", audioBitrate: "192k" },
  "720p": { width: 1280, height: 720, crf: 20, preset: "medium", audioBitrate: "128k" },
  "480p": { width: 854, height: 480, crf: 22, preset: "medium", audioBitrate: "96k" },
  "audio": { audioBitrate: "192k" },
} as const satisfies Record<string, RenditionProfile>;

export const RENDITIONS = Object.keys(RENDITION_PROFILES) as Rendition[];
export type Rendition = keyof typeof RENDITION_PROFILES;

export const VIDEO_RENDITIONS = ["1080p", "720p", "480p"] as const;
export type VideoRendition = (typeof VIDEO_RENDITIONS)[number];

// ── Processing Status ──

export const PLAYOUT_PROCESSING_STATUSES = ["pending", "uploading", "processing", "ready", "failed"] as const;
export type PlayoutProcessingStatus = (typeof PLAYOUT_PROCESSING_STATUSES)[number];

// ── Playout Item Schemas ──

export const PlayoutItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  director: z.string().nullable(),
  duration: z.number().nullable(),
  sourceWidth: z.number().int().nullable(),
  sourceHeight: z.number().int().nullable(),
  processingStatus: z.enum(PLAYOUT_PROCESSING_STATUSES),
  position: z.number().int(),
  enabled: z.boolean(),
  renditions: z.object({
    source: z.boolean(),
    "1080p": z.boolean(),
    "720p": z.boolean(),
    "480p": z.boolean(),
    audio: z.boolean(),
  }),
  hasSubtitles: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PlayoutItem = z.infer<typeof PlayoutItemSchema>;

export const PlayoutItemListResponseSchema = z.object({
  items: z.array(PlayoutItemSchema),
});

export type PlayoutItemListResponse = z.infer<typeof PlayoutItemListResponseSchema>;

export const CreatePlayoutItemSchema = z.object({
  title: z.string().min(1).max(255),
  year: z.number().int().min(1888).max(2100).nullable().optional(),
  director: z.string().max(255).nullable().optional(),
});

export type CreatePlayoutItem = z.infer<typeof CreatePlayoutItemSchema>;

export const UpdatePlayoutItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  year: z.number().int().min(1888).max(2100).nullable().optional(),
  director: z.string().max(255).nullable().optional(),
});

export type UpdatePlayoutItem = z.infer<typeof UpdatePlayoutItemSchema>;

export const ReorderPlayoutItemsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export type ReorderPlayoutItems = z.infer<typeof ReorderPlayoutItemsSchema>;

// ── Batch Playlist Save ──

export const SavePlaylistItemSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  position: z.number().int().min(0),
});

export const SavePlaylistSchema = z.object({
  items: z.array(SavePlaylistItemSchema).min(1),
});

export type SavePlaylist = z.infer<typeof SavePlaylistSchema>;

// ── Queue Entry (admin visibility) ──

export const QueueEntrySchema = z.object({
  itemId: z.string(),
  title: z.string(),
  queuedAt: z.string().datetime(),
});

export type QueueEntry = z.infer<typeof QueueEntrySchema>;

// ── Now-Playing ──

export const NowPlayingSchema = z.object({
  itemId: z.string().nullable(),
  title: z.string().nullable(),
  year: z.number().int().nullable(),
  director: z.string().nullable(),
  duration: z.number().nullable(),
  elapsed: z.number(),
  remaining: z.number(),
});

export type NowPlaying = z.infer<typeof NowPlayingSchema>;

// ── Playout Status (admin view — faster poll) ──

export const PlayoutStatusSchema = z.object({
  nowPlaying: NowPlayingSchema.nullable(),
  queuedItems: z.array(QueueEntrySchema),
});

export type PlayoutStatus = z.infer<typeof PlayoutStatusSchema>;
