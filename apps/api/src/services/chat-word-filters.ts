import { randomUUID } from "node:crypto";

import { and, eq, count } from "drizzle-orm";

import { ok, err, NotFoundError, ConflictError, ValidationError } from "@snc/shared";
import type { Result, WordFilter, AppError } from "@snc/shared";
import { WORD_FILTER_MAX_PER_ROOM } from "@snc/shared";

import { db } from "../db/connection.js";
import { chatWordFilters } from "../db/schema/chat.schema.js";
import { canModerateRoom } from "./chat-moderation-auth.js";

// ── Private Helpers ──

const toWordFilterResponse = (
  row: typeof chatWordFilters.$inferSelect,
): WordFilter => ({
  id: row.id,
  roomId: row.roomId,
  pattern: row.pattern,
  isRegex: row.isRegex,
  createdAt: row.createdAt.toISOString(),
});

// ── Public API ──

/**
 * Add a word filter to a room. Enforces max 100 filters per room.
 *
 * @throws {ForbiddenError} If user lacks moderation authority.
 * @throws {ValidationError} If pattern is invalid regex (when isRegex=true).
 * @throws {ConflictError} If an identical pattern already exists for the room.
 */
export const addWordFilter = async (opts: {
  roomId: string;
  moderatorUserId: string;
  pattern: string;
  isRegex: boolean;
}): Promise<Result<WordFilter, AppError>> => {
  const authResult = await canModerateRoom(opts.moderatorUserId, opts.roomId);
  if (!authResult.ok) return authResult;

  // Validate regex pattern before storing
  if (opts.isRegex) {
    try {
      new RegExp(opts.pattern, "i");
    } catch {
      return err(new ValidationError(`Invalid regex pattern: ${opts.pattern}`));
    }
  }

  // Check for duplicate pattern
  const [existing] = await db
    .select()
    .from(chatWordFilters)
    .where(
      and(
        eq(chatWordFilters.roomId, opts.roomId),
        eq(chatWordFilters.pattern, opts.pattern),
      ),
    );

  if (existing) {
    return err(new ConflictError("This filter pattern already exists for this room"));
  }

  // Enforce max filter count
  const [countResult] = await db
    .select({ count: count() })
    .from(chatWordFilters)
    .where(eq(chatWordFilters.roomId, opts.roomId));

  if ((countResult?.count ?? 0) >= WORD_FILTER_MAX_PER_ROOM) {
    return err(
      new ValidationError(
        `Cannot exceed ${WORD_FILTER_MAX_PER_ROOM} filters per room`,
      ),
    );
  }

  const [created] = await db
    .insert(chatWordFilters)
    .values({
      id: randomUUID(),
      roomId: opts.roomId,
      pattern: opts.pattern,
      isRegex: opts.isRegex,
    })
    .returning();

  return ok(toWordFilterResponse(created!));
};

/**
 * Remove a word filter from a room by filter ID.
 *
 * @throws {ForbiddenError} If user lacks moderation authority.
 * @throws {NotFoundError} If filter does not exist.
 */
export const removeWordFilter = async (opts: {
  filterId: string;
  moderatorUserId: string;
}): Promise<Result<void, AppError>> => {
  const [filter] = await db
    .select()
    .from(chatWordFilters)
    .where(eq(chatWordFilters.id, opts.filterId));

  if (!filter) {
    return err(new NotFoundError("Word filter not found"));
  }

  const authResult = await canModerateRoom(opts.moderatorUserId, filter.roomId);
  if (!authResult.ok) return authResult;

  await db
    .delete(chatWordFilters)
    .where(eq(chatWordFilters.id, opts.filterId));

  return ok(undefined);
};

/**
 * List all word filters for a room.
 */
export const getWordFilters = async (
  roomId: string,
): Promise<Result<WordFilter[], AppError>> => {
  const rows = await db
    .select()
    .from(chatWordFilters)
    .where(eq(chatWordFilters.roomId, roomId));

  return ok(rows.map(toWordFilterResponse));
};

/**
 * Check message content against a room's word filters.
 * Returns true if the message should be blocked.
 *
 * Plain-text patterns use case-insensitive substring matching.
 * Regex patterns are compiled with case-insensitive flag.
 */
export const isMessageFiltered = async (
  roomId: string,
  content: string,
): Promise<boolean> => {
  const rows = await db
    .select()
    .from(chatWordFilters)
    .where(eq(chatWordFilters.roomId, roomId));

  for (const filter of rows) {
    if (filter.isRegex) {
      try {
        if (new RegExp(filter.pattern, "i").test(content)) {
          return true;
        }
      } catch {
        // Skip invalid regex — should not happen if validation is enforced at creation
      }
    } else {
      if (content.toLowerCase().includes(filter.pattern.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
};
