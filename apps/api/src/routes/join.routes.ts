import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import {
  PRIVACY_POLICY_VERSION,
  JoinPagePayloadSchema,
  JoinConfigSchema,
  JoinConfigPatchSchema,
  CompleteJoinRequestSchema,
  NotFoundError,
} from "@snc/shared";

import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import {
  getJoinPagePayload,
  completeJoin,
  getJoinConfig,
  updateJoinConfig,
} from "../services/join.js";
import { findCreatorProfile } from "../lib/creator-helpers.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";

// ── Schemas ──

const HandleOrIdParam = z.object({ handleOrId: z.string().min(1) });
const CreatorIdParam = z.object({ creatorId: z.string().min(1) });
const OkResponse = z.object({ ok: z.literal(true) });

const joinRateLimiter = rateLimiter({ windowMs: 60_000, max: 60 });

// ── Public join routes (mounted at /api/join) ──

export const joinRoutes = new Hono<AuthEnv>();

joinRoutes.get(
  "/:handleOrId",
  describeRoute({
    description: "Public join-page payload for a creator (by handle or id).",
    tags: ["join"],
    responses: {
      200: { description: "Join payload", content: { "application/json": { schema: resolver(JoinPagePayloadSchema) } } },
      404: ERROR_404,
    },
  }),
  joinRateLimiter,
  validator("param", HandleOrIdParam),
  async (c) => {
    const { handleOrId } = c.req.valid("param" as never) as z.infer<typeof HandleOrIdParam>;
    const result = await getJoinPagePayload(handleOrId);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

joinRoutes.post(
  "/:creatorId/complete",
  describeRoute({
    description: "Follow the creator + record consent (the captured-fan join action).",
    tags: ["join"],
    responses: {
      200: { description: "Joined", content: { "application/json": { schema: resolver(OkResponse) } } },
      400: ERROR_400,
      401: ERROR_401,
      404: ERROR_404,
    },
  }),
  requireAuth,
  validator("param", CreatorIdParam),
  validator("json", CompleteJoinRequestSchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as z.infer<typeof CreatorIdParam>;
    const user = c.get("user");
    const result = await completeJoin(user.id, creatorId, PRIVACY_POLICY_VERSION);
    if (!result.ok) throw result.error;
    return c.json({ ok: true } as const);
  },
);

// ── Creator-manage join-config routes (mounted at /api/creators) ──

export const joinConfigRoutes = new Hono<AuthEnv>();

joinConfigRoutes.get(
  "/:creatorId/join-config",
  describeRoute({
    description: "Read a creator's join-page config (creator members only).",
    tags: ["join"],
    responses: {
      200: { description: "Join config", content: { "application/json": { schema: resolver(JoinConfigSchema) } } },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  requireAuth,
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as z.infer<typeof CreatorIdParam>;
    const user = c.get("user");
    const roles = (c.get("roles") ?? []) as string[];

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const result = await getJoinConfig(profile.id);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

joinConfigRoutes.patch(
  "/:creatorId/join-config",
  describeRoute({
    description: "Update a creator's join-page config (creator members only).",
    tags: ["join"],
    responses: {
      200: { description: "Updated config", content: { "application/json": { schema: resolver(JoinConfigSchema) } } },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  requireAuth,
  validator("param", CreatorIdParam),
  validator("json", JoinConfigPatchSchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as z.infer<typeof CreatorIdParam>;
    const patch = c.req.valid("json" as never) as z.infer<typeof JoinConfigPatchSchema>;
    const user = c.get("user");
    const roles = (c.get("roles") ?? []) as string[];

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");
    await requireCreatorPermission(user.id, profile.id, "editProfile", roles);

    const result = await updateJoinConfig(profile.id, patch);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);
