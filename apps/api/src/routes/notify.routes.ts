import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { PRIVACY_POLICY_VERSION } from "@snc/shared";

import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  subscribeToChannel,
  unsubscribeFromChannel,
} from "../services/notify-when-live.js";
import { ERROR_401, ERROR_404 } from "../lib/openapi-errors.js";

// ── Schemas ──

const SubscribeRequest = z.object({
  channelId: z.string().min(1),
  /** Explicit consent — must be literal true; the checkbox never travels alone. */
  consent: z.literal(true),
});

const ChannelIdParam = z.object({ channelId: z.string().min(1) });

const OkResponse = z.object({ ok: z.literal(true) });

// ── Routes ──

/**
 * Notify-me-when-live subscriptions. The OTP capture (anonymous → user) happens
 * client-side through better-auth's email-OTP sign-in; these routes assume an
 * authenticated session and manage the per-channel subscription + consent record.
 */
export const notifyRoutes = new Hono<AuthEnv>();

notifyRoutes.post(
  "/",
  describeRoute({
    description: "Subscribe the authenticated user to a channel's go-live notification.",
    tags: ["notify"],
    responses: {
      200: {
        description: "Subscribed",
        content: { "application/json": { schema: resolver(OkResponse) } },
      },
      401: ERROR_401,
      404: ERROR_404,
    },
  }),
  requireAuth,
  validator("json", SubscribeRequest),
  async (c) => {
    const { channelId } = c.req.valid("json" as never) as z.infer<typeof SubscribeRequest>;
    const user = c.get("user");

    const result = await subscribeToChannel(user.id, channelId, PRIVACY_POLICY_VERSION);
    if (!result.ok) throw result.error;

    return c.json({ ok: true } as const);
  },
);

notifyRoutes.delete(
  "/:channelId",
  describeRoute({
    description: "Unsubscribe the authenticated user from a channel's go-live notification.",
    tags: ["notify"],
    responses: {
      200: {
        description: "Unsubscribed",
        content: { "application/json": { schema: resolver(OkResponse) } },
      },
      401: ERROR_401,
    },
  }),
  requireAuth,
  validator("param", ChannelIdParam),
  async (c) => {
    const { channelId } = c.req.valid("param" as never) as z.infer<typeof ChannelIdParam>;
    const user = c.get("user");

    const result = await unsubscribeFromChannel(user.id, channelId);
    if (!result.ok) throw result.error;

    return c.json({ ok: true } as const);
  },
);
