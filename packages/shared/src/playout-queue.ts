import { z } from "zod";

import { PLAYOUT_PROCESSING_STATUSES } from "./playout.js";

// ── Queue Status ──

export const QUEUE_STATUSES = ["queued", "playing", "played"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

// ── Channel Content (pool item) ──

export const ChannelContentSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  playoutItemId: z.string().nullable(),
  contentId: z.string().nullable(),
  sourceType: z.enum(["playout", "content"]),
  processingStatus: z.enum(PLAYOUT_PROCESSING_STATUSES).nullable(),
  title: z.string(),
  duration: z.number().nullable(),
  lastPlayedAt: z.string().datetime().nullable(),
  playCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export type ChannelContent = z.infer<typeof ChannelContentSchema>;

// ── Pool Candidate (search result for content picker) ──

export const PoolCandidateSchema = z.object({
  id: z.string(),
  sourceType: z.enum(["playout", "content"]),
  title: z.string(),
  duration: z.number().nullable(),
  creator: z.string().nullable(),
});

export type PoolCandidate = z.infer<typeof PoolCandidateSchema>;

// ── Queue Entry ──

export const PlayoutQueueEntrySchema = z.object({
  id: z.string(),
  channelId: z.string(),
  playoutItemId: z.string(),
  position: z.number().int(),
  status: z.enum(QUEUE_STATUSES),
  pushedToLiquidsoap: z.boolean(),
  createdAt: z.string().datetime(),
  // Denormalized from playout_items for display
  title: z.string(),
  duration: z.number().nullable(),
});

export type PlayoutQueueEntry = z.infer<typeof PlayoutQueueEntrySchema>;

// ── Channel Queue Status (admin view) ──

export const ChannelQueueStatusSchema = z.object({
  channelId: z.string(),
  channelName: z.string(),
  nowPlaying: PlayoutQueueEntrySchema.nullable(),
  upcoming: z.array(PlayoutQueueEntrySchema),
  poolSize: z.number().int(),
});

export type ChannelQueueStatus = z.infer<typeof ChannelQueueStatusSchema>;

// ── Content Pool Management ──

export const AssignContentSchema = z
  .object({
    playoutItemIds: z.array(z.string()).optional(),
    contentIds: z.array(z.string()).optional(),
  })
  .refine(
    (d) => (d.playoutItemIds?.length ?? 0) + (d.contentIds?.length ?? 0) > 0,
    { message: "At least one item must be provided" },
  );

export type AssignContent = z.infer<typeof AssignContentSchema>;

export const RemoveContentSchema = z
  .object({
    playoutItemIds: z.array(z.string()).optional(),
    contentIds: z.array(z.string()).optional(),
  })
  .refine(
    (d) => (d.playoutItemIds?.length ?? 0) + (d.contentIds?.length ?? 0) > 0,
    { message: "At least one item must be provided" },
  );

export type RemoveContent = z.infer<typeof RemoveContentSchema>;

// ── Track Event (webhook payload from Liquidsoap) ──

export const TrackEventSchema = z.object({
  uri: z.string(),
  title: z.string().optional(),
});

export type TrackEvent = z.infer<typeof TrackEventSchema>;

// ── Queue Operations ──

export const InsertQueueItemSchema = z.object({
  playoutItemId: z.string(),
  position: z.number().int().min(1).optional(), // omit = end of queue
});

export type InsertQueueItem = z.infer<typeof InsertQueueItemSchema>;
