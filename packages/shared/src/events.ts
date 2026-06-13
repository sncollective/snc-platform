import { z } from "zod";

// ── Platform events (discriminated union on `type`) ──

/** Schema for a channel live-state transition notification. */
export const ChannelLiveStateChangedSchema = z.object({
  type: z.literal("channel.live-state-changed"),
  channelId: z.string(),
  live: z.boolean(),
});

/** Schema for a playout queue membership change notification. */
export const PlayoutQueueChangedSchema = z.object({
  type: z.literal("playout.queue-changed"),
  channelId: z.string(),
});

/** Schema for a now-playing track change notification. */
export const PlayoutNowPlayingChangedSchema = z.object({
  type: z.literal("playout.now-playing-changed"),
  channelId: z.string(),
});

/** Schema for a playout engine restart notification. */
export const PlayoutEngineRestartedSchema = z.object({
  type: z.literal("playout.engine-restarted"),
});

/** Schema for a content processing status change notification. */
export const ContentProcessingStatusChangedSchema = z.object({
  type: z.literal("content.processing-status-changed"),
  contentId: z.string(),
  creatorId: z.string(),
  /** Current processing status — hint only; client should re-fetch for full state. */
  status: z.string(),
});

/**
 * Discriminated union of all platform SSE events.
 * Every event type must be registered in the API-side EVENT_REGISTRY.
 */
export const PlatformEventSchema = z.discriminatedUnion("type", [
  ChannelLiveStateChangedSchema,
  PlayoutQueueChangedSchema,
  PlayoutNowPlayingChangedSchema,
  PlayoutEngineRestartedSchema,
  ContentProcessingStatusChangedSchema,
]);

/** Union of all platform SSE event payloads. */
export type PlatformEvent = z.infer<typeof PlatformEventSchema>;

// ── Topics ──

/** All recognised SSE topic names. */
export const SSE_TOPICS = ["live", "playout", "content"] as const;

/** An individual SSE topic name. */
export type SseTopic = (typeof SSE_TOPICS)[number];

/** Access level required to receive events on a topic. */
export type TopicAccess = "public" | "authenticated" | "admin";

/**
 * Maps each topic to its required access level.
 * Event-type → topic mapping lives in the API-side EVENT_REGISTRY.
 */
export const TOPIC_ACCESS: Record<SseTopic, TopicAccess> = {
  live: "public",
  playout: "admin",
  content: "authenticated",
};

// ── Protocol meta (NOT in the PlatformEvent union) ──

/** Payload for the `spine.connected` protocol event sent immediately on SSE connect. */
export const SpineConnectedSchema = z.object({
  granted: z.array(z.enum(SSE_TOPICS)),
  denied: z.array(z.enum(SSE_TOPICS)),
});

/** Payload of the `spine.connected` handshake event. */
export type SpineConnected = z.infer<typeof SpineConnectedSchema>;
