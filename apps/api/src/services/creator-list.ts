import { count, and, inArray, isNull, isNotNull, eq, sql } from "drizzle-orm";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { userSubscriptions, subscriptionPlans } from "../db/schema/subscription.schema.js";

// ── Batch KPI helpers for the creator list endpoint ──

/** Aggregate published content counts for a batch of creators, keyed by creator ID. */
export const batchGetContentCounts = async (
  creatorIds: string[],
): Promise<Map<string, number>> => {
  if (creatorIds.length === 0) return new Map();
  const rows = await db
    .select({ creatorId: content.creatorId, count: count() })
    .from(content)
    .where(
      and(
        inArray(content.creatorId, creatorIds),
        isNull(content.deletedAt),
        isNotNull(content.publishedAt),
      ),
    )
    .groupBy(content.creatorId);
  return new Map(rows.map((r) => [r.creatorId, r.count]));
};

/** Returns set of creatorIds the user is subscribed to (active platform OR active creator sub) */
export const batchGetSubscribedCreatorIds = async (
  userId: string,
  creatorIds: string[],
): Promise<Set<string>> => {
  if (creatorIds.length === 0) return new Set();

  // Check for active platform subscription (patron of all creators)
  const platformSub = await db
    .select({ id: userSubscriptions.id })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active"),
        eq(subscriptionPlans.type, "platform"),
      ),
    )
    .limit(1);

  if (platformSub.length > 0) {
    return new Set(creatorIds); // platform patron → subscribed to all
  }

  // Check for active creator-specific subscriptions
  const rows = await db
    .select({ creatorId: subscriptionPlans.creatorId })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active"),
        eq(subscriptionPlans.type, "creator"),
        inArray(subscriptionPlans.creatorId, creatorIds),
      ),
    );

  return new Set(rows.map((r) => r.creatorId).filter((id): id is string => id !== null));
};

/** Aggregate active subscriber counts for a batch of creators, keyed by creator ID. */
export const batchGetSubscriberCounts = async (
  creatorIds: string[],
): Promise<Map<string, number>> => {
  if (creatorIds.length === 0) return new Map();
  const rows = await db
    .select({
      creatorId: subscriptionPlans.creatorId,
      count: count(),
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(subscriptionPlans.type, "creator"),
        eq(userSubscriptions.status, "active"),
        inArray(subscriptionPlans.creatorId, creatorIds),
      ),
    )
    .groupBy(subscriptionPlans.creatorId);
  return new Map(
    rows
      .filter((r): r is typeof r & { creatorId: string } => r.creatorId !== null)
      .map((r) => [r.creatorId, r.count]),
  );
};

/** Aggregate most recent publish date for a batch of creators, keyed by creator ID (ISO string values). */
export const batchGetLastPublished = async (
  creatorIds: string[],
): Promise<Map<string, string>> => {
  if (creatorIds.length === 0) return new Map();
  const rows = await db
    .select({
      creatorId: content.creatorId,
      lastPublished: sql<string>`max(${content.publishedAt})`,
    })
    .from(content)
    .where(
      and(
        inArray(content.creatorId, creatorIds),
        isNull(content.deletedAt),
        isNotNull(content.publishedAt),
      ),
    )
    .groupBy(content.creatorId);
  return new Map(rows.map((r) => [r.creatorId, new Date(r.lastPublished).toISOString()]));
};
