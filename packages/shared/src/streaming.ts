import { z } from "zod";

import { DprImageSchema } from "./content.js";
import { NowPlayingSchema } from "./playout.js";

// ── Channel Identity (unified-channel-model) ──
//
// `ownership` and `role` are the two orthogonal identity facets that replaced the
// former 4-value `type` enum (which conflated identity with airing-state): routing
// keys on `role`, permissions key on `ownership`. Airing-state (is-this-live-now)
// is NOT modeled here — it is derived state owned by the
// live-experience-redesign-live-state feature.

/** Channel ownership facet — permissions key on this. */
export const CHANNEL_OWNERSHIPS = ["platform", "creator"] as const;
export type ChannelOwnership = (typeof CHANNEL_OWNERSHIPS)[number];

/** Channel role facet — routing keys on this. */
export const CHANNEL_ROLES = ["playout", "broadcast", "live-ingest"] as const;
export type ChannelRole = (typeof CHANNEL_ROLES)[number];

/**
 * Derived airing-state for a channel (not stored — computed per channel-list fetch
 * from SRS session state + Liquidsoap airing telemetry + role; see
 * live-experience-redesign-live-state).
 *
 * - `live-creator` — a creator is on air (keyed-in live-ingest stream, or a creator
 *   takeover of the S/NC TV broadcast via Liquidsoap that bypasses per-channel SRS).
 * - `scheduled-playout` — scheduled/queue content is airing (no live creator).
 * - `offline` — nothing is airing on this channel.
 */
export const CHANNEL_LIVE_STATES = [
  "live-creator",
  "scheduled-playout",
  "offline",
] as const;
export type ChannelLiveState = (typeof CHANNEL_LIVE_STATES)[number];

export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownership: z.enum(CHANNEL_OWNERSHIPS),
  role: z.enum(CHANNEL_ROLES),
  thumbnailUrl: z.string().nullable(),
  hlsUrl: z.string().nullable(),
  viewerCount: z.number().int().min(0),
  creator: z
    .object({
      id: z.string(),
      displayName: z.string(),
      handle: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      avatar: DprImageSchema.nullable(),
    })
    .nullable(),
  startedAt: z.string().datetime().nullable(),
  nowPlaying: NowPlayingSchema.nullable(),
  /** Derived airing-state — see CHANNEL_LIVE_STATES. Computed in srs.ts, never stored. */
  liveState: z.enum(CHANNEL_LIVE_STATES),
});

export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelListResponseSchema = z.object({
  channels: z.array(ChannelSchema),
  defaultChannelId: z.string().nullable(),
});

export type ChannelListResponse = z.infer<typeof ChannelListResponseSchema>;

// ── Stream Status ──

export const StreamCreatorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  handle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export type StreamCreator = z.infer<typeof StreamCreatorSchema>;

export const ActiveStreamSchema = z.object({
  creator: StreamCreatorSchema,
  viewerCount: z.number().int().min(0),
  hlsUrl: z.string().url().nullable(),
  startedAt: z.string().datetime(),
});

export type ActiveStream = z.infer<typeof ActiveStreamSchema>;

export const StreamStatusSchema = z.object({
  isLive: z.boolean(),
  viewerCount: z.number().int().min(0),
  lastLiveAt: z.string().datetime().nullable(),
  hlsUrl: z.string().url().nullable(),
  primary: ActiveStreamSchema.nullable(),
  others: z.array(ActiveStreamSchema),
});

export type StreamStatus = z.infer<typeof StreamStatusSchema>;

// ── Stream Key Management ──

export const StreamKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  createdAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

export type StreamKeyResponse = z.infer<typeof StreamKeyResponseSchema>;

export const StreamKeyCreatedResponseSchema = StreamKeyResponseSchema.extend({
  rawKey: z.string(),
});

export type StreamKeyCreatedResponse = z.infer<typeof StreamKeyCreatedResponseSchema>;

export const CreateStreamKeySchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateStreamKey = z.infer<typeof CreateStreamKeySchema>;

export const StreamKeysListResponseSchema = z.object({
  keys: z.array(StreamKeyResponseSchema),
});

export type StreamKeysListResponse = z.infer<typeof StreamKeysListResponseSchema>;
