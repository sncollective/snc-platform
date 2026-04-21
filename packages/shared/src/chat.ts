import { z } from "zod";

// ── Chat Room ──

export const CHAT_ROOM_TYPES = ["channel", "platform"] as const;
export type ChatRoomType = (typeof CHAT_ROOM_TYPES)[number];

export const ChatRoomSchema = z.object({
  id: z.string(),
  type: z.enum(CHAT_ROOM_TYPES),
  channelId: z.string().nullable(),
  name: z.string(),
  slowModeSeconds: z.number().int().min(0),
  createdAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
});

export type ChatRoom = z.infer<typeof ChatRoomSchema>;

// ── Badge Types ──

export const BADGE_TYPES = ["platform", "creator"] as const;
export type BadgeType = (typeof BADGE_TYPES)[number];

// ── Chat Message ──

export const ChatMessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  userName: z.string(),
  avatarUrl: z.string().nullable(),
  badges: z.array(z.enum(BADGE_TYPES)),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ── WebSocket Events: Client → Server ──

export const ClientJoinEventSchema = z.object({
  type: z.literal("join"),
  roomId: z.string(),
});

export const ClientLeaveEventSchema = z.object({
  type: z.literal("leave"),
  roomId: z.string(),
});

export const ClientMessageEventSchema = z.object({
  type: z.literal("message"),
  roomId: z.string(),
  content: z.string().min(1).max(500),
});

// ── Moderation Constants ──

export const SLOW_MODE_MIN_SECONDS = 0;
export const SLOW_MODE_MAX_SECONDS = 300;
export const TIMEOUT_MAX_SECONDS = 86_400; // 24 hours
export const WORD_FILTER_MAX_PATTERN_LENGTH = 200;
export const WORD_FILTER_MAX_PER_ROOM = 100;

// ── Moderation Action ──

export const MODERATION_ACTION_TYPES = ["timeout", "ban", "unban"] as const;
export type ModerationActionType = (typeof MODERATION_ACTION_TYPES)[number];

export const ModerationActionSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  targetUserId: z.string(),
  targetUserName: z.string(),
  moderatorUserId: z.string(),
  moderatorUserName: z.string(),
  action: z.enum(MODERATION_ACTION_TYPES),
  durationSeconds: z.number().int().positive().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});

export type ModerationAction = z.infer<typeof ModerationActionSchema>;

// ── Word Filter ──

export const WordFilterSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  pattern: z.string().min(1).max(200),
  isRegex: z.boolean(),
  createdAt: z.string().datetime(),
});

export type WordFilter = z.infer<typeof WordFilterSchema>;

// ── Client Events: Moderation Commands ──

export const ClientTimeoutEventSchema = z.object({
  type: z.literal("timeout"),
  roomId: z.string(),
  targetUserId: z.string(),
  durationSeconds: z.number().int().min(1).max(86_400),
  reason: z.string().max(200).optional(),
});

export const ClientBanEventSchema = z.object({
  type: z.literal("ban"),
  roomId: z.string(),
  targetUserId: z.string(),
  reason: z.string().max(200).optional(),
});

export const ClientUnbanEventSchema = z.object({
  type: z.literal("unban"),
  roomId: z.string(),
  targetUserId: z.string(),
});

export const ClientSetSlowModeEventSchema = z.object({
  type: z.literal("set_slow_mode"),
  roomId: z.string(),
  seconds: z.number().int().min(0).max(300),
});

// ── Reaction Constants ──

/** The supported set of emoji reactions. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// ── Reaction State ──

/** The current state of one emoji's reactions on a message, from one user's perspective. */
export type MessageReaction = {
  readonly emoji: ReactionEmoji;
  readonly count: number;
  readonly reactedByMe: boolean;
};

// ── Client Events: Reactions ──

export const ClientAddReactionEventSchema = z.object({
  type: z.literal("add_reaction"),
  roomId: z.string(),
  messageId: z.string(),
  emoji: z.enum(REACTION_EMOJIS),
});

