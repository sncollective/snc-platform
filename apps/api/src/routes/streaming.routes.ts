import { createHash, timingSafeEqual } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { and, eq, desc, isNull } from "drizzle-orm";

import {
  ChannelListResponseSchema,
  CreateStreamKeySchema,
  StreamKeysListResponseSchema,
  StreamKeyCreatedResponseSchema,
  StreamKeyResponseSchema,
  CreateSimulcastDestinationSchema,
  UpdateSimulcastDestinationSchema,
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
import {
  getActiveSimulcastUrls,
  listCreatorSimulcastDestinations,
  createCreatorSimulcastDestination,
  updateCreatorSimulcastDestination,
  deleteCreatorSimulcastDestination,
} from "../services/simulcast.js";
import { config } from "../config.js";
import { dispatchNotification } from "../services/notification-dispatch.js";
import { requireAuth } from "../middleware/require-auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { verifySrsCallback } from "../middleware/verify-srs-callback.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { channels, streamSessions } from "../db/schema/streaming.schema.js";
import { rootLogger } from "../logging/logger.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_404,
  ERROR_502,
  ERROR_503,
} from "../lib/openapi-errors.js";
import { CreatorIdParam } from "./route-params.js";

// ── Param Schemas ──

/** Creator + stream key compound param */
const CreatorKeyParams = z.object({
  creatorId: z.string().min(1),
  keyId: z.string().min(1),
});

/** Creator + simulcast destination compound param */
const CreatorSimulcastParams = z.object({
  creatorId: z.string().min(1),
  id: z.string().min(1),
});

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

// ── Private Helpers ──

/** Check if a stream name belongs to an active playout or broadcast channel (never forward these). */
const isPlayoutStream = async (streamName: string): Promise<boolean> => {
  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.srsStreamName, streamName),
        eq(channels.isActive, true),
      ),
    );
  return channel !== undefined;
};

