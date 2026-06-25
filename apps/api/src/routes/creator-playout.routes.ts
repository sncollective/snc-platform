import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import {
  AssignContentSchema,
  InsertQueueSourceSchema,
  RemoveContentSchema,
} from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireCreatorChannelPermission } from "../middleware/require-creator-channel-permission.js";
import { orchestrator } from "./playout-channels.init.js";

// ── Route Surface ──

/**
 * Creator-scoped editorial route surface.
 *
 * Every route is protected by `requireAuth` + `requireCreatorChannelPermission("manageStreaming")`.
 * The permission middleware asserts the channel is `ownership === "creator"` with a non-null
 * `creatorId`, then delegates to `requireCreatorPermission` (admin role bypasses).
 *
 * Logic is identical to the admin playout routes — both call the same orchestrator methods.
 * The only difference is the gate: admin uses `requireRole("admin")`, creators use the
 * `requireCreatorChannelPermission` factory.
 *
 * Mounted at `/api/creator/playout` in `app.ts`.
 */
export const creatorPlayoutRoutes = new Hono<AuthEnv>();

// ── Input validators ──
// SQL is already parameterized, so these are not an injection boundary — they
// enforce the platform's input-validation convention (bounded, well-typed params)
// and keep the route surface explicit.

/** `:channelId` path param. */
const ChannelIdParamSchema = z.object({
  channelId: z.string().min(1).max(128),
});

/** `:channelId` + `:entryId` path params (queue-entry routes). */
const ChannelEntryParamSchema = z.object({
  channelId: z.string().min(1).max(128),
  entryId: z.string().min(1).max(128),
});

/** Bounded content-search query. `q` is optional and length-capped. */
const ContentSearchQuerySchema = z.object({
  q: z.string().max(200).optional(),
});

// ── Queue Status ──

creatorPlayoutRoutes.get(
  "/channels/:channelId/queue",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  validator("param", ChannelIdParamSchema),
  describeRoute({
    description: "Get the current queue status for a creator-owned playout channel.",
    tags: ["creator-playout"],
    responses: {
      200: { description: "Channel queue status" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — not a channel member with manageStreaming" },
      404: { description: "Channel not found or not creator-owned" },
    },
  }),
  async (c) => {
    const { channelId } = c.req.valid("param");
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

// ── Queue Operations ──

creatorPlayoutRoutes.post(
  "/channels/:channelId/queue/items",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  describeRoute({
    description: "Insert an item into the creator channel's queue at a given position.",
    tags: ["creator-playout"],
    responses: {
      201: { description: "Queue entry created" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Channel or playout item not found" },
    },
  }),
  validator("param", ChannelIdParamSchema),
  validator("json", InsertQueueSourceSchema),
  async (c) => {
    const { channelId } = c.req.valid("param");
    const { playoutItemId, contentId, position } = c.req.valid("json");
    // The schema's exactly-one-of refine guarantees precisely one source is set.
    const source =
      playoutItemId !== undefined ? { playoutItemId } : { contentId: contentId! };
    const result = await orchestrator.insertIntoQueue(channelId, source, position);
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 400 | 404 | 500,
      );
    }
    return c.json(result.value, 201);
  },
);

creatorPlayoutRoutes.delete(
  "/channels/:channelId/queue/items/:entryId",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  describeRoute({
    description: "Remove a queued item from the creator channel's queue.",
    tags: ["creator-playout"],
    responses: {
      200: { description: "Queue entry removed" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Queue entry not found" },
      409: { description: "Cannot remove currently playing item" },
    },
  }),
  validator("param", ChannelEntryParamSchema),
  async (c) => {
    const { channelId, entryId } = c.req.valid("param");
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

creatorPlayoutRoutes.post(
  "/channels/:channelId/skip",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  describeRoute({
    description: "Skip the currently playing track on a creator-owned channel.",
    tags: ["creator-playout"],
    responses: {
      200: { description: "Track skipped" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Channel not found or not creator-owned" },
    },
  }),
  validator("param", ChannelIdParamSchema),
  async (c) => {
    const { channelId } = c.req.valid("param");
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

// ── Content Pool ──

creatorPlayoutRoutes.get(
  "/channels/:channelId/content/search",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  describeRoute({
    description: "Search for items available to add to a creator channel's content pool.",
    tags: ["creator-playout"],
    responses: {
      200: { description: "Search results" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Channel not found or not creator-owned" },
    },
  }),
  validator("param", ChannelIdParamSchema),
  validator("query", ContentSearchQuerySchema),
  async (c) => {
    const { channelId } = c.req.valid("param");
    const { q } = c.req.valid("query");
    const result = await orchestrator.searchAvailableContent(channelId, q ?? "");
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 500,
      );
    }
    return c.json({ items: result.value });
  },
);

creatorPlayoutRoutes.get(
  "/channels/:channelId/content",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  describeRoute({
    description: "List content pool items for a creator-owned channel.",
    tags: ["creator-playout"],
    responses: {
      200: { description: "Content pool items" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Channel not found or not creator-owned" },
    },
  }),
  validator("param", ChannelIdParamSchema),
  async (c) => {
    const { channelId } = c.req.valid("param");
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

creatorPlayoutRoutes.post(
  "/channels/:channelId/content",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  describeRoute({
    description:
      "Assign playout items and/or creator content to a creator channel's content pool.",
    tags: ["creator-playout"],
    responses: {
      200: { description: "Items assigned" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — not a member, or content not owned by this creator" },
      404: { description: "Channel not found or not creator-owned" },
    },
  }),
  validator("param", ChannelIdParamSchema),
  validator("json", AssignContentSchema),
  async (c) => {
    const { channelId } = c.req.valid("param");
    const { playoutItemIds, contentIds } = c.req.valid("json");
    const result = await orchestrator.assignContent(
      channelId,
      playoutItemIds ?? [],
      contentIds,
    );
    if (!result.ok) {
      return c.json(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.statusCode as 403 | 500,
      );
    }
    return c.json({ ok: true });
  },
);

creatorPlayoutRoutes.delete(
  "/channels/:channelId/content",
  requireAuth,
  requireCreatorChannelPermission("manageStreaming"),
  describeRoute({
    description:
      "Remove playout items and/or creator content from a creator channel's content pool.",
    tags: ["creator-playout"],
    responses: {
      200: { description: "Items removed" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Channel not found or not creator-owned" },
    },
  }),
  validator("param", ChannelIdParamSchema),
  validator("json", RemoveContentSchema),
  async (c) => {
    const { channelId } = c.req.valid("param");
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
