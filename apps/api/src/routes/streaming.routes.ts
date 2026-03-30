import { createHash } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import {
  ChannelListResponseSchema,
  CreateStreamKeySchema,
  StreamKeysListResponseSchema,
  StreamKeyCreatedResponseSchema,
  StreamKeyResponseSchema,
} from "@snc/shared";

import { getChannelList } from "../services/srs.js";
import {
  createStreamKey,
  listStreamKeys,
  revokeStreamKey,
  lookupCreatorByKeyHash,
} from "../services/stream-keys.js";
import { openSession, closeSession } from "../services/stream-sessions.js";
import { createLiveChannel, deactivateLiveChannel } from "../services/channels.js";
import { createChannelRoom, closeChannelRoom } from "../services/chat.js";
import { broadcastToRoom } from "../services/chat-rooms.js";
import { getActiveSimulcastUrls } from "../services/simulcast.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { streamSessions } from "../db/schema/streaming.schema.js";
import { rootLogger } from "../logging/logger.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_404,
  ERROR_502,
  ERROR_503,
} from "../lib/openapi-errors.js";

// ── Callback Schemas ──

const SrsOnPublishSchema = z.object({
  action: z.literal("on_publish"),
  client_id: z.string(),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  stream: z.string(),
  param: z.string().optional().default(""),
});

const SrsOnUnpublishSchema = z.object({
  action: z.literal("on_unpublish"),
  client_id: z.string(),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  stream: z.string(),
  param: z.string().optional().default(""),
});

const SrsOnForwardSchema = z.object({
  action: z.literal("on_forward"),
  server_id: z.string(),
  client_id: z.string(),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  tcUrl: z.string(),
  stream: z.string(),
  param: z.string().optional().default(""),
});

// ── Private Constants ──

/** SRS stream names that originate from Liquidsoap — never forward these. */
const PLAYOUT_STREAM_NAMES = new Set(["snc-tv", "channel-classics"]);

// ── Private Helpers ──

const extractStreamKey = (param: string): string | null => {
  const match = param.match(/[?&]key=([^&]*)/);
  return match ? match[1] : null;
};

const toErrorDetail = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) });

async function ensureLiveChannelWithChat(
  creatorId: string,
  sessionId: string,
  srsStreamName: string,
): Promise<void> {
  try {
    const [profile] = await db
      .select({ displayName: creatorProfiles.displayName })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, creatorId));

    if (!profile) return;

    const channelResult = await createLiveChannel({
      creatorId,
      creatorName: profile.displayName,
      streamSessionId: sessionId,
      srsStreamName,
    });

    if (!channelResult.ok) return;

    try {
      await createChannelRoom(
        channelResult.value.channelId,
        `${profile.displayName}'s Stream`,
      );
    } catch (chatErr) {
      rootLogger.error(toErrorDetail(chatErr), "Failed to create channel chat room");
    }
  } catch (channelErr) {
    rootLogger.error(toErrorDetail(channelErr), "Failed to create live channel");
  }
}

async function teardownLiveChannel(srsClientId: string): Promise<void> {
  try {
    const closedSession = await db
      .select({ id: streamSessions.id })
      .from(streamSessions)
      .where(eq(streamSessions.srsClientId, srsClientId))
      .orderBy(desc(streamSessions.endedAt))
      .limit(1);

    if (closedSession.length === 0) return;

    const sessionId = closedSession[0]!.id;
    const channelResult = await deactivateLiveChannel(sessionId);

    if (!channelResult.ok || !channelResult.value) return;

    const { channelId } = channelResult.value;
    try {
      await closeChannelRoom(channelId);
      broadcastToRoom(channelId, {
        type: "room_closed",
        roomId: channelId,
      });
    } catch (chatErr) {
      rootLogger.error(toErrorDetail(chatErr), "Failed to close channel chat room");
    }
  } catch (channelErr) {
    rootLogger.error(toErrorDetail(channelErr), "Failed to deactivate live channel");
  }
}

// ── Public API ──

/** SRS streaming callbacks and viewer count SSE. */
export const streamingRoutes = new Hono<AuthEnv>();

// ── Status Endpoint ──

streamingRoutes.get(
  "/status",
  describeRoute({
    description: "Get active channels with viewer counts and default selection",
    tags: ["streaming"],
    responses: {
      200: {
        description: "Channel list",
        content: {
          "application/json": { schema: resolver(ChannelListResponseSchema) },
        },
      },
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  async (c) => {
    const result = await getChannelList();
    if (!result.ok) throw result.error;

    const { channels, defaultChannelId } = result.value;
    return c.json({
      channels: channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        thumbnailUrl: ch.thumbnailUrl,
        hlsUrl: ch.hlsUrl,
        viewerCount: ch.viewerCount,
        creator: ch.creator,
        startedAt: null, // TODO: populate from session for live channels
        nowPlaying: ch.nowPlaying,
      })),
      defaultChannelId,
    });
  },
);

// ── SRS Callback: on_publish ──

