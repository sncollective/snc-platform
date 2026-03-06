import { and, eq, or, gt } from "drizzle-orm";

import { db } from "../db/connection.js";
import {
  userSubscriptions,
  subscriptionPlans,
} from "../db/schema/subscription.schema.js";
import { getUserRoles } from "../auth/user-roles.js";

// ── Public Types ──

export type ContentGateResult =
  | { allowed: true }
  | { allowed: false; reason: string; creatorId: string };

// ── Public API ──

/**
 * Check whether a user is allowed to access gated content from a specific
 * creator. Enforces subscription-based content gating with the following
 * rules:
 *
 * 1. Public content → always allowed
 * 2. No userId (unauthenticated) → not allowed
 * 3. User is the content creator → allowed (owner bypass)
 * 4. User holds the "creator" role → allowed (contributor member perk)
 * 5. User has an active subscription that covers this creator → allowed
 * 6. Otherwise → not allowed (SUBSCRIPTION_REQUIRED)
 *
 * "Active subscription" means:
 * - status = "active" (or "canceled" if currentPeriodEnd is still in the future)
 * - AND the plan is either platform-wide OR creator-specific matching the
 *   content's creator
 */
// ── Batch Access (for feed gating without N+1 queries) ──

export type ContentAccessContext = {
  userId: string | null;
  roles: string[];
  subscribedCreatorIds: Set<string>;
  hasPlatformSubscription: boolean;
};

/**
 * Pre-fetch everything needed to check access for multiple items.
 * Call once per request, then use `hasContentAccess()` per item.
 *
 * When `prefetchedRoles` is provided (e.g. from Hono context after
 * `requireAuth`), the `getUserRoles` DB query is skipped.
 */
export const buildContentAccessContext = async (
  userId: string | null,
  prefetchedRoles?: string[],
): Promise<ContentAccessContext> => {
  if (userId === null) {
    return {
      userId: null,
      roles: [],
      subscribedCreatorIds: new Set(),
      hasPlatformSubscription: false,
    };
  }

  const roles = prefetchedRoles ?? (await getUserRoles(userId));

  // Creators get free access to everything — skip subscription query
  if (roles.includes("creator")) {
    return {
      userId,
      roles,
      subscribedCreatorIds: new Set(),
      hasPlatformSubscription: true,
    };
  }

  const now = new Date();

  const rows = await db
    .select({
      planType: subscriptionPlans.type,
      planCreatorId: subscriptionPlans.creatorId,
    })
    .from(userSubscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(userSubscriptions.planId, subscriptionPlans.id),
    )
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        or(
          eq(userSubscriptions.status, "active"),
          and(
            eq(userSubscriptions.status, "canceled"),
            gt(userSubscriptions.currentPeriodEnd, now),
          ),
        ),
      ),
    );

  let hasPlatformSubscription = false;
  const subscribedCreatorIds = new Set<string>();

  for (const row of rows) {
    if (row.planType === "platform") {
      hasPlatformSubscription = true;
    } else if (row.planCreatorId) {
      subscribedCreatorIds.add(row.planCreatorId);
    }
  }

  return { userId, roles, subscribedCreatorIds, hasPlatformSubscription };
};

/**
 * Synchronous per-item access check using a pre-built context.
 * Applies the same 5 priority rules as `checkContentAccess`.
 */
export const hasContentAccess = (
  ctx: ContentAccessContext,
  contentCreatorId: string,
  contentVisibility: string,
): boolean => {
  if (contentVisibility === "public") return true;
  if (ctx.userId === null) return false;
  if (ctx.userId === contentCreatorId) return true;
  if (ctx.roles.includes("creator")) return true;
  if (ctx.hasPlatformSubscription) return true;
  if (ctx.subscribedCreatorIds.has(contentCreatorId)) return true;
  return false;
};

// ── Per-Item Access (for detail endpoints) ──

/**
 * When `prefetchedRoles` is provided (e.g. from Hono context after
 * `requireAuth`), the `getUserRoles` DB query is skipped.
 */
export const checkContentAccess = async (
  userId: string | null,
  contentCreatorId: string,
  contentVisibility: string,
  prefetchedRoles?: string[],
): Promise<ContentGateResult> => {
  // Rule 1: Public content is always accessible
  if (contentVisibility === "public") {
    return { allowed: true };
  }

  // Rule 2: Unauthenticated users cannot access gated content
  if (userId === null) {
    return {
      allowed: false,
      reason: "AUTHENTICATION_REQUIRED",
      creatorId: contentCreatorId,
    };
  }

  // Rule 3: Content creator always has access to their own content
  if (userId === contentCreatorId) {
    return { allowed: true };
  }

  // Rule 4: Creators (contributor members) get free access to all content
  const roles = prefetchedRoles ?? (await getUserRoles(userId));
  if (roles.includes("creator")) {
    return { allowed: true };
  }

  // Rule 5: Check for an active subscription covering this creator
  const now = new Date();

  const rows = await db
    .select({ id: userSubscriptions.id })
    .from(userSubscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(userSubscriptions.planId, subscriptionPlans.id),
    )
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        // Status must be "active", OR "canceled" with period not yet expired
        or(
          eq(userSubscriptions.status, "active"),
          and(
            eq(userSubscriptions.status, "canceled"),
            gt(userSubscriptions.currentPeriodEnd, now),
          ),
        ),
        // Plan must be platform-wide OR creator-specific for this creator
        or(
          eq(subscriptionPlans.type, "platform"),
          and(
            eq(subscriptionPlans.type, "creator"),
            eq(subscriptionPlans.creatorId, contentCreatorId),
          ),
        ),
      ),
    )
    .limit(1);

  if (rows.length > 0) {
    return { allowed: true };
  }

  // Rule 6: No matching subscription found
  return {
    allowed: false,
    reason: "SUBSCRIPTION_REQUIRED",
    creatorId: contentCreatorId,
  };
};
