import { and, eq, or, gt } from "drizzle-orm";

import { NotFoundError } from "@snc/shared";
import type { ContentResponse, Visibility } from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorMembers } from "../db/schema/creator.schema.js";
import {
  userSubscriptions,
  subscriptionPlans,
} from "../db/schema/subscription.schema.js";
import { getUserRoles } from "../auth/user-roles.js";
import { checkCreatorPermission } from "./creator-team.js";

// ── Private Helpers ──

/**
 * Drizzle SQL condition for "subscription is effectively active":
 * status = "active" OR (status = "canceled" AND currentPeriodEnd > now).
 */
const buildSubscriptionStatusCondition = (now: Date) =>
  or(
    eq(userSubscriptions.status, "active"),
    and(
      eq(userSubscriptions.status, "canceled"),
      gt(userSubscriptions.currentPeriodEnd, now),
    ),
  );

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
 * 3. User is a stakeholder or any creator team member → allowed (free perk)
 * 4. User has an active subscription that covers this creator → allowed
 * 5. Otherwise → not allowed (SUBSCRIPTION_REQUIRED)
 *
 * "Active subscription" means:
 * - status = "active" (or "canceled" if currentPeriodEnd is still in the future)
 * - AND the plan is either platform-wide OR creator-specific matching the
 *   content's creator
 */
// ── Batch Access (for feed gating without N+1 queries) ──

export type ContentAccessContext = {
  readonly userId: string | null;
  readonly roles: string[];
  readonly memberCreatorIds: Set<string>;
  readonly subscribedCreatorIds: Set<string>;
  readonly hasPlatformSubscription: boolean;
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
      memberCreatorIds: new Set(),
      subscribedCreatorIds: new Set(),
      hasPlatformSubscription: false,
    };
  }

  const roles = prefetchedRoles ?? (await getUserRoles(userId));

  const now = new Date();

  // Stakeholders and creator team members get free access — query memberships
  const memberRows = await db
    .select({ creatorId: creatorMembers.creatorId })
    .from(creatorMembers)
    .where(eq(creatorMembers.userId, userId));
  const memberCreatorIds = new Set(memberRows.map((r) => r.creatorId));

  // Stakeholders and creator team members get free access to all content
  if (roles.includes("stakeholder") || memberCreatorIds.size > 0) {
    return {
      userId,
      roles,
      memberCreatorIds,
      subscribedCreatorIds: new Set(),
      hasPlatformSubscription: true,
    };
  }

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
        buildSubscriptionStatusCondition(now),
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

  return { userId, roles, memberCreatorIds, subscribedCreatorIds, hasPlatformSubscription };
};

/**
 * Synchronous per-item access check using a pre-built context.
 * Applies the same 5 priority rules as `checkContentAccess`.
 */
export const hasContentAccess = (
  ctx: ContentAccessContext,
  contentCreatorId: string,
  contentVisibility: Visibility,
): boolean => {
  if (contentVisibility === "public") return true;
  if (ctx.userId === null) return false;
  if (ctx.memberCreatorIds.has(contentCreatorId)) return true;
  if (ctx.roles.includes("stakeholder")) return true;
  if (ctx.hasPlatformSubscription) return true;
  if (ctx.subscribedCreatorIds.has(contentCreatorId)) return true;
  return false;
};

// ── Per-Item Access (for detail endpoints) ──

/**
 * When `prefetchedRoles` is provided (e.g. from Hono context after
 * `requireAuth`), the `getUserRoles` DB query is skipped.
 *
 * Delegates to `buildContentAccessContext` + `hasContentAccess` to ensure
 * the 5-priority access rules have a single source of truth.
 */
export const checkContentAccess = async (
  userId: string | null,
  contentCreatorId: string,
  contentVisibility: Visibility,
  prefetchedRoles?: string[],
): Promise<ContentGateResult> => {
  if (contentVisibility === "public") return { allowed: true };
  if (userId === null) {
    return {
      allowed: false,
      reason: "AUTHENTICATION_REQUIRED",
      creatorId: contentCreatorId,
    };
  }

  const ctx = await buildContentAccessContext(userId, prefetchedRoles);
  if (hasContentAccess(ctx, contentCreatorId, contentVisibility)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "SUBSCRIPTION_REQUIRED",
    creatorId: contentCreatorId,
  };
};

// ── Domain Helpers ──

/**
 * Enforce draft visibility rules. Unpublished content is only visible to
 * admins and creator team members with `viewPrivate` permission (all team
 * roles: owner, editor, viewer). Stakeholders must be on the creator's team.
 *
 * When `prefetchedRoles` is provided (e.g. from Hono context after `optionalAuth`),
 * the `getUserRoles` DB query is skipped.
 */
export const requireDraftAccess = async (
  row: { publishedAt: Date | null; creatorId: string },
  userId: string | null,
  prefetchedRoles?: string[],
): Promise<void> => {
  if (row.publishedAt) return;
  if (!userId) throw new NotFoundError("Content not found");
  const roles = prefetchedRoles ?? (await getUserRoles(userId));
  if (roles.includes("admin")) return;
  const hasPermission = await checkCreatorPermission(
    userId,
    row.creatorId,
    "viewPrivate",
    roles,
  );
  if (!hasPermission) throw new NotFoundError("Content not found");
};

/**
 * Soft-gate subscriber content: nullify `mediaUrl` and `body` when access is denied.
 * Non-subscriber content passes through unmodified.
 *
 * When `prefetchedRoles` is provided, it is forwarded to `checkContentAccess`
 * to avoid a redundant `getUserRoles` query.
 */
export const applyContentGate = async (
  row: { creatorId: string; visibility: Visibility },
  userId: string | null,
  response: ContentResponse,
  prefetchedRoles?: string[],
): Promise<ContentResponse> => {
  if (row.visibility !== "subscribers") return response;
  const gate = await checkContentAccess(userId, row.creatorId, row.visibility, prefetchedRoles);
  if (!gate.allowed) {
    response.mediaUrl = null;
    response.body = null;
  }
  return response;
};
