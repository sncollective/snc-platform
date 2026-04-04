import { and, eq, desc } from "drizzle-orm";

import { ok, err, ForbiddenError } from "@snc/shared";
import type { Result, AppError } from "@snc/shared";

import { db } from "../db/connection.js";
import { chatRooms, chatModerationActions } from "../db/schema/chat.schema.js";
import { userRoles } from "../db/schema/user.schema.js";
import { creatorMembers } from "../db/schema/creator.schema.js";
import { channels } from "../db/schema/streaming.schema.js";

/**
 * Check whether a user can moderate a given chat room.
 *
 * Platform rooms: user must have the "admin" role in `user_roles`.
 * Channel rooms: user must have "admin" role OR be the "owner" of the
 * channel's creator profile in `creator_members`.
 *
 * @returns ok(true) if authorized, err(ForbiddenError) otherwise.
 */
export const canModerateRoom = async (
  userId: string,
  roomId: string,
): Promise<Result<true, AppError>> => {
  const [room] = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, roomId));

  if (!room) {
    return err(new ForbiddenError("Room not found"));
  }

  // Check if user is a platform admin
  const [adminRole] = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "admin")));

  if (adminRole) {
    return ok(true);
  }

  // For channel rooms, also check creator owner role
  if (room.type === "channel" && room.channelId) {
    const [channel] = await db
      .select({ creatorId: channels.creatorId })
      .from(channels)
      .where(eq(channels.id, room.channelId));

    if (channel?.creatorId) {
      const [ownerMember] = await db
        .select()
        .from(creatorMembers)
        .where(
          and(
            eq(creatorMembers.userId, userId),
            eq(creatorMembers.creatorId, channel.creatorId),
            eq(creatorMembers.role, "owner"),
          ),
        );

      if (ownerMember) {
        return ok(true);
      }
    }
  }

  return err(new ForbiddenError("You do not have moderation authority for this room"));
};

/**
 * Check whether a user is currently banned from a room.
 * A user is banned if their most recent ban/unban action is "ban".
 */
export const isUserBanned = async (
  userId: string,
  roomId: string,
): Promise<boolean> => {
  // Fetch all ban/unban actions for this user in this room, newest first
  const rows = await db
    .select({
      action: chatModerationActions.action,
    })
    .from(chatModerationActions)
    .where(
      and(
        eq(chatModerationActions.targetUserId, userId),
        eq(chatModerationActions.roomId, roomId),
      ),
    )
    .orderBy(desc(chatModerationActions.createdAt));

  // Find the most recent ban or unban action
  const lastBanOrUnban = rows.find(
    (r) => r.action === "ban" || r.action === "unban",
  );

  return lastBanOrUnban?.action === "ban";
};

/**
 * Check whether a user is currently timed out in a room.
 * A user is timed out if they have a "timeout" action with expiresAt > now().
 */
export const isUserTimedOut = async (
  userId: string,
  roomId: string,
): Promise<{ timedOut: boolean; expiresAt: string | null }> => {
  const now = new Date();

  const rows = await db
    .select({
      action: chatModerationActions.action,
      expiresAt: chatModerationActions.expiresAt,
    })
    .from(chatModerationActions)
    .where(
      and(
        eq(chatModerationActions.targetUserId, userId),
        eq(chatModerationActions.roomId, roomId),
        eq(chatModerationActions.action, "timeout"),
      ),
    )
    .orderBy(desc(chatModerationActions.createdAt))
    .limit(1);

  const latest = rows[0];
  if (!latest?.expiresAt) return { timedOut: false, expiresAt: null };

  if (latest.expiresAt > now) {
    return { timedOut: true, expiresAt: latest.expiresAt.toISOString() };
  }

  return { timedOut: false, expiresAt: null };
};
