import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import {
  startTwitchConnect,
  handleTwitchCallback,
  startYouTubeConnect,
  handleYouTubeCallback,
} from "../services/streaming-connect.js";
import { createCreatorSimulcastDestination } from "../services/simulcast.js";
import { config } from "../config.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_503,
} from "../lib/openapi-errors.js";

// ── Param Schemas ──

const StartConnectBody = z.object({
  creatorId: z.string().min(1),
});

const CallbackQuery = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// ── Router ──

/** Streaming account connect routes — OAuth flows for Twitch and YouTube. */
export const streamingConnectRoutes = new Hono<AuthEnv>();

// ── POST /twitch/start ──

streamingConnectRoutes.post(
  "/twitch/start",
  describeRoute({
    description: "Initiate Twitch OAuth connect for streaming — returns authorization URL",
    tags: ["streaming-connect"],
    responses: {
      200: { description: "Authorization URL" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      503: ERROR_503,
    },
  }),
  requireAuth,
  validator("json", StartConnectBody),
  async (c) => {
    const user = c.get("user");
    const { creatorId } = c.req.valid("json" as never) as z.infer<typeof StartConnectBody>;

    await requireCreatorPermission(user.id, creatorId, "manageMembers");

    const result = startTwitchConnect(user.id, creatorId);
    if (!result.ok) throw result.error;

    return c.json({ authorizationUrl: result.value.authorizationUrl });
  },
);

// ── GET /twitch/callback ──

streamingConnectRoutes.get(
  "/twitch/callback",
  describeRoute({
    description: "Handle Twitch OAuth callback — create simulcast destination and redirect",
    tags: ["streaming-connect"],
    responses: {
      302: { description: "Redirect after connect" },
      400: ERROR_400,
    },
  }),
  validator("query", CallbackQuery),
  async (c) => {
    const { code, state } = c.req.valid("query" as never) as z.infer<typeof CallbackQuery>;
    const result = await handleTwitchCallback(code, state);

    if (!result.ok) {
      // For state errors we don't have a creatorId — redirect to login
      const isStateError =
        result.error.code === "TWITCH_INVALID_STATE" ||
        result.error.code === "TWITCH_STATE_EXPIRED" ||
        result.error.code === "TWITCH_WRONG_PLATFORM";

      if (isStateError) {
        return c.redirect(`${config.BETTER_AUTH_URL}/login?error=${result.error.code}`, 302);
      }
      throw result.error;
    }

    const { credentials, userId, creatorId } = result.value;

    // Auto-create inactive simulcast destination (best-effort)
    try {
      await createCreatorSimulcastDestination(userId, creatorId, {
        platform: "twitch",
        label: "Twitch",
        rtmpUrl: credentials.rtmpUrl,
        streamKey: credentials.streamKey,
      });
    } catch {
      // Non-fatal — destination may already exist or hit cap; user can manage manually
    }

    return c.redirect(
      `${config.BETTER_AUTH_URL}/creators/${creatorId}/manage/streaming`,
      302,
    );
  },
);

// ── POST /youtube/start ──

streamingConnectRoutes.post(
  "/youtube/start",
  describeRoute({
    description: "Initiate YouTube OAuth connect for streaming — returns authorization URL",
    tags: ["streaming-connect"],
    responses: {
      200: { description: "Authorization URL" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      503: ERROR_503,
    },
  }),
  requireAuth,
  validator("json", StartConnectBody),
  async (c) => {
    const user = c.get("user");
    const { creatorId } = c.req.valid("json" as never) as z.infer<typeof StartConnectBody>;

    await requireCreatorPermission(user.id, creatorId, "manageMembers");

    const result = startYouTubeConnect(user.id, creatorId);
    if (!result.ok) throw result.error;

    return c.json({ authorizationUrl: result.value.authorizationUrl });
  },
);

// ── GET /youtube/callback ──

streamingConnectRoutes.get(
  "/youtube/callback",
  describeRoute({
    description: "Handle YouTube OAuth callback — create simulcast destination and redirect",
    tags: ["streaming-connect"],
    responses: {
      302: { description: "Redirect after connect" },
      400: ERROR_400,
    },
  }),
  validator("query", CallbackQuery),
  async (c) => {
    const { code, state } = c.req.valid("query" as never) as z.infer<typeof CallbackQuery>;
    const result = await handleYouTubeCallback(code, state);

    if (!result.ok) {
      const isStateError =
        result.error.code === "YOUTUBE_INVALID_STATE" ||
        result.error.code === "YOUTUBE_STATE_EXPIRED" ||
        result.error.code === "YOUTUBE_WRONG_PLATFORM";

      if (isStateError) {
        return c.redirect(`${config.BETTER_AUTH_URL}/login?error=${result.error.code}`, 302);
      }
      throw result.error;
    }

    const { credentials, userId, creatorId } = result.value;

    // Auto-create inactive simulcast destination (best-effort)
    try {
      await createCreatorSimulcastDestination(userId, creatorId, {
        platform: "youtube",
        label: "YouTube",
        rtmpUrl: credentials.rtmpUrl,
        streamKey: credentials.streamKey,
      });
    } catch {
      // Non-fatal — destination may already exist or hit cap; user can manage manually
    }

    return c.redirect(
      `${config.BETTER_AUTH_URL}/creators/${creatorId}/manage/streaming`,
      302,
    );
  },
);
