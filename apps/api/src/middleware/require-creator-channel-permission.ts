import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";

import { ForbiddenError, NotFoundError } from "@snc/shared";
import type { CreatorPermission } from "@snc/shared";

import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { rootLogger } from "../logging/logger.js";

import type { AuthEnv } from "./auth-env.js";

// ── Public API ──

/**
 * Middleware factory that guards a creator-channel route.
 *
 * Preconditions (must be chained after `requireAuth`):
 * - User is authenticated (reads `user` and `roles` from context).
 * - Route has a `:channelId` path parameter.
 *
 * Gate logic:
 * 1. Load the channel by `:channelId`.
 * 2. Assert `ownership === "creator"` and `creatorId != null` — non-creator-owned
 *    channels respond with 404 to avoid leaking existence.
 * 3. Delegate to `requireCreatorPermission(userId, channel.creatorId, permission, roles)`,
 *    which throws `ForbiddenError` on denial and short-circuits on admin role.
 *
 * @param permission - The creator permission to check (e.g. `"manageStreaming"`).
 * @throws {NotFoundError} When the channel does not exist or is not creator-owned.
 * @throws {ForbiddenError} When the user lacks the required creator permission.
 */
export const requireCreatorChannelPermission = (
  permission: CreatorPermission,
) => {
  return async (c: Context<AuthEnv>, next: Next): Promise<void> => {
    const user = c.get("user");
    const roles = c.get("roles");
    const channelId = c.req.param("channelId");

    if (!channelId) {
      throw new NotFoundError("Channel not found");
    }

    // Load channel — select only the fields needed for the gate
    const [channel] = await db
      .select({
        id: channels.id,
        ownership: channels.ownership,
        creatorId: channels.creatorId,
      })
      .from(channels)
      .where(eq(channels.id, channelId));

    if (!channel) {
      throw new NotFoundError("Channel not found");
    }

    // Non-creator-owned channels (platform ownership or null creatorId) are
    // treated as 404 on creator routes — avoids leaking channel existence to
    // users who should not know about admin/broadcast channels.
    if (channel.ownership !== "creator" || !channel.creatorId) {
      rootLogger.warn(
        {
          event: "creator_channel_authz_denial",
          userId: user.id,
          channelId,
          ownership: channel.ownership,
          hasCreatorId: !!channel.creatorId,
        },
        "Creator channel route: channel is not creator-owned",
      );
      throw new NotFoundError("Channel not found");
    }

    // Delegate to the shared permission service. Admin role bypasses automatically.
    await requireCreatorPermission(user.id, channel.creatorId, permission, roles);

    await next();
  };
};
