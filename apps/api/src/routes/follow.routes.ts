import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { requireAuth } from "../middleware/require-auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { followCreator, unfollowCreator, getFollowStatus } from "../services/follows.js";
import { ERROR_401 } from "../lib/openapi-errors.js";

// ── Schemas ──

const CreatorIdParam = z.object({ creatorId: z.string().min(1) });

const FollowStatusResponse = z.object({
  isFollowing: z.boolean(),
  followerCount: z.number().int().min(0),
});

// ── Route ──

export const followRoutes = new Hono<AuthEnv>();

/** Get follow status for a creator. */
followRoutes.get(
  "/:creatorId/follow",
  optionalAuth,
  describeRoute({
    tags: ["follows"],
    summary: "Get follow status",
    responses: {
      200: {
        description: "Follow status",
        content: { "application/json": { schema: resolver(FollowStatusResponse) } },
      },
    },
  }),
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param");
    const user = c.get("user");
    const status = await getFollowStatus(user?.id ?? null, creatorId);
    return c.json(status);
  },
);

/** Follow a creator. */
followRoutes.post(
  "/:creatorId/follow",
  requireAuth,
  describeRoute({
    tags: ["follows"],
    summary: "Follow a creator",
    responses: { 204: { description: "Followed" }, 401: ERROR_401 },
  }),
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param");
    const user = c.get("user");
    await followCreator(user.id, creatorId);
    return c.body(null, 204);
  },
);

/** Unfollow a creator. */
followRoutes.delete(
  "/:creatorId/follow",
  requireAuth,
  describeRoute({
    tags: ["follows"],
    summary: "Unfollow a creator",
    responses: { 204: { description: "Unfollowed" }, 401: ERROR_401 },
  }),
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param");
    const user = c.get("user");
    await unfollowCreator(user.id, creatorId);
    return c.body(null, 204);
  },
);