export const ClientRemoveReactionEventSchema = z.object({
  type: z.literal("remove_reaction"),
  roomId: z.string(),
  messageId: z.string(),
  emoji: z.enum(REACTION_EMOJIS),
});

export const ClientEventSchema = z.discriminatedUnion("type", [
  ClientJoinEventSchema,
  ClientLeaveEventSchema,
  ClientMessageEventSchema,
  ClientTimeoutEventSchema,
  ClientBanEventSchema,
  ClientUnbanEventSchema,
  ClientSetSlowModeEventSchema,
  ClientAddReactionEventSchema,
  ClientRemoveReactionEventSchema,
]);

export type ClientEvent = z.infer<typeof ClientEventSchema>;

// ── REST: Moderation History ──

export const ModerationHistoryQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ModerationHistoryResponseSchema = z.object({
  actions: z.array(ModerationActionSchema),
  hasMore: z.boolean(),
});

// ── REST: Word Filters ──

export const CreateWordFilterSchema = z.object({
  pattern: z.string().min(1).max(200),
  isRegex: z.boolean().default(false),
});

export const WordFilterListResponseSchema = z.object({
  filters: z.array(WordFilterSchema),
});

// ── WebSocket Events: Server → Client ──

/** A new chat message delivered to the client. */
export type ServerMessageEvent = {
  readonly type: "message";
  readonly message: ChatMessage;
};

/** Batch of historical messages for a room. */
export type ServerHistoryEvent = {
  readonly type: "history";
  readonly roomId: string;
  readonly messages: ChatMessage[];
  readonly hasMore: boolean;
};

/** Notification that a chat room has been closed. */
export type ServerRoomClosedEvent = {
  readonly type: "room_closed";
  readonly roomId: string;
};

/** Server-side error sent to the client. */
export type ServerErrorEvent = {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
};

// ── Presence ──

/** A user visible in the chat presence list. */
export type PresenceUser = {
  readonly userId: string;
  readonly userName: string;
  readonly avatarUrl: string | null;
};

/** Full presence snapshot for a room. */
export type RoomPresence = {
  readonly viewerCount: number;
  readonly users: readonly PresenceUser[];
};

// ── Presence Server Events ──

/** Full presence state for a room (sent on join and on member changes). */
export type ServerPresenceEvent = {
  readonly type: "presence";
  readonly roomId: string;
  readonly viewerCount: number;
  readonly users: readonly PresenceUser[];
};

/** An authenticated user joined the room. */
export type ServerUserJoinedEvent = {
  readonly type: "user_joined";
  readonly roomId: string;
  readonly userId: string;
  readonly userName: string;
  readonly avatarUrl: string | null;
};

/** An authenticated user left the room. */
export type ServerUserLeftEvent = {
  readonly type: "user_left";
  readonly roomId: string;
  readonly userId: string;
  readonly userName: string;
};

/** Unread notification count pushed when inbox changes for the connected user. */
export type ServerNotificationCountEvent = {
  readonly type: "notification_count";
  readonly count: number;
};

// ── Moderation Server Events ──

/** Notification that a user has been timed out in a room. */
export type ServerUserTimedOutEvent = {
  readonly type: "user_timed_out";
  readonly roomId: string;
  readonly targetUserId: string;
  readonly targetUserName: string;
  readonly moderatorUserName: string;
  readonly durationSeconds: number;
  readonly expiresAt: string;
};

/** Notification that a user has been banned from a room. */
export type ServerUserBannedEvent = {
  readonly type: "user_banned";
  readonly roomId: string;
  readonly targetUserId: string;
  readonly targetUserName: string;
  readonly moderatorUserName: string;
};

/** Notification that a user has been unbanned from a room. */
export type ServerUserUnbannedEvent = {
  readonly type: "user_unbanned";
  readonly roomId: string;
  readonly targetUserId: string;
  readonly targetUserName: string;
  readonly moderatorUserName: string;
};

