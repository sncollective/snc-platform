import { z } from "zod";

// ── Public Constants ──

export const SOURCE_TYPES = ["upload", "stream-recording"] as const;

export const UPLOAD_PURPOSES = [
  "content-media",
  "content-thumbnail",
  "creator-avatar",
  "creator-banner",
  "playout-media",
] as const;

/** File size above which uploads switch to multipart (bytes). */
export const MULTIPART_THRESHOLD = 50 * 1024 * 1024;
/** Size of each part in a multipart upload (bytes). */
export const MULTIPART_CHUNK_SIZE = 50 * 1024 * 1024;

// ── Public Schemas ──

export const SourceTypeSchema = z.enum(SOURCE_TYPES);

export const UploadPurposeSchema = z.enum(UPLOAD_PURPOSES);

const UploadRequestBaseSchema = z.object({
  purpose: UploadPurposeSchema,
  resourceId: z.string().min(1),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

export const PresignRequestSchema = UploadRequestBaseSchema.extend({});

export const PresignResponseSchema = z.object({
  url: z.string(),
  key: z.string(),
  method: z.literal("PUT"),
});

export const CreateMultipartRequestSchema = UploadRequestBaseSchema.extend({});

export const CreateMultipartResponseSchema = z.object({
  uploadId: z.string(),
  key: z.string(),
});

export const SignPartResponseSchema = z.object({
  url: z.string(),
});

export const CompletedPartSchema = z.object({
  PartNumber: z.number().int().positive(),
  ETag: z.string().min(1),
});

export const CompleteMultipartRequestSchema = z.object({
  key: z.string().min(1),
  parts: z.array(CompletedPartSchema).min(1),
});

export const CompleteUploadRequestSchema = z.object({
  key: z.string().min(1),
  purpose: UploadPurposeSchema,
  resourceId: z.string().min(1),
});

export const ListPartsResponseSchema = z.array(
  z.object({
    PartNumber: z.number(),
    Size: z.number(),
    ETag: z.string(),
  }),
);

// ── Public Types ──

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type UploadPurpose = z.infer<typeof UploadPurposeSchema>;
export type PresignRequest = z.infer<typeof PresignRequestSchema>;
export type PresignResponse = z.infer<typeof PresignResponseSchema>;
export type CreateMultipartRequest = z.infer<typeof CreateMultipartRequestSchema>;
export type CreateMultipartResponse = z.infer<typeof CreateMultipartResponseSchema>;
export type SignPartResponse = z.infer<typeof SignPartResponseSchema>;
export type CompletedPart = z.infer<typeof CompletedPartSchema>;
export type CompleteMultipartRequest = z.infer<typeof CompleteMultipartRequestSchema>;
export type CompleteUploadRequest = z.infer<typeof CompleteUploadRequestSchema>;
