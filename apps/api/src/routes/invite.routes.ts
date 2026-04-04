import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import { CreateInviteSchema } from "@snc/shared";

import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { createInvite, validateInvite, acceptInvite } from "../services/invites.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404, ERROR_503 } from "../lib/openapi-errors.js";

// ── Schemas ──

const TokenParam = z.object({ token: z.string().min(1) });

// ── Route ──

/** Invite management endpoints — creation, validation, and acceptance. */
export const inviteRoutes = new Hono<AuthEnv>();

/** Create an invite. Admin-only for creator_owner, owner-only for team_member. */
inviteRoutes.post(
  "/",
  requireAuth,
  describeRoute({
    tags: ["invites"],
    summary: "Create an invite",
    responses: {
      201: { description: "Invite created" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      503: ERROR_503,
    },
  }),
  validator("json", CreateInviteSchema),
  async (c) => {
    const user = c.get("user");
    const roles = c.get("roles") as string[];
    const input = c.req.valid("json");

    // Permission check based on invite type
    if (input.type === "creator_owner") {
      // Only admins can invite new creator owners
      if (!roles.includes("admin")) {
        return c.json(
          { error: { code: "FORBIDDEN", message: "Only admins can invite creator owners" } },
          403,
        );
      }
    } else {
      // Only creator owners (or admins) can invite team members
      await requireCreatorPermission(user.id, input.creatorId, "manageMembers", roles);
    }

    const result = await createInvite(input, user.id);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 503,
      );
    }

    return c.json(result.value, 201);
  },
);

/** Validate an invite token (public — allows the accept page to render). */
inviteRoutes.get(
  "/:token",
  describeRoute({
    tags: ["invites"],
    summary: "Validate an invite token",
    responses: {
      200: { description: "Invite details" },
      404: ERROR_404,
    },
  }),
  validator("param", TokenParam),
  async (c) => {
    const { token } = c.req.valid("param");
    const result = await validateInvite(token);

    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 404,
      );
    }

    return c.json({
      id: result.value.id,
      type: result.value.type,
      email: result.value.email,
      expiresAt: result.value.expiresAt.toISOString(),
      payload: result.value.payload,
    });
  },
);

/** Accept an invite (authenticated — user must match invite email). */
inviteRoutes.post(
  "/:token/accept",
  requireAuth,
  describeRoute({
    tags: ["invites"],
    summary: "Accept an invite",
    responses: {
      200: { description: "Invite accepted" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", TokenParam),
  async (c) => {
    const user = c.get("user");
    const { token } = c.req.valid("param");

    const result = await acceptInvite(token, user.id);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 403 | 404,
      );
    }

    return c.json(result.value);
  },
);