/** Notification that slow mode has changed for a room. */
export type ServerSlowModeChangedEvent = {
  readonly type: "slow_mode_changed";
  readonly roomId: string;
  readonly seconds: number;
  readonly moderatorUserName: string;
};

/** Notification sent only to the sender when their message is filtered. */
export type ServerMessageFilteredEvent = {
  readonly type: "message_filtered";
  readonly roomId: string;
};

/**
 * Sender-only event delivered after a successful room join, carrying the
 * authenticated user's moderation permission for that room. Drives the
 * client's moderator-gated UI (mod panel, per-message actions, mod-only
 * banners). Anonymous / logged-out joiners receive `isModerator: false`.
 */
export type ServerModeratorStatusEvent = {
  readonly type: "moderator_status";
  readonly roomId: string;
  readonly isModerator: boolean;
};

/**
 * Sender-only rehydration event emitted on room join after moderator_status.
 * Carries all sanction and slow-mode state needed to restore the client on
 * reconnect or room switch. Anonymous joiners receive false for all flags.
 */
export type ServerRoomStateEvent = {
  readonly type: "room_state";
  readonly roomId: string;
  /** Slow mode delay in seconds; 0 means disabled. */
  readonly slowModeSeconds: number;
  /** Whether the joining user is currently banned from this room. */
  readonly isBanned: boolean;
  /** Moderator username who issued the ban, or null if not banned. */
  readonly banModeratorUserName: string | null;
  /** Whether the joining user is currently timed out in this room. */
  readonly isTimedOut: boolean;
  /** ISO8601 expiry of the active timeout, or null if not timed out. */
  readonly timedOutUntil: string | null;
  /** Moderator username who issued the timeout, or null if not timed out. */
  readonly timeoutModeratorUserName: string | null;
};

// ── Reaction Server Events ──

/**
 * Reaction state for one emoji on one message, broadcast after any add/remove.
 * Sent to all room members. Each recipient checks reactedByMe using their own userId.
 */
export type ServerReactionUpdatedEvent = {
  readonly type: "reaction_updated";
  readonly roomId: string;
  readonly messageId: string;
  readonly emoji: ReactionEmoji;
  readonly count: number;
  readonly reactedByUserId: string | null; // userId who just acted, null on remove
  readonly userIds: readonly string[]; // all userIds who have reacted with this emoji
};

/**
 * Batch of reaction states for all messages in the initial history load.
 * Sent immediately after the `history` event on room join.
 * Only includes emojis with count > 0.
 */
export type ServerReactionsBatchEvent = {
  readonly type: "reactions_batch";
  readonly roomId: string;
  /** Map of messageId to array of per-emoji reaction state */
  readonly reactions: Record<string, readonly MessageReaction[]>;
};

/** Discriminated union of all server-to-client WebSocket events. */
export type ServerEvent =
  | ServerMessageEvent
  | ServerHistoryEvent
  | ServerRoomClosedEvent
  | ServerErrorEvent
  | ServerPresenceEvent
  | ServerUserJoinedEvent
  | ServerUserLeftEvent
  | ServerNotificationCountEvent
  | ServerUserTimedOutEvent
  | ServerUserBannedEvent
  | ServerUserUnbannedEvent
  | ServerSlowModeChangedEvent
  | ServerMessageFilteredEvent
  | ServerModeratorStatusEvent
  | ServerRoomStateEvent
  | ServerReactionUpdatedEvent
  | ServerReactionsBatchEvent;

// ── Chat History Request (REST) ──

export const ChatHistoryQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>;

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
  hasMore: z.boolean(),
});

export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;

// ── Active Rooms Response (REST) ──

export const ActiveRoomsResponseSchema = z.object({
  rooms: z.array(ChatRoomSchema),
});

export type ActiveRoomsResponse = z.infer<typeof ActiveRoomsResponseSchema>;
