import { z } from "zod";

import { createPaginationQuery } from "./pagination.js";
import { SOURCE_TYPES, SourceTypeSchema } from "./uploads.js";

// ── Public Constants ──

export const CONTENT_TYPES = ["video", "audio", "written"] as const;
export const VISIBILITY = ["public", "subscribers"] as const;
export const CONTENT_STATUSES = ["draft", "published"] as const;
export const PROCESSING_STATUSES = ["uploaded", "processing", "ready", "failed"] as const;

export const PROCESSING_JOB_TYPES = ["probe", "transcode", "thumbnail", "vod-remux"] as const;

export const PROCESSING_JOB_STATUSES = ["queued", "processing", "completed", "failed"] as const;
/** Maximum content title length. */
export const MAX_TITLE_LENGTH = 200;
/** Maximum content description length. */
export const MAX_DESCRIPTION_LENGTH = 2000;

// ── Public Schemas ──

export const ContentTypeSchema = z.enum(CONTENT_TYPES);
export const VisibilitySchema = z.enum(VISIBILITY);
export const ContentStatusSchema = z.enum(CONTENT_STATUSES);
export const ProcessingStatusSchema = z.enum(PROCESSING_STATUSES);
export const ProcessingJobTypeSchema = z.enum(PROCESSING_JOB_TYPES);
export const ProcessingJobStatusSchema = z.enum(PROCESSING_JOB_STATUSES);

export const CreateContentSchema = z.object({
  creatorId: z.string(),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  type: ContentTypeSchema,
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  visibility: VisibilitySchema.default("public"),
  body: z.string().optional(),
  sourceType: SourceTypeSchema.default("upload"),
});

export const UpdateContentSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH).optional(),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  visibility: VisibilitySchema.optional(),
  body: z.string().optional(),
  clearThumbnail: z.boolean().optional(),
  clearMedia: z.boolean().optional(),
});

export const ContentResponseSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  slug: z.string().nullable(),
  type: ContentTypeSchema,
  title: z.string(),
  body: z.string().nullable(),
  description: z.string().nullable(),
  visibility: VisibilitySchema,
  sourceType: z.enum(SOURCE_TYPES),
  thumbnailUrl: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  processingStatus: ProcessingStatusSchema.nullable(),
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  duration: z.number().nullable(),
  bitrate: z.number().int().nullable(),
});

// ── Public Types ──

export type ContentType = z.infer<typeof ContentTypeSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;
export type ProcessingJobType = z.infer<typeof ProcessingJobTypeSchema>;
export type ProcessingJobStatus = z.infer<typeof ProcessingJobStatusSchema>;
export type CreateContent = z.infer<typeof CreateContentSchema>;
export type UpdateContent = z.infer<typeof UpdateContentSchema>;
export type ContentResponse = z.infer<typeof ContentResponseSchema>;

/** Derive display status from a content response. */
export const getContentStatus = (item: {
  readonly publishedAt: string | null;
  readonly type: "video" | "audio" | "written";
  readonly mediaUrl: string | null;
}): ContentStatus => {
  if (item.publishedAt) return "published";
  return "draft";
};

export const DraftQuerySchema = z.object({
  creatorId: z.string().min(1),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 12))
    .pipe(z.number().int().min(1).max(50)),
  cursor: z.string().optional(),
});
export type DraftQuery = z.infer<typeof DraftQuerySchema>;

// ── Feed Schemas ──

export const FeedQuerySchema = createPaginationQuery({ max: 50, default: 12 }).extend({
  type: ContentTypeSchema.optional(),
  creatorId: z.string().optional(),
});

export const FeedItemSchema = ContentResponseSchema.extend({
  creatorName: z.string(),
  creatorHandle: z.string().nullable(),
});

export const FeedResponseSchema = z.object({
  items: z.array(FeedItemSchema),
  nextCursor: z.string().nullable(),
});

// ── Feed Types ──

export type FeedQuery = z.infer<typeof FeedQuerySchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
