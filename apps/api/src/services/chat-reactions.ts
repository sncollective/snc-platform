import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { ok, err } from "@snc/shared";
import type { Result, ReactionEmoji, MessageReaction, AppError } from "@snc/shared";
import { NotFoundError, ForbiddenError } from "@snc/shared";

import { db } from "../db/connection.js";
import { chatRooms, chatMessages, chatMessageReactions } from "../db/schema/chat.schema.js";
import { isUserBanned } from "./chat-moderation-auth.js";

// ── Private Helpers ──

/** Build the per-emoji reaction state for a message from raw reaction rows. */
const toMessageReaction = (
  emoji: ReactionEmoji,
  rows: Array<{ userId: string }>,
  currentUserId: string | null,
): MessageReaction => ({
  emoji,
  count: rows.length,
  reactedByMe: currentUserId !== null && rows.some((r) => r.userId === currentUserId),
});

// ── Public API ──

/**
 * Add an emoji reaction to a message. Idempotent — if the reaction already exists,
 * returns the current count without error.
 *
 * @returns ok with updated reaction state for the emoji, or err if preconditions fail.
 */
export const addReaction = async (opts: {
  messageId: string;
  roomId: string;
  userId: string;
  emoji: ReactionEmoji;
}): Promise<Result<{ count: number; userIds: string[] }, AppError>> => {
  // Verify room exists and is not closed
  const [room] = await db
    .select({ closedAt: chatRooms.closedAt })
    .from(chatRooms)
    .where(eq(chatRooms.id, opts.roomId));

  if (!room) return err(new NotFoundError("Chat room not found"));
  if (room.closedAt) return err(new ForbiddenError("Chat room is closed"));

  // Verify message exists and belongs to this room
  const [message] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, opts.messageId), eq(chatMessages.roomId, opts.roomId)));

  if (!message) return err(new NotFoundError("Message not found"));

  // Check if user is banned
  const banned = await isUserBanned(opts.userId, opts.roomId);
  if (banned) return err(new ForbiddenError("You are banned from this room"));

  // Insert, ignoring duplicate (already reacted)
  await db
    .insert(chatMessageReactions)
    .values({
      id: randomUUID(),
      messageId: opts.messageId,
      roomId: opts.roomId,
      userId: opts.userId,
      emoji: opts.emoji,
    })
    .onConflictDoNothing();

  // Fetch current state for this emoji
  const rows = await db
    .select({ userId: chatMessageReactions.userId })
    .from(chatMessageReactions)
    .where(
      and(
        eq(chatMessageReactions.messageId, opts.messageId),
        eq(chatMessageReactions.emoji, opts.emoji),
      ),
    );

  return ok({ count: rows.length, userIds: rows.map((r) => r.userId) });
};

/**
 * Remove an emoji reaction from a message. Idempotent — if the reaction does not
 * exist, returns the current count without error.
 *
 * @returns ok with updated reaction state for the emoji, or err if preconditions fail.
 */
export const removeReaction = async (opts: {
  messageId: string;
  roomId: string;
  userId: string;
  emoji: ReactionEmoji;
}): Promise<Result<{ count: number; userIds: string[] }, AppError>> => {
  // Verify room exists (no closed check — users can un-react in closed rooms)
  const [room] = await db
    .select({ id: chatRooms.id })
    .from(chatRooms)
    .where(eq(chatRooms.id, opts.roomId));

  if (!room) return err(new NotFoundError("Chat room not found"));

  await db
    .delete(chatMessageReactions)
    .where(
      and(
        eq(chatMessageReactions.messageId, opts.messageId),
        eq(chatMessageReactions.userId, opts.userId),
        eq(chatMessageReactions.emoji, opts.emoji),
      ),
    );

  const rows = await db
    .select({ userId: chatMessageReactions.userId })
    .from(chatMessageReactions)
    .where(
      and(
        eq(chatMessageReactions.messageId, opts.messageId),
        eq(chatMessageReactions.emoji, opts.emoji),
      ),
    );

  return ok({ count: rows.length, userIds: rows.map((r) => r.userId) });
};

/**
 * Get all reactions for a single message, shaped as per-emoji state.
 * Used by the REST lazy-load endpoint.
 */
export const getReactionsForMessage = async (
  messageId: string,
  currentUserId: string | null,
): Promise<Result<MessageReaction[], AppError>> => {
  const rows = await db
    .select({ emoji: chatMessageReactions.emoji, userId: chatMessageReactions.userId })
    .from(chatMessageReactions)
    .where(eq(chatMessageReactions.messageId, messageId));

  // Group by emoji
  const grouped = new Map<ReactionEmoji, Array<{ userId: string }>>();
  for (const row of rows) {
    const key = row.emoji as ReactionEmoji;
    const existing = grouped.get(key) ?? [];
    existing.push({ userId: row.userId });
    grouped.set(key, existing);
  }

  const reactions: MessageReaction[] = [];
  for (const [emoji, emojiRows] of grouped) {
    reactions.push(toMessageReaction(emoji, emojiRows, currentUserId));
  }

  return ok(reactions);
};

/**
 * Get reactions for a batch of messages (used for reactions_batch on room join).
 * Returns a map of messageId to per-emoji reaction states (only emojis with count > 0).
 */
export const getReactionsBatch = async (
  messageIds: string[],
  currentUserId: string | null,
): Promise<Result<Record<string, MessageReaction[]>, AppError>> => {
  if (messageIds.length === 0) return ok({});

  const rows = await db
    .select({
      messageId: chatMessageReactions.messageId,
      emoji: chatMessageReactions.emoji,
      userId: chatMessageReactions.userId,
    })
    .from(chatMessageReactions)
    .where(inArray(chatMessageReactions.messageId, messageIds));

  // Group by messageId then emoji
  const byMessage = new Map<string, Map<ReactionEmoji, Array<{ userId: string }>>>();
  for (const row of rows) {
    const msgMap = byMessage.get(row.messageId) ?? new Map();
    const key = row.emoji as ReactionEmoji;
    const existing = msgMap.get(key) ?? [];
    existing.push({ userId: row.userId });
    msgMap.set(key, existing);
    byMessage.set(row.messageId, msgMap);
  }

  const result: Record<string, MessageReaction[]> = {};
  for (const [messageId, emojiMap] of byMessage) {
    result[messageId] = [];
    for (const [emoji, emojiRows] of emojiMap) {
      result[messageId]!.push(toMessageReaction(emoji, emojiRows, currentUserId));
    }
  }

  return ok(result);
};
