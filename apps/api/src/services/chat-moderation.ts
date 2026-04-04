import { randomUUID } from "node:crypto";

import { and, eq, desc, lt, gt } from "drizzle-orm";

import { ok, err, NotFoundError, ForbiddenError } from "@snc/shared";
import type { Result, ModerationAction, AppError } from "@snc/shared";

import { db } from "../db/connection.js";
import { chatRooms, chatModerationActions } from "../db/schema/chat.schema.js";
import { users } from "../db/schema/user.schema.js";
import { canModerateRoom, isUserBanned } from "./chat-moderation-auth.js";

// ── Constants ──

const DEFAULT_HISTORY_LIMIT = 50;

// ── Private Helpers ──

const toModerationActionResponse = (
  row: typeof chatModerationActions.$inferSelect,
): ModerationAction => ({
  id: row.id,
  roomId: row.roomId,
  targetUserId: row.targetUserId,
  targetUserName: row.targetUserName,
  moderatorUserId: row.moderatorUserId,
  moderatorUserName: row.moderatorUserName,
  action: row.action as ModerationAction["action"],
  durationSeconds: row.durationSeconds,
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt?.toISOString() ?? null,
});

// ── Public API ──

/**
 * Time out a user in a room. Creates an audit record and returns the action.
 *
 * @throws {ForbiddenError} If moderator lacks authority or attempts to timeout themselves.
 */
export const timeoutUser = async (opts: {
  roomId: string;
  targetUserId: string;
  moderatorUserId: string;
  moderatorUserName: string;
  durationSeconds: number;
  reason?: string;
}): Promise<Result<ModerationAction, AppError>> => {
  if (opts.targetUserId === opts.moderatorUserId) {
    return err(new ForbiddenError("You cannot timeout yourself"));
  }

  const authResult = await canModerateRoom(opts.moderatorUserId, opts.roomId);
  if (!authResult.ok) return authResult;

  // Resolve target user name
  const [targetUser] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, opts.targetUserId));

  if (!targetUser) {
    return err(new NotFoundError("Target user not found"));
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + opts.durationSeconds * 1000);

  const [created] = await db
    .insert(chatModerationActions)
    .values({
      id: randomUUID(),
      roomId: opts.roomId,
      targetUserId: opts.targetUserId,
      targetUserName: targetUser.name,
      moderatorUserId: opts.moderatorUserId,
      moderatorUserName: opts.moderatorUserName,
      action: "timeout",
      durationSeconds: opts.durationSeconds,
      reason: opts.reason ?? null,
      expiresAt,
    })
    .returning();

  return ok(toModerationActionResponse(created!));
};

/**
 * Ban a user from a room. Creates an audit record and returns the action.
 * Idempotent — returns existing active ban if the user is already banned.
 *
 * @throws {ForbiddenError} If moderator lacks authority or attempts to ban themselves.
 */
export const banUser = async (opts: {
  roomId: string;
  targetUserId: string;
  moderatorUserId: string;
  moderatorUserName: string;
  reason?: string;
}): Promise<Result<ModerationAction, AppError>> => {
  if (opts.targetUserId === opts.moderatorUserId) {
    return err(new ForbiddenError("You cannot ban yourself"));
  }

  const authResult = await canModerateRoom(opts.moderatorUserId, opts.roomId);
  if (!authResult.ok) return authResult;

  // Check if already banned — return existing ban action if so
  const alreadyBanned = await isUserBanned(opts.targetUserId, opts.roomId);
  if (alreadyBanned) {
    const [existingBan] = await db
      .select()
      .from(chatModerationActions)
      .where(
        and(
          eq(chatModerationActions.targetUserId, opts.targetUserId),
          eq(chatModerationActions.roomId, opts.roomId),
          eq(chatModerationActions.action, "ban"),
        ),
      )
      .orderBy(desc(chatModerationActions.createdAt))
      .limit(1);

    if (existingBan) {
      return ok(toModerationActionResponse(existingBan));
    }
  }

  // Resolve target user name
  const [targetUser] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, opts.targetUserId));

  if (!targetUser) {
    return err(new NotFoundError("Target user not found"));
  }

  const [created] = await db
    .insert(chatModerationActions)
    .values({
      id: randomUUID(),
      roomId: opts.roomId,
      targetUserId: opts.targetUserId,
      targetUserName: targetUser.name,
      moderatorUserId: opts.moderatorUserId,
      moderatorUserName: opts.moderatorUserName,
      action: "ban",
      durationSeconds: null,
      reason: opts.reason ?? null,
      expiresAt: null,
    })
    .returning();

  return ok(toModerationActionResponse(created!));
};

