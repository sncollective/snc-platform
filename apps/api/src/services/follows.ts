import { eq, and, sql } from "drizzle-orm";
import type { Result, AppError } from "@snc/shared";
import { ok } from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorFollows } from "../db/schema/notification.schema.js";
import { userSubscriptions, subscriptionPlans } from "../db/schema/subscription.schema.js";
import { users } from "../db/schema/user.schema.js";

// ── Public Types ──

export interface FollowStatus {
  isFollowing: boolean;
  followerCount: number;
}

export interface AudienceMember {
  userId: string;
  email: string;
  name: string;
}

// ── Public API ──

/** Follow a creator. Idempotent — no-op if already following. */
export const followCreator = async (
  userId: string,
  creatorId: string,
): Promise<Result<void, AppError>> => {
  await db
    .insert(creatorFollows)
    .values({ userId, creatorId })
    .onConflictDoNothing();

  return ok(undefined);
};

/** Unfollow a creator. Idempotent — no-op if not following. */
export const unfollowCreator = async (
  userId: string,
  creatorId: string,
): Promise<Result<void, AppError>> => {
  await db
    .delete(creatorFollows)
    .where(
      and(
        eq(creatorFollows.userId, userId),
        eq(creatorFollows.creatorId, creatorId),
      ),
    );

  return ok(undefined);
};

/** Check follow status and follower count for a creator. */
export const getFollowStatus = async (
  userId: string | null,
  creatorId: string,
): Promise<FollowStatus> => {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatorFollows)
    .where(eq(creatorFollows.creatorId, creatorId));

  let isFollowing = false;
  if (userId) {
    const [follow] = await db
      .select()
      .from(creatorFollows)
      .where(
        and(
          eq(creatorFollows.userId, userId),
          eq(creatorFollows.creatorId, creatorId),
        ),
      );
    isFollowing = follow !== undefined;
  }

  return {
    isFollowing,
    followerCount: countResult?.count ?? 0,
  };
};

/**
 * Resolve notification audience for a creator: followers + active subscribers (deduplicated).
 * Returns user IDs with email addresses for notification dispatch.
 */
export const resolveAudience = async (
  creatorId: string,
): Promise<AudienceMember[]> => {
  // Followers
  const followers = await db
    .select({
      userId: creatorFollows.userId,
      email: users.email,
      name: users.name,
    })
    .from(creatorFollows)
    .innerJoin(users, eq(users.id, creatorFollows.userId))
    .where(eq(creatorFollows.creatorId, creatorId));

  // Active subscribers on creator-specific plans
  const subscribers = await db
    .select({
      userId: userSubscriptions.userId,
      email: users.email,
      name: users.name,
    })
    .from(userSubscriptions)
    .innerJoin(users, eq(users.id, userSubscriptions.userId))
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, userSubscriptions.planId))
    .where(
      and(
        eq(subscriptionPlans.creatorId, creatorId),
        eq(userSubscriptions.status, "active"),
      ),
    );

  // Deduplicate by userId
  const seen = new Set<string>();
  const audience: AudienceMember[] = [];

  for (const member of [...followers, ...subscribers]) {
    if (!seen.has(member.userId)) {
      seen.add(member.userId);
      audience.push(member);
    }
  }

  return audience;
};
