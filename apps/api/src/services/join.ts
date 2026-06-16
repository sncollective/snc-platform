import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { ok, err, NotFoundError, DEFAULT_JOIN_CONFIG } from "@snc/shared";
import type { Result, AppError, JoinPagePayload, JoinConfig, JoinConfigPatch, PublicPlan } from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles, creatorJoinConfigs } from "../db/schema/creator.schema.js";
import { creatorFollows } from "../db/schema/notification.schema.js";
import { consentLog } from "../db/schema/consent.schema.js";
import { subscriptionPlans } from "../db/schema/subscription.schema.js";
import { findCreatorProfile } from "../lib/creator-helpers.js";
import { resolveCreatorUrls } from "../lib/creator-url.js";
import { followCreator } from "./follows.js";

// ── Private Helpers ──

/** Read a creator's join config, falling back to defaults when no row exists. */
const readJoinConfig = async (creatorId: string): Promise<JoinConfig> => {
  const [row] = await db
    .select()
    .from(creatorJoinConfigs)
    .where(eq(creatorJoinConfigs.creatorId, creatorId))
    .limit(1);
  if (!row) return DEFAULT_JOIN_CONFIG;
  return {
    incentiveText: row.incentiveText,
    showSncExplainer: row.showSncExplainer,
    showSubscribeCta: row.showSubscribeCta,
  };
};

const toPublicPlan = (row: {
  id: string;
  name: string;
  price: number;
  interval: string;
}): PublicPlan => ({ id: row.id, name: row.name, price: row.price, interval: row.interval });

// ── Public API ──

/**
 * Assemble the public join-page payload for a creator (by handle or id).
 * @returns NotFoundError when the creator does not exist or is inactive.
 */
export const getJoinPagePayload = async (
  handleOrId: string,
): Promise<Result<JoinPagePayload, AppError>> => {
  const profile = await findCreatorProfile(handleOrId, { activeOnly: true });
  if (!profile) return err(new NotFoundError("Creator not found"));

  const urls = resolveCreatorUrls(profile);
  const config = await readJoinConfig(profile.id);

  const [followerRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatorFollows)
    .where(eq(creatorFollows.creatorId, profile.id));
  const followerCount = followerRow?.count ?? 0;

  const creatorPlanRows = await db
    .select({
      id: subscriptionPlans.id,
      name: subscriptionPlans.name,
      price: subscriptionPlans.price,
      interval: subscriptionPlans.interval,
    })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.creatorId, profile.id));

  const sncPlanRows = await db
    .select({
      id: subscriptionPlans.id,
      name: subscriptionPlans.name,
      price: subscriptionPlans.price,
      interval: subscriptionPlans.interval,
    })
    .from(subscriptionPlans)
    .where(isNull(subscriptionPlans.creatorId));

  return ok({
    creator: {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatar: urls.avatar,
      banner: urls.banner,
    },
    config,
    followerCount,
    creatorPlans: creatorPlanRows.map(toPublicPlan),
    sncPlans: sncPlanRows.map(toPublicPlan),
  });
};

/**
 * Complete a join: follow the creator + record consent. Idempotent — re-follow is a
 * no-op, consent is append-only. Validates the creator exists.
 */
export const completeJoin = async (
  userId: string,
  creatorId: string,
  policyVersion: string,
): Promise<Result<void, AppError>> => {
  const profile = await findCreatorProfile(creatorId);
  if (!profile) return err(new NotFoundError("Creator not found"));

  const followResult = await followCreator(userId, profile.id);
  if (!followResult.ok) return err(followResult.error);

  await db.insert(consentLog).values({
    id: randomUUID(),
    userId,
    consentType: "email-contact",
    policyVersion,
    source: `join:${profile.id}`,
  });

  return ok(undefined);
};

/** Read a creator's join config (defaults when unset). */
export const getJoinConfig = async (
  creatorId: string,
): Promise<Result<JoinConfig, AppError>> => ok(await readJoinConfig(creatorId));

/** Upsert a creator's join config with a partial patch. */
export const updateJoinConfig = async (
  creatorId: string,
  patch: JoinConfigPatch,
): Promise<Result<JoinConfig, AppError>> => {
  const current = await readJoinConfig(creatorId);
  const next: JoinConfig = {
    incentiveText: patch.incentiveText !== undefined ? patch.incentiveText : current.incentiveText,
    showSncExplainer: patch.showSncExplainer ?? current.showSncExplainer,
    showSubscribeCta: patch.showSubscribeCta ?? current.showSubscribeCta,
  };

  await db
    .insert(creatorJoinConfigs)
    .values({ creatorId, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: creatorJoinConfigs.creatorId,
      set: { ...next, updatedAt: new Date() },
    });

  return ok(next);
};