const extractStreamKey = (param: string): string | null => {
  const match = param.match(/[?&]key=([^&]*)/);
  return match?.[1] ?? null;
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
  optionalAuth,
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
  verifySrsCallback,
  validator("json", SrsOnPublishSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as z.infer<typeof SrsOnPublishSchema>;
    const rawKey = extractStreamKey(body.param);

    // Playout key: Liquidsoap authenticates with a dedicated key.
    // No session or channel creation — playout channels are pre-seeded.
    const playoutKey = config.PLAYOUT_STREAM_KEY;
    if (playoutKey && rawKey) {
      const a = Buffer.from(playoutKey, "utf-8");
      const b = Buffer.from(rawKey, "utf-8");
      if (a.length === b.length && timingSafeEqual(a, b)) {
        rootLogger.info(
          { event: "stream_key_accepted", ip: body.ip, stream: body.stream, source: "playout" },
          "Playout stream key accepted",
        );
        return c.json({ code: 0 }, 200);
      }
    }

    // Per-creator key validation
    if (!rawKey) {
      rootLogger.warn(
        {
          event: "stream_key_rejected",
          ip: body.ip,
          stream: body.stream,
          reason: "missing_key",
        },
        "Stream key rejected",
      );
      return c.json({ code: 1 }, 403);
    }

    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const lookup = await lookupCreatorByKeyHash(keyHash);

    if (!lookup) {
      rootLogger.warn(
        {
          event: "stream_key_rejected",
          ip: body.ip,
          stream: body.stream,
          reason: "invalid_key",
        },
        "Stream key rejected",
      );
      return c.json({ code: 1 }, 403);
    }

    rootLogger.info(
      { event: "stream_key_accepted", ip: body.ip, stream: body.stream, source: "creator", creatorId: lookup.creatorId, keyId: lookup.keyId },
      "Creator stream key accepted",
    );

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

      // Fetch creator profile for notification payload
      const [profile] = await db
        .select({ displayName: creatorProfiles.displayName, handle: creatorProfiles.handle })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.id, lookup.creatorId));

      // Fire-and-forget go-live notification
      void dispatchNotification({
        eventType: "go_live",
        creatorId: lookup.creatorId,
        payload: {
          creatorName: profile?.displayName ?? "A creator",
          creatorId: lookup.creatorId,
          liveUrl: `${config.BETTER_AUTH_URL}/live`,
        },
      });
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
  verifySrsCallback,
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
  verifySrsCallback,
  validator("json", SrsOnForwardSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as z.infer<typeof SrsOnForwardSchema>;

    // Playout stream — return admin simulcast destinations only (no Liquidsoap URL to prevent loops)
    if (await isPlayoutStream(body.stream)) {
      const urls = await getActiveSimulcastUrls();
      return c.json({ code: 0, data: { urls } }, 200);
    }

    // Creator stream — forward to Liquidsoap for S/NC TV takeover
    const urls: string[] = [];

    if (config.LIQUIDSOAP_RTMP_URL) {
      urls.push(config.LIQUIDSOAP_RTMP_URL);
    }

    // Look up creator from active session to fetch their simulcast destinations
    const [session] = await db
      .select({ creatorId: streamSessions.creatorId })
      .from(streamSessions)
      .where(
        and(
          eq(streamSessions.srsClientId, body.client_id),
          isNull(streamSessions.endedAt),
        ),
      );

    if (session) {
      const creatorUrls = await getActiveSimulcastUrls(session.creatorId);
      urls.push(...creatorUrls);
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
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
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
  validator("param", CreatorIdParam),
  validator("json", CreateStreamKeySchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
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
  validator("param", CreatorKeyParams),
  async (c) => {
    const { creatorId, keyId } = c.req.valid("param" as never) as { creatorId: string; keyId: string };
    const user = c.get("user");
    const result = await revokeStreamKey(user.id, creatorId, keyId);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// ── Creator Simulcast Destinations (owner-only) ──

streamingRoutes.get(
  "/simulcast/:creatorId",
  describeRoute({
    description: "List simulcast destinations for a creator (owner only)",
    tags: ["streaming-simulcast"],
    responses: {
      200: { description: "Destination list" },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  requireAuth,
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const user = c.get("user");
    const result = await listCreatorSimulcastDestinations(user.id, creatorId);
    if (!result.ok) throw result.error;
    return c.json({ destinations: result.value }, 200);
  },
);

streamingRoutes.post(
  "/simulcast/:creatorId",
  describeRoute({
    description: "Create a simulcast destination for a creator (owner only, max 5)",
    tags: ["streaming-simulcast"],
    responses: {
      201: { description: "Created" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  requireAuth,
  validator("param", CreatorIdParam),
  validator("json", CreateSimulcastDestinationSchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const user = c.get("user");
    const body = c.req.valid("json" as never) as z.infer<
      typeof CreateSimulcastDestinationSchema
    >;
    const result = await createCreatorSimulcastDestination(
      user.id,
      creatorId,
      body,
    );
    if (!result.ok) throw result.error;
    return c.json({ destination: result.value }, 201);
  },
);

streamingRoutes.patch(
  "/simulcast/:creatorId/:id",
  describeRoute({
    description: "Update a creator's simulcast destination (owner only)",
    tags: ["streaming-simulcast"],
    responses: {
      200: { description: "Updated" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  requireAuth,
  validator("param", CreatorSimulcastParams),
  validator("json", UpdateSimulcastDestinationSchema),
  async (c) => {
    const { creatorId, id } = c.req.valid("param" as never) as { creatorId: string; id: string };
    const user = c.get("user");
    const body = c.req.valid("json" as never) as z.infer<
      typeof UpdateSimulcastDestinationSchema
    >;
    const result = await updateCreatorSimulcastDestination(
      user.id,
      creatorId,
      id,
      body,
    );
    if (!result.ok) throw result.error;
    return c.json({ destination: result.value }, 200);
  },
);

streamingRoutes.delete(
  "/simulcast/:creatorId/:id",
  describeRoute({
    description: "Delete a creator's simulcast destination (owner only)",
    tags: ["streaming-simulcast"],
    responses: {
      204: { description: "Deleted" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  requireAuth,
  validator("param", CreatorSimulcastParams),
  async (c) => {
    const { creatorId, id } = c.req.valid("param" as never) as { creatorId: string; id: string };
    const user = c.get("user");
    const result = await deleteCreatorSimulcastDestination(
      user.id,
      creatorId,
      id,
    );
    if (!result.ok) throw result.error;
    return c.body(null, 204);
  },
);
