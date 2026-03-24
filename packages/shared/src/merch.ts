import { z } from "zod";

import { createPaginationQuery } from "./pagination.js";

// ── Public Constants ──

export const CREATOR_TAG_PREFIX = "snc-creator:" as const;

// ── Public Schemas ──

export const MerchImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().nullable(),
});

export const MerchVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number().int().min(0),
  available: z.boolean(),
});

export const MerchProductSchema = z.object({
  handle: z.string(),
  title: z.string(),
  price: z.number().int().min(0),
  image: MerchImageSchema.nullable(),
  creatorName: z.string().nullable(),
  creatorId: z.string().nullable(),
});

export const MerchProductDetailSchema = MerchProductSchema.extend({
  description: z.string(),
  images: z.array(MerchImageSchema),
  variants: z.array(MerchVariantSchema),
});

export const MerchListQuerySchema = createPaginationQuery({ max: 50, default: 12 }).extend({
  creatorId: z.string().optional(),
});

export const MerchListResponseSchema = z.object({
  items: z.array(MerchProductSchema),
  nextCursor: z.string().nullable(),
});

export const MerchCheckoutRequestSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

export const MerchCheckoutResponseSchema = z.object({
  checkoutUrl: z.string().url(),
});

// ── Public Types ──

export type MerchImage = z.infer<typeof MerchImageSchema>;
export type MerchVariant = z.infer<typeof MerchVariantSchema>;
export type MerchProduct = z.infer<typeof MerchProductSchema>;
export type MerchProductDetail = z.infer<typeof MerchProductDetailSchema>;
export type MerchListQuery = z.infer<typeof MerchListQuerySchema>;
export type MerchListResponse = z.infer<typeof MerchListResponseSchema>;
export type MerchCheckoutRequest = z.infer<typeof MerchCheckoutRequestSchema>;
export type MerchCheckoutResponse = z.infer<typeof MerchCheckoutResponseSchema>;
