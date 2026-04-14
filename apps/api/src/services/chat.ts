import { randomUUID } from "node:crypto";

import { and, eq, isNull, lt, desc } from "drizzle-orm";
import { ok, err } from "@snc/shared";
import type { Result, ChatMessage, ChatRoom, BadgeType } from "@snc/shared";
import { AppError, NotFoundError, ForbiddenError, RateLimitError } from "@snc/shared";

import { db } from "../db/connection.js";
import { chatRooms, chatMessages } from "../db/schema/chat.schema.js";
import { isUserBanned, isUserTimedOut, canModerateRoom } from "./chat-moderation-auth.js";
import { isMessageFiltered } from "./chat-word-filters.js";
import { channels } from "../db/schema/streaming.schema.js";
import {
  userSubscriptions,
  subscriptionPlans,
} from "../db/schema/subscription.schema.js";

// ── Constants ──

const PLATFORM_ROOM_NAME = "Community";
const MAX_MESSAGE_LENGTH = 500;
const DEFAULT_HISTORY_LIMIT = 50;

// ── Private Helpers ──

const toRoomResponse = (row: typeof chatRooms.$inferSelect): ChatRoom => ({
  id: row.id,
  type: row.type as ChatRoom["type"],
  channelId: row.channelId,
  name: row.name,
  slowModeSeconds: row.slowModeSeconds,
  createdAt: row.createdAt.toISOString(),
  closedAt: row.closedAt?.toISOString() ?? null,
});

const toMessageResponse = (
  row: typeof chatMessages.$inferSelect,
): ChatMessage => ({
  id: row.id,
  roomId: row.roomId,
  userId: row.userId,
  userName: row.userName,
  avatarUrl: row.avatarUrl,
  badges: (row.badges ?? []) as BadgeType[],
  content: row.content,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Resolve patron badges for a user in a given chat room.
 *
 * Checks active subscriptions against the room context:
 * - `platform` badge if the user has any active platform subscription
 * - `creator` badge if the room is a channel room and the user subscribes to that channel's creator
 */
const resolveUserBadges = async (
  userId: string,
  room: { channelId: string | null },
): Promise<BadgeType[]> => {
  const activeSubs = await db
    .select({
      planType: subscriptionPlans.type,
      creatorId: subscriptionPlans.creatorId,
    })
    .from(userSubscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(userSubscriptions.planId, subscriptionPlans.id),
    )
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active"),
      ),
    );

  const badges: BadgeType[] = [];

  if (activeSubs.some((s) => s.planType === "platform")) {
    badges.push("platform");
  }

  if (room.channelId) {
    const [channel] = await db
      .select({ creatorId: channels.creatorId })
      .from(channels)
      .where(eq(channels.id, room.channelId));

    if (channel?.creatorId) {
      const hasCreatorSub = activeSubs.some(
        (s) => s.planType === "creator" && s.creatorId === channel.creatorId,
      );
      if (hasCreatorSub) {
        badges.push("creator");
      }
    }
  }

  return badges;
};

/**
 * Enforce slow mode for a user in a room.
 * Queries the most recent message by the user and checks if enough time has elapsed.
 *
 * @returns ok(undefined) if the user may send, err(RateLimitError) if they must wait.
 */
const checkSlowMode = async (
  roomId: string,
  userId: string,
  slowModeSeconds: number,
): Promise<Result<void, AppError>> => {
  if (slowModeSeconds <= 0) return ok(undefined);

  const [lastMessage] = await db
    .select({ createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.roomId, roomId),
        eq(chatMessages.userId, userId),
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(1);

  if (!lastMessage) return ok(undefined);

  const elapsed = (Date.now() - lastMessage.createdAt.getTime()) / 1000;
  if (elapsed < slowModeSeconds) {
    const waitSeconds = Math.ceil(slowModeSeconds - elapsed);
    return err(new RateLimitError(`Slow mode: please wait ${waitSeconds}s before sending again`));
  }

  return ok(undefined);
};

// ── Public API ──

/**
 * Ensure the platform chat room exists. Idempotent — creates on first call.
 * Called during server startup.
 *
 * @throws {AppError} On database failure.
 */
export const ensurePlatformRoom = async (): Promise<ChatRoom> => {
  const [existing] = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.type, "platform"));

  if (existing) return toRoomResponse(existing);

  const [created] = await db
    .insert(chatRooms)
    .values({
      id: randomUUID(),
      type: "platform",
      name: PLATFORM_ROOM_NAME,
    })
    .returning();

  return toRoomResponse(created!);
};

/**
 * Create a chat room linked to a channel.
 * Called from the on_publish callback after creating a live channel.
 *
 * @throws {AppError} On database failure.
 */
