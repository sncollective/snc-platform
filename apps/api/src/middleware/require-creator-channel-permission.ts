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
 * The channel role a creator editorial route operates on.
 *
 * Creator editorial channels are the single persistent `ownership='creator'` /
 * `role='live-ingest'` row provisioned by `ensureCreatorChannel` — that row is the
 * creator's Programming surface (queue + pool). The gate asserts this role
 * explicitly rather than accepting any creator-owned channel by omission: a
 * creator-owned channel of an unexpected role (a future creator role that should
 * not expose the editorial surface) is rejected with 404, so the editorial routes
 * never operate on a channel they were not designed for.
 *
 * Deliberately NOT `playout`: playout channels are platform-owned; requiring
 * `playout` here would reject every legitimate creator channel and break the
 * feature.
 */
const CREATOR_EDITORIAL_ROLE = "live-ingest";

/**
 * Middleware factory that guards a creator-channel route.
 *
 * Preconditions (must be chained after `requireAuth`):
 * - User is authenticated (reads `user` and `roles` from context).
 * - Route has a `:channelId` path parameter.
 *
 * Gate logic:
 * 1. Load the channel by `:channelId`.
 * 2. Assert `ownership === "creator"`, `creatorId != null`, and
 *    `role === "live-ingest"` (the creator editorial role) — any other channel
 *    responds with 404 to avoid leaking existence.
 * 3. Delegate to `requireCreatorPermission(userId, channel.creatorId, permission, roles)`,
 *    which throws `ForbiddenError` on denial and short-circuits on admin role.
 *
 * @param permission - The creator permission to check (e.g. `"manageStreaming"`).
 * @throws {NotFoundError} When the channel does not exist, is not creator-owned,
 *   or is not the creator editorial (`live-ingest`) role.
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
        role: channels.role,
      })
      .from(channels)
      .where(eq(channels.id, channelId));

    if (!channel) {
      throw new NotFoundError("Channel not found");
    }

    // The editorial surface accepts only the creator's persistent editorial
    // channel: creator-owned, with a creator id, of the live-ingest role. Anything
    // else (platform/broadcast ownership, a null creatorId, or a creator-owned
    // channel of an unexpected role) is treated as 404 on creator routes — avoids
    // leaking channel existence and stops the editorial methods from running
    // against a channel they were not designed for.
    if (
      channel.ownership !== "creator" ||
      !channel.creatorId ||
      channel.role !== CREATOR_EDITORIAL_ROLE
    ) {
      rootLogger.warn(
        {
          event: "creator_channel_authz_denial",
          userId: user.id,
          channelId,
          ownership: channel.ownership,
          role: channel.role,
          hasCreatorId: !!channel.creatorId,
        },
        "Creator channel route: channel is not a creator editorial channel",
      );
      throw new NotFoundError("Channel not found");
    }

    // Delegate to the shared permission service. Admin role bypasses automatically.
    await requireCreatorPermission(user.id, channel.creatorId, permission, roles);

    await next();
  };
};
