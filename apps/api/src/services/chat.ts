import { randomUUID } from "node:crypto";

import { and, eq, isNull, lt, desc } from "drizzle-orm";
import { ok, err } from "@snc/shared";
import type { Result, ChatMessage, ChatRoom } from "@snc/shared";
import { AppError, NotFoundError, ForbiddenError } from "@snc/shared";

import { db } from "../db/connection.js";
import { chatRooms, chatMessages } from "../db/schema/chat.schema.js";

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
  content: row.content,
  createdAt: row.createdAt.toISOString(),
});

// ── Public API ──

/**
 * Ensure the platform chat room exists. Idempotent — creates on first call.
 * Called during server startup.
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

  // Strip HTML tags for XSS prevention
  const sanitizedContent = opts.content.replace(/<[^>]*>/g, "");

  const [message] = await db
    .insert(chatMessages)
    .values({
      id: randomUUID(),
      roomId: opts.roomId,
      userId: opts.userId,
      userName: opts.userName,
      avatarUrl: opts.avatarUrl,
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