streamingRoutes.post(
  "/callbacks/on-publish",
  describeRoute({
    description:
      "SRS on_publish callback — validates stream key, identifies creator, opens session",
    tags: ["streaming-callbacks"],
    responses: {
      200: { description: "Publish allowed" },
      400: ERROR_400,
      403: ERROR_403,
    },
  }),
  validator("json", SrsOnPublishSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as z.infer<typeof SrsOnPublishSchema>;
    const rawKey = extractStreamKey(body.param);

    // Playout key: Liquidsoap authenticates with a dedicated key.
    // No session or channel creation — playout channels are pre-seeded.
    const playoutKey = config.PLAYOUT_STREAM_KEY;
    if (playoutKey && rawKey === playoutKey) {
      return c.json({ code: 0 }, 200);
    }

    // Per-creator key validation
    if (!rawKey) {
      return c.json({ code: 1 }, 403);
    }

    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const lookup = await lookupCreatorByKeyHash(keyHash);

    if (!lookup) {
      return c.json({ code: 1 }, 403);
    }

    // Open session
    const session = await openSession({
      creatorId: lookup.creatorId,
      streamKeyId: lookup.keyId,
      srsClientId: body.client_id,
      srsStreamName: body.stream,
      callbackPayload: body as unknown as Record<string, unknown>,
    });

    // Create live channel + channel chat room (best-effort — don't block SRS callback)
    if (session.ok) {
      await ensureLiveChannelWithChat(lookup.creatorId, session.value.sessionId, body.stream);
    }

    return c.json({ code: 0 }, 200);
  },
);

// ── SRS Callback: on_unpublish ──

streamingRoutes.post(
  "/callbacks/on-unpublish",
  describeRoute({
    description: "SRS on_unpublish callback — closes stream session and deactivates channel",
    tags: ["streaming-callbacks"],
    responses: {
      200: { description: "Unpublish acknowledged" },
      400: ERROR_400,
    },
  }),
  validator("json", SrsOnUnpublishSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as z.infer<typeof SrsOnUnpublishSchema>;

    await closeSession({
      srsClientId: body.client_id,
      callbackPayload: body as unknown as Record<string, unknown>,
    });

    // Deactivate live channel and close channel chat room (best-effort)
    await teardownLiveChannel(body.client_id);

    return c.json({ code: 0 }, 200);
  },
);

// ── SRS Callback: on_forward ──

streamingRoutes.post(
  "/callbacks/on-forward",
  describeRoute({
    description:
      "SRS on_forward callback — returns RTMP destinations for a published stream",
    tags: ["streaming-callbacks"],
    responses: {
      200: { description: "Forward destinations" },
      400: ERROR_400,
    },
  }),
  validator("json", SrsOnForwardSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as z.infer<typeof SrsOnForwardSchema>;

    // Never forward Liquidsoap's own output (prevents loops)
    if (PLAYOUT_STREAM_NAMES.has(body.stream)) {
      const urls = await getActiveSimulcastUrls();
      return c.json({ code: 0, data: { urls } }, 200);
    }

    // Creator stream — forward to Liquidsoap for S/NC TV takeover
    const urls: string[] = [];

    if (config.LIQUIDSOAP_RTMP_URL) {
      urls.push(config.LIQUIDSOAP_RTMP_URL);
    }

    return c.json({ code: 0, data: { urls } }, 200);
  },
);

// ── Stream Key Management (owner-only) ──

streamingRoutes.get(
  "/keys/:creatorId",
  describeRoute({
    description: "List stream keys for a creator (owner only)",
    tags: ["streaming-keys"],
    responses: {
      200: {
        description: "Stream keys list",
        content: {
          "application/json": { schema: resolver(StreamKeysListResponseSchema) },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  requireAuth,
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const user = c.get("user");
    const result = await listStreamKeys(user.id, creatorId);
    if (!result.ok) throw result.error;
    return c.json({ keys: result.value });
  },
);

streamingRoutes.post(
  "/keys/:creatorId",
  describeRoute({
    description: "Create a named stream key for a creator (owner only)",
    tags: ["streaming-keys"],
    responses: {
      201: {
        description: "Stream key created (raw key included once)",
        content: {
          "application/json": { schema: resolver(StreamKeyCreatedResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  requireAuth,
  validator("json", CreateStreamKeySchema),
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const user = c.get("user");
    const { name } = c.req.valid("json" as never) as z.infer<typeof CreateStreamKeySchema>;
    const result = await createStreamKey(user.id, creatorId, name);
    if (!result.ok) throw result.error;
    return c.json(result.value, 201);
  },
);

streamingRoutes.delete(
  "/keys/:creatorId/:keyId",
  describeRoute({
    description: "Revoke a stream key (owner only)",
    tags: ["streaming-keys"],
    responses: {
      200: {
        description: "Stream key revoked",
        content: {
          "application/json": { schema: resolver(StreamKeyResponseSchema) },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  requireAuth,
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const keyId = c.req.param("keyId");
    const user = c.get("user");
    const result = await revokeStreamKey(user.id, creatorId, keyId);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);