/**
 * Unban a user from a room. Creates an audit record and returns the action.
 *
 * @throws {ForbiddenError} If moderator lacks authority.
 * @throws {NotFoundError} If user is not currently banned.
 */
export const unbanUser = async (opts: {
  roomId: string;
  targetUserId: string;
  moderatorUserId: string;
  moderatorUserName: string;
}): Promise<Result<ModerationAction, AppError>> => {
  const authResult = await canModerateRoom(opts.moderatorUserId, opts.roomId);
  if (!authResult.ok) return authResult;

  const banned = await isUserBanned(opts.targetUserId, opts.roomId);
  if (!banned) {
    return err(new NotFoundError("User is not currently banned"));
  }

  // Resolve target user name
  const [targetUser] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, opts.targetUserId));

  if (!targetUser) {
    return err(new NotFoundError("Target user not found"));
  }

  const [created] = await db
    .insert(chatModerationActions)
    .values({
      id: randomUUID(),
      roomId: opts.roomId,
      targetUserId: opts.targetUserId,
      targetUserName: targetUser.name,
      moderatorUserId: opts.moderatorUserId,
      moderatorUserName: opts.moderatorUserName,
      action: "unban",
      durationSeconds: null,
      reason: null,
      expiresAt: null,
    })
    .returning();

  return ok(toModerationActionResponse(created!));
};

/**
 * Set slow mode for a room. Updates the room's slowModeSeconds column.
 * Pass 0 to disable.
 *
 * @throws {ForbiddenError} If moderator lacks authority.
 */
export const setSlowMode = async (opts: {
  roomId: string;
  moderatorUserId: string;
  seconds: number;
}): Promise<Result<{ seconds: number }, AppError>> => {
  const authResult = await canModerateRoom(opts.moderatorUserId, opts.roomId);
  if (!authResult.ok) return authResult;

  await db
    .update(chatRooms)
    .set({ slowModeSeconds: opts.seconds })
    .where(eq(chatRooms.id, opts.roomId));

  return ok({ seconds: opts.seconds });
};

/**
 * Get moderation action history for a room, cursor-paginated by createdAt.
 */
export const getModerationHistory = async (opts: {
  roomId: string;
  before?: string;
  limit?: number;
}): Promise<Result<{ actions: ModerationAction[]; hasMore: boolean }, AppError>> => {
  const limit = opts.limit ?? DEFAULT_HISTORY_LIMIT;

  const conditions = [eq(chatModerationActions.roomId, opts.roomId)];
  if (opts.before) {
    conditions.push(lt(chatModerationActions.createdAt, new Date(opts.before)));
  }

  const rows = await db
    .select()
    .from(chatModerationActions)
    .where(and(...conditions))
    .orderBy(desc(chatModerationActions.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const actions = rows.slice(0, limit).map(toModerationActionResponse);

  return ok({ actions, hasMore });
};

/**
 * Get active bans and timeouts for a room.
 * Returns all active bans (no subsequent unban) and active timeouts (expiresAt > now()).
 */
export const getActiveSanctions = async (
  roomId: string,
): Promise<Result<ModerationAction[], AppError>> => {
  const now = new Date();

  // Active timeouts: expiresAt > now
  const activeTimeouts = await db
    .select()
    .from(chatModerationActions)
    .where(
      and(
        eq(chatModerationActions.roomId, roomId),
        eq(chatModerationActions.action, "timeout"),
        gt(chatModerationActions.expiresAt, now),
      ),
    );

  // For active bans, we need all users' most recent ban/unban in this room
  // where the most recent is "ban"
  const allBanActions = await db
    .select()
    .from(chatModerationActions)
    .where(
      and(
        eq(chatModerationActions.roomId, roomId),
        eq(chatModerationActions.action, "ban"),
      ),
    )
    .orderBy(desc(chatModerationActions.createdAt));

  // For each banned user, check there's no subsequent unban
  const activeBans: (typeof chatModerationActions.$inferSelect)[] = [];
  const checkedUsers = new Set<string>();

  for (const banAction of allBanActions) {
    if (checkedUsers.has(banAction.targetUserId)) continue;
    checkedUsers.add(banAction.targetUserId);

    const [laterUnban] = await db
      .select()
      .from(chatModerationActions)
      .where(
        and(
          eq(chatModerationActions.roomId, roomId),
          eq(chatModerationActions.targetUserId, banAction.targetUserId),
          eq(chatModerationActions.action, "unban"),
          gt(chatModerationActions.createdAt, banAction.createdAt),
        ),
      )
      .limit(1);

    if (!laterUnban) {
      activeBans.push(banAction);
    }
  }

  const allActive = [...activeBans, ...activeTimeouts].map(
    toModerationActionResponse,
  );

  return ok(allActive);
};
