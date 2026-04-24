import { randomUUID, createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { AppError, ForbiddenError, NotFoundError, ok, err } from "@snc/shared";
import type { Result, StreamKeyResponse, StreamKeyCreatedResponse } from "@snc/shared";

import { db } from "../db/connection.js";
import { streamKeys } from "../db/schema/streaming.schema.js";
import { checkCreatorPermission } from "./creator-team.js";

// ── Private Helpers ──

const hashKey = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

const generateStreamKey = (): string => {
  const raw = randomUUID().replace(/-/g, "");
  return `sk_${raw}`;
};

const toKeyResponse = (row: typeof streamKeys.$inferSelect): StreamKeyResponse => ({
  id: row.id,
  name: row.name,
  keyPrefix: row.keyPrefix,
  createdAt: row.createdAt.toISOString(),
  revokedAt: row.revokedAt?.toISOString() ?? null,
});

/**
 * Gate stream-key management on the `manageStreaming` permission.
 * Grants: creator owners; platform admins (admin role bypass inside checkCreatorPermission).
 */
const requireStreamKeyAccess = async (
  userId: string,
  creatorId: string,
  userRoles: string[] | undefined,
): Promise<Result<void, AppError>> => {
  const allowed = await checkCreatorPermission(userId, creatorId, "manageStreaming", userRoles);
  if (!allowed) {
    return err(new ForbiddenError("Only creator owners or platform admins can manage stream keys"));
  }
  return ok(undefined);
};

// ── Public API ──

/**
 * Create a named stream key for a creator.
 * Returns the raw key once — it is never stored or retrievable after this.
 */
export const createStreamKey = async (
  userId: string,
  creatorId: string,
  name: string,
  userRoles?: string[],
): Promise<Result<StreamKeyCreatedResponse, AppError>> => {
  const access = await requireStreamKeyAccess(userId, creatorId, userRoles);
  if (!access.ok) return access;

  const rawKey = generateStreamKey();
  const id = randomUUID();

  const [inserted] = await db
    .insert(streamKeys)
    .values({
      id,
      creatorId,
      name,
      keyHash: hashKey(rawKey),
      keyPrefix: rawKey.slice(0, 11),
    })
    .returning();

  return ok({
    ...toKeyResponse(inserted!),
    rawKey,
  });
};

/**
 * List all stream keys for a creator (active and revoked).
 */
export const listStreamKeys = async (
  userId: string,
  creatorId: string,
  userRoles?: string[],
): Promise<Result<StreamKeyResponse[], AppError>> => {
  const access = await requireStreamKeyAccess(userId, creatorId, userRoles);
  if (!access.ok) return access;

  const rows = await db
    .select()
    .from(streamKeys)
    .where(eq(streamKeys.creatorId, creatorId));

  return ok(rows.map(toKeyResponse));
};

/**
 * Revoke a stream key. Sets `revokedAt` — does not delete.
 * Active sessions using this key continue (SRS doesn't re-auth mid-stream).
 */
export const revokeStreamKey = async (
  userId: string,
  creatorId: string,
  keyId: string,
  userRoles?: string[],
): Promise<Result<StreamKeyResponse, AppError>> => {
  const access = await requireStreamKeyAccess(userId, creatorId, userRoles);
  if (!access.ok) return access;

  const [existing] = await db
    .select()
    .from(streamKeys)
    .where(and(eq(streamKeys.id, keyId), eq(streamKeys.creatorId, creatorId)));

  if (!existing) {
    return err(new NotFoundError("Stream key not found"));
  }

  if (existing.revokedAt) {
    return ok(toKeyResponse(existing));
  }

  const [updated] = await db
    .update(streamKeys)
    .set({ revokedAt: new Date() })
    .where(eq(streamKeys.id, keyId))
    .returning();

  return ok(toKeyResponse(updated!));
};

/**
 * Look up a creator by stream key hash.
 * Used by the on_publish callback to identify the publisher.
 * Returns null if no active key matches.
 */
export const lookupCreatorByKeyHash = async (
  keyHash: string,
): Promise<{ creatorId: string; keyId: string } | null> => {
  const [row] = await db
    .select({ creatorId: streamKeys.creatorId, id: streamKeys.id })
    .from(streamKeys)
    .where(and(eq(streamKeys.keyHash, keyHash), isNull(streamKeys.revokedAt)));

  return row ? { creatorId: row.creatorId, keyId: row.id } : null;
};
