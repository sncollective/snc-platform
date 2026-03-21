import { z } from "zod";

import { SOURCE_TYPES, SourceTypeSchema } from "./uploads.js";

// ── Public Constants ──

export const CONTENT_TYPES = ["video", "audio", "written"] as const;
export const VISIBILITY = ["public", "subscribers"] as const;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;

// ── Public Schemas ──

export const ContentTypeSchema = z.enum(CONTENT_TYPES);
export const VisibilitySchema = z.enum(VISIBILITY);

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
});

export const ContentResponseSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  type: ContentTypeSchema,
  title: z.string(),
  body: z.string().nullable(),
  description: z.string().nullable(),
  visibility: VisibilitySchema,
  sourceType: z.enum(SOURCE_TYPES),
  thumbnailUrl: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  coverArtUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ── Public Types ──

export type ContentType = z.infer<typeof ContentTypeSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type CreateContent = z.infer<typeof CreateContentSchema>;
export type UpdateContent = z.infer<typeof UpdateContentSchema>;
export type ContentResponse = z.infer<typeof ContentResponseSchema>;

// ── Feed Schemas ──

export const FeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().optional(),
  type: ContentTypeSchema.optional(),
  creatorId: z.string().optional(),
});

export const FeedItemSchema = ContentResponseSchema.extend({
  creatorName: z.string(),
});

export const FeedResponseSchema = z.object({
  items: z.array(FeedItemSchema),
  nextCursor: z.string().nullable(),
});

// ── Feed Types ──

export type FeedQuery = z.infer<typeof FeedQuerySchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
