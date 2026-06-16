import { z } from "zod";

// ── Editorial Mode ──

/** Editorial control mode for a channel. */
export const EDITORIAL_MODES = ["manual", "auto"] as const;
export type EditorialMode = (typeof EDITORIAL_MODES)[number];
export const EditorialModeSchema = z.enum(EDITORIAL_MODES);

// ── Editorial Tier Types ──

/**
 * Source tier type within a channel's editorial switch.
 *
 * - `live` — live RTMP ingest from the channel's live-ingest input
 * - `queue` — request.queue playout (the armed, manually-ordered queue)
 * - `pool` — request.dynamic pool of channel_content items (auto-rotated)
 * - `channel-as-source` — another channel's rendered source (carry model)
 */
export const EDITORIAL_TIER_TYPES = [
  "live",
  "queue",
  "pool",
  "channel-as-source",
] as const;
export type EditorialTierType = (typeof EDITORIAL_TIER_TYPES)[number];
export const EditorialTierTypeSchema = z.enum(EDITORIAL_TIER_TYPES);

// ── API Shapes ──

export const EditorialConfigSchema = z.object({
  channelId: z.string(),
  mode: EditorialModeSchema,
  manualTierId: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export type EditorialConfig = z.infer<typeof EditorialConfigSchema>;

export const EditorialTierSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  tierType: EditorialTierTypeSchema,
  priority: z.number().int().min(0),
  sourceChannelId: z.string().nullable(),
});

export type EditorialTier = z.infer<typeof EditorialTierSchema>;

/** Full editorial config with ordered tiers, shaped for topology build. */
export const EditorialConfigWithTiersSchema = EditorialConfigSchema.extend({
  tiers: z.array(EditorialTierSchema),
});

export type EditorialConfigWithTiers = z.infer<
  typeof EditorialConfigWithTiersSchema
>;

// ── Mutation Shapes ──

export const UpsertEditorialConfigSchema = z.object({
  mode: EditorialModeSchema,
  manualTierId: z.string().nullable().optional(),
});

export type UpsertEditorialConfig = z.infer<typeof UpsertEditorialConfigSchema>;

export const CreateEditorialTierSchema = z.object({
  tierType: EditorialTierTypeSchema,
  priority: z.number().int().min(0),
  sourceChannelId: z.string().nullable().optional(),
});

export type CreateEditorialTier = z.infer<typeof CreateEditorialTierSchema>;

export const UpdateEditorialTierSchema = z.object({
  tierType: EditorialTierTypeSchema.optional(),
  priority: z.number().int().min(0).optional(),
  sourceChannelId: z.string().nullable().optional(),
});

export type UpdateEditorialTier = z.infer<typeof UpdateEditorialTierSchema>;
