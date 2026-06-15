import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { ok, err, NotFoundError } from "@snc/shared";
import type { Result, AppError } from "@snc/shared";

import { db } from "../db/connection.js";
import {
  channelNotifySubscriptions,
} from "../db/schema/notification.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { consentLog } from "../db/schema/consent.schema.js";

// ── Public API ──

/**
 * Subscribe a user to a channel's go-live notification, recording consent.
 *
 * Idempotent: re-subscribing is a no-op on the subscription (PK conflict ignored), but
 * each capture appends a consent row (append-only log).
 *
 * @returns NotFoundError when the channel does not exist.
 */
export const subscribeToChannel = async (
  userId: string,
  channelId: string,
  policyVersion: string,
): Promise<Result<void, AppError>> => {
  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  if (!channel) return err(new NotFoundError("Channel not found"));

  await db
    .insert(channelNotifySubscriptions)
    .values({ userId, channelId })
    .onConflictDoNothing();

  await db.insert(consentLog).values({
    id: randomUUID(),
    userId,
    consentType: "email-contact",
    policyVersion,
    source: `notify:${channelId}`,
  });

  return ok(undefined);
};

/** Remove a user's go-live subscription for a channel. Idempotent. */
export const unsubscribeFromChannel = async (
  userId: string,
  channelId: string,
): Promise<Result<void, AppError>> => {
  await db
    .delete(channelNotifySubscriptions)
    .where(
      and(
        eq(channelNotifySubscriptions.userId, userId),
        eq(channelNotifySubscriptions.channelId, channelId),
      ),
    );
  return ok(undefined);
};
