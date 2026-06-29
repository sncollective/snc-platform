import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

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
} from "../services/stream-keys.js";
import {
  listCreatorSimulcastDestinations,
  createCreatorSimulcastDestination,
  updateCreatorSimulcastDestination,
  deleteCreatorSimulcastDestination,
} from "../services/simulcast.js";
import {
  SrsOnForwardSchema,
  SrsOnPublishSchema,
  SrsOnUnpublishSchema,
  handleSrsOnForward,
  handleSrsOnPublish,
  handleSrsOnUnpublish,
} from "../services/streaming-callbacks.js";
import { requireAuth } from "../middleware/require-auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { verifySrsCallback } from "../middleware/verify-srs-callback.js";
import type { AuthEnv } from "../middleware/auth-env.js";
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

// ── Private Helpers ──

/** Extract platform roles from the request context (empty array if none). */
const getRoles = (c: { get: (key: "roles") => unknown }): string[] =>
  (c.get("roles") as string[] | undefined) ?? [];

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
        ownership: ch.ownership,
        role: ch.role,
        thumbnailUrl: ch.thumbnailUrl,
        hlsUrl: ch.hlsUrl,
        viewerCount: ch.viewerCount,
        creator: ch.creator,
        startedAt: null, // TODO: populate from session for live channels
        nowPlaying: ch.nowPlaying,
        liveState: ch.liveState,
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
    const result = await handleSrsOnPublish(body);
    return c.json(result.body, result.status);
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
    const result = await handleSrsOnUnpublish(body);
    return c.json(result.body, result.status);
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
    const result = await handleSrsOnForward(body);
    return c.json(result.body, result.status);
  },
);

// ── Stream Key Management (owner-only) ──

streamingRoutes.get(
  "/keys/:creatorId",
  describeRoute({
    description: "List stream keys for a creator (owner or platform admin)",
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
    const result = await listStreamKeys(user.id, creatorId, getRoles(c));
    if (!result.ok) throw result.error;
    return c.json({ keys: result.value });
  },
);

streamingRoutes.post(
  "/keys/:creatorId",
  describeRoute({
    description: "Create a named stream key for a creator (owner or platform admin)",
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
    const result = await createStreamKey(user.id, creatorId, name, getRoles(c));
    if (!result.ok) throw result.error;
    return c.json(result.value, 201);
  },
);

streamingRoutes.delete(
  "/keys/:creatorId/:keyId",
  describeRoute({
    description: "Revoke a stream key (owner or platform admin)",
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
    const result = await revokeStreamKey(user.id, creatorId, keyId, getRoles(c));
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// ── Creator Simulcast Destinations (owner or platform admin) ──

streamingRoutes.get(
  "/simulcast/:creatorId",
  describeRoute({
    description: "List simulcast destinations for a creator (owner or platform admin)",
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
    const result = await listCreatorSimulcastDestinations(user.id, creatorId, getRoles(c));
    if (!result.ok) throw result.error;
    return c.json({ destinations: result.value }, 200);
  },
);

streamingRoutes.post(
  "/simulcast/:creatorId",
  describeRoute({
    description: "Create a simulcast destination for a creator (owner or platform admin, max 5)",
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
      getRoles(c),
    );
    if (!result.ok) throw result.error;
    return c.json({ destination: result.value }, 201);
  },
);

streamingRoutes.patch(
  "/simulcast/:creatorId/:id",
  describeRoute({
    description: "Update a creator's simulcast destination (owner or platform admin)",
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
      getRoles(c),
    );
    if (!result.ok) throw result.error;
    return c.json({ destination: result.value }, 200);
  },
);

streamingRoutes.delete(
  "/simulcast/:creatorId/:id",
  describeRoute({
    description: "Delete a creator's simulcast destination (owner or platform admin)",
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
      getRoles(c),
    );
    if (!result.ok) throw result.error;
    return c.body(null, 204);
  },
);
