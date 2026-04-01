import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import { AssignContentSchema, RemoveContentSchema, TrackEventSchema } from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { config } from "../config.js";
import { orchestrator } from "./playout-channels.init.js";

/** Playout channel queue management and Liquidsoap webhook endpoints. */
export const playoutChannelRoutes = new Hono<AuthEnv>();

// ── Track Event Webhook (Liquidsoap → API) ──

playoutChannelRoutes.post(
  "/channels/:channelId/track-event",
  describeRoute({
    description: "Receive a track-started event from Liquidsoap. Authenticated via shared secret.",
    tags: ["playout"],
    responses: {
      200: { description: "Event processed" },
      401: { description: "Invalid callback secret" },
    },
  }),
  validator("json", TrackEventSchema),
  async (c) => {
    const secret = c.req.query("secret");
    if (
      !config.PLAYOUT_CALLBACK_SECRET ||
      secret !== config.PLAYOUT_CALLBACK_SECRET
    ) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid callback secret" } },
        401,
      );
    }

    const channelId = c.req.param("channelId");
    const { uri } = c.req.valid("json");

    const result = await orchestrator.onTrackStarted(channelId, uri);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 400 | 404 | 500,
      );
    }

    return c.json({ ok: true });
  },
);

// ── Channel Queue Status (admin) ──

playoutChannelRoutes.get(
  "/channels/:channelId/queue",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Get the current queue status for a playout channel.",
    tags: ["playout"],
    responses: {
      200: { description: "Channel queue status" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Channel not found" },
    },
  }),
  async (c) => {
    const channelId = c.req.param("channelId");
    const result = await orchestrator.getChannelQueueStatus(channelId);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 404 | 500,
      );
    }
    return c.json(result.value);
  },
);

// ── Queue Operations (admin) ──

playoutChannelRoutes.post(
  "/channels/:channelId/queue/items",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Insert an item into the channel queue at a given position.",
    tags: ["playout"],
    responses: {
      201: { description: "Queue entry created" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Playout item not found" },
    },
  }),
  validator(
    "json",
    z.object({
      playoutItemId: z.string(),
      position: z.number().int().min(1).optional(),
    }),
  ),
  async (c) => {
    const channelId = c.req.param("channelId");
    const { playoutItemId, position } = c.req.valid("json");
    const result = await orchestrator.insertIntoQueue(
      channelId,
      playoutItemId,
      position,
    );
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 400 | 404 | 500,
      );
    }
    return c.json(result.value, 201);
  },
);

playoutChannelRoutes.delete(
  "/channels/:channelId/queue/items/:entryId",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Remove a queued item from the channel queue.",
    tags: ["playout"],
    responses: {
      200: { description: "Queue entry removed" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Queue entry not found" },
      409: { description: "Cannot remove currently playing item" },
    },
  }),
  async (c) => {
    const channelId = c.req.param("channelId");
    const entryId = c.req.param("entryId");
    const result = await orchestrator.removeFromQueue(channelId, entryId);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 404 | 409 | 500,
      );
    }
    return c.json({ ok: true });
  },
);

playoutChannelRoutes.post(
  "/channels/:channelId/skip",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Skip the currently playing track on a channel.",
    tags: ["playout"],
    responses: {
      200: { description: "Track skipped" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
    },
  }),
  async (c) => {
    const channelId = c.req.param("channelId");
    const result = await orchestrator.skip(channelId);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 400 | 500,
      );
    }
    return c.json({ ok: true });
  },
);

// ── Content Pool (admin) ──

playoutChannelRoutes.get(
  "/channels/:channelId/content/search",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Search for items available to add to a channel's content pool.",
    tags: ["playout"],
    responses: {
      200: { description: "Search results" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
    },
  }),
  async (c) => {
    const channelId = c.req.param("channelId");
    const q = c.req.query("q") ?? "";
    const result = await orchestrator.searchAvailableContent(channelId, q);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 500,
      );
    }
    return c.json({ items: result.value });
  },
);

playoutChannelRoutes.get(
  "/channels/:channelId/content",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "List content pool items for a channel.",
    tags: ["playout"],
    responses: {
      200: { description: "Content pool items" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
    },
  }),
  async (c) => {
    const channelId = c.req.param("channelId");
    const result = await orchestrator.listContent(channelId);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 500,
      );
    }
    return c.json({ items: result.value });
  },
);

playoutChannelRoutes.post(
  "/channels/:channelId/content",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Assign playout items and/or creator content to a channel's content pool.",
    tags: ["playout"],
    responses: {
      200: { description: "Items assigned" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
    },
  }),
  validator("json", AssignContentSchema),
  async (c) => {
    const channelId = c.req.param("channelId");
    const { playoutItemIds, contentIds } = c.req.valid("json");
    const result = await orchestrator.assignContent(
      channelId,
      playoutItemIds ?? [],
      contentIds,
    );
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 500,
      );
    }
    return c.json({ ok: true });
  },
);

playoutChannelRoutes.delete(
  "/channels/:channelId/content",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Remove playout items and/or creator content from a channel's content pool.",
    tags: ["playout"],
    responses: {
      200: { description: "Items removed" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
    },
  }),
  validator("json", RemoveContentSchema),
  async (c) => {
    const channelId = c.req.param("channelId");
    const { playoutItemIds, contentIds } = c.req.valid("json");
    const result = await orchestrator.removeContent(
      channelId,
      playoutItemIds ?? [],
      contentIds,
    );
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 500,
      );
    }
    return c.json({ ok: true });
  },
);