export const createChannelRoom = async (
  channelId: string,
  name: string,
): Promise<ChatRoom> => {
  const [created] = await db
    .insert(chatRooms)
    .values({
      id: randomUUID(),
      type: "channel",
      channelId,
      name,
    })
    .returning();

  return toRoomResponse(created!);
};

/**
 * Close a channel's chat room. Sets closedAt timestamp.
 * Called from the on_unpublish callback after deactivating a channel.
 *
 * @throws {AppError} On database failure.
 */
export const closeChannelRoom = async (channelId: string): Promise<void> => {
  await db
    .update(chatRooms)
    .set({ closedAt: new Date() })
    .where(
      and(eq(chatRooms.channelId, channelId), isNull(chatRooms.closedAt)),
    );
};

/**
 * Ensure a channel has a chat room. Idempotent.
 * Called lazily when a viewer first joins a playout channel.
 *
 * @throws {AppError} On database failure.
 */
export const ensureChannelRoom = async (
  channelId: string,
  channelName: string,
): Promise<ChatRoom> => {
  const [existing] = await db
    .select()
    .from(chatRooms)
    .where(and(eq(chatRooms.channelId, channelId), isNull(chatRooms.closedAt)));

  if (existing) return toRoomResponse(existing);

  return createChannelRoom(channelId, channelName);
};

/**
 * Get all active (non-closed) rooms. Returns platform room + any open stream rooms.
 */
export const getActiveRooms = async (): Promise<ChatRoom[]> => {
  const rows = await db
    .select()
    .from(chatRooms)
    .where(isNull(chatRooms.closedAt));

  return rows.map(toRoomResponse);
};

/**
 * Create and persist a chat message. Returns the formatted message for broadcast.
 */
export const createMessage = async (opts: {
  roomId: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
}): Promise<Result<ChatMessage, AppError>> => {
  if (opts.content.length > MAX_MESSAGE_LENGTH) {
    return err(new AppError("MESSAGE_TOO_LONG", `Max ${MAX_MESSAGE_LENGTH} characters`, 400));
  }

  // Verify room exists and is not closed
  const [room] = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, opts.roomId));

  if (!room) {
    return err(new NotFoundError("Chat room not found"));
  }

  if (room.closedAt) {
    return err(new ForbiddenError("Chat room is closed"));
  }

  // Check if user is banned
  const banned = await isUserBanned(opts.userId, opts.roomId);
  if (banned) {
    return err(new ForbiddenError("You are banned from this room"));
  }

  // Check if user is timed out
  const { timedOut, expiresAt } = await isUserTimedOut(opts.userId, opts.roomId);
  if (timedOut) {
    return err(new ForbiddenError(`You are timed out until ${expiresAt}`));
  }

  // Check moderation authority — moderators are exempt from slow mode and word filters
  const modResult = await canModerateRoom(opts.userId, opts.roomId);
  const isModerator = modResult.ok;

  if (!isModerator) {
    // Enforce slow mode
    const slowModeResult = await checkSlowMode(opts.roomId, opts.userId, room.slowModeSeconds);
    if (!slowModeResult.ok) {
      return err(slowModeResult.error);
    }

    // Check word filters
    const filtered = await isMessageFiltered(opts.roomId, opts.content);
    if (filtered) {
      return err(new AppError("MESSAGE_FILTERED", "Message blocked by word filter", 400));
    }
  }

  // Strip HTML tags for XSS prevention
  const sanitizedContent = opts.content.replace(/<[^>]*>/g, "");

  // Resolve badges from subscription status — failure must not block message send
  let badges: BadgeType[] = [];
  try {
    badges = await resolveUserBadges(opts.userId, room);
  } catch {
    // Badge resolution failure should not block message send
  }

  const [message] = await db
    .insert(chatMessages)
    .values({
      id: randomUUID(),
      roomId: opts.roomId,
      userId: opts.userId,
      userName: opts.userName,
      avatarUrl: opts.avatarUrl,
      badges,
      content: sanitizedContent,
    })
    .returning();

  return ok(toMessageResponse(message!));
};

/**
 * Get message history for a room, paginated by cursor (before timestamp).
 */
export const getMessageHistory = async (opts: {
  roomId: string;
  before?: string;
  limit?: number;
}): Promise<Result<{ messages: ChatMessage[]; hasMore: boolean }, AppError>> => {
  const limit = opts.limit ?? DEFAULT_HISTORY_LIMIT;

  const conditions = [eq(chatMessages.roomId, opts.roomId)];
  if (opts.before) {
    conditions.push(lt(chatMessages.createdAt, new Date(opts.before)));
  }

  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map(toMessageResponse);

  return ok({ messages, hasMore });
};
