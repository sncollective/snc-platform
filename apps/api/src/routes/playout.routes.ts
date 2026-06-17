import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import {
  CreatePlayoutItemSchema,
  UpdatePlayoutItemSchema,
  EditorialModeSchema,
} from "@snc/shared";
import type { CreatePlayoutItem, UpdatePlayoutItem } from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import {
  listPlayoutItems,
  getPlayoutItem,
  createPlayoutItem,
  updatePlayoutItem,
  deletePlayoutItem,
  getPlayoutStatus,
  queuePlayoutItem,
  skipCurrentTrack,
  retryPlayoutIngest,
} from "../services/playout.js";
import {
  setMode as editorialSetMode,
  armQueue as editorialArmQueue,
  takeQueue as editorialTakeQueue,
  setManualTier as editorialSetManualTier,
} from "../services/editorial-control.js";
import { createLiquidsoapClient, createStubLiquidsoapClient } from "../services/liquidsoap-client.js";
import { config } from "../config.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";

// ── Liquidsoap client singleton (shared with playout-channels.init.ts pattern) ──
// Note: creator-scoped access to editorial routes arrives with the creator-enablement story.
// For now all editorial control routes are admin-only.
const getLiquidsoapClient = () =>
  config.LIQUIDSOAP_API_URL ? createLiquidsoapClient() : createStubLiquidsoapClient();

/** Playout item ID param (text, not UUID) */
const PlayoutIdParam = z.object({ id: z.string().min(1) });

/** Playout item management and Liquidsoap control. */
export const playoutRoutes = new Hono<AuthEnv>();

// Playout item + status routes require admin role.
// Note: paths under /channels/* live in playoutChannelRoutes (same /api/playout mount)
// and manage their own auth — track-event uses shared-secret auth, not session auth.
playoutRoutes.use("/items", requireAuth, requireRole("admin"));
playoutRoutes.use("/items/*", requireAuth, requireRole("admin"));
playoutRoutes.use("/status", requireAuth, requireRole("admin"));
playoutRoutes.use("/skip", requireAuth, requireRole("admin"));
playoutRoutes.use("/queue/*", requireAuth, requireRole("admin"));

// GET /items — list all playout items
playoutRoutes.get(
  "/items",
  describeRoute({
    description: "List all playout items for the broadcast queue.",
    tags: ["playout"],
    responses: {
      200: { description: "Playout items" },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const result = await listPlayoutItems();
    if (!result.ok) throw result.error;
    return c.json({ items: result.value });
  },
);

// GET /items/:id — get a single playout item
playoutRoutes.get(
  "/items/:id",
  describeRoute({
    description: "Get a single playout item by ID.",
    tags: ["playout"],
    responses: {
      200: { description: "Playout item" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", PlayoutIdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const result = await getPlayoutItem(id);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// POST /items — create a new playout item
playoutRoutes.post(
  "/items",
  describeRoute({
    description: "Create a new playout item in the broadcast queue.",
    tags: ["playout"],
    responses: {
      201: { description: "Created playout item" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreatePlayoutItemSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as CreatePlayoutItem;
    const result = await createPlayoutItem(body);
    if (!result.ok) throw result.error;
    return c.json(result.value, 201);
  },
);

// PATCH /items/:id — update a playout item
playoutRoutes.patch(
  "/items/:id",
  describeRoute({
    description: "Update an existing playout item.",
    tags: ["playout"],
    responses: {
      200: { description: "Updated playout item" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", PlayoutIdParam),
  validator("json", UpdatePlayoutItemSchema),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const body = c.req.valid("json" as never) as UpdatePlayoutItem;
    const result = await updatePlayoutItem(id, body);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// DELETE /items/:id — delete a playout item
playoutRoutes.delete(
  "/items/:id",
  describeRoute({
    description: "Delete a playout item from the broadcast queue.",
    tags: ["playout"],
    responses: {
      200: { description: "Deletion confirmed" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", PlayoutIdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const result = await deletePlayoutItem(id);
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);

// POST /items/:id/retry — re-enqueue ingest for a failed playout item
playoutRoutes.post(
  "/items/:id/retry",
  describeRoute({
    description: "Reset a failed playout item to pending and re-enqueue the ingest job.",
    tags: ["playout"],
    responses: {
      200: { description: "Retry enqueued" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
      409: { description: "Item is not in failed state" },
      422: { description: "Item has no source file" },
    },
  }),
  validator("param", PlayoutIdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const result = await retryPlayoutIngest(id);
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);

// GET /status — now-playing + queue state (admin fast-poll endpoint)
playoutRoutes.get(
  "/status",
  describeRoute({
    description: "Get current playout status including now-playing and queue state.",
    tags: ["playout"],
    responses: {
      200: { description: "Playout status" },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const status = await getPlayoutStatus();
    return c.json(status);
  },
);

// POST /skip — skip current track
playoutRoutes.post(
  "/skip",
  describeRoute({
    description: "Skip the currently playing track and advance to the next item.",
    tags: ["playout"],
    responses: {
      200: { description: "Skip acknowledged" },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const result = await skipCurrentTrack();
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);

// POST /queue/:id — queue a playout item to play next
playoutRoutes.post(
  "/queue/:id",
  describeRoute({
    description: "Queue a playout item to play next.",
    tags: ["playout"],
    responses: {
      200: { description: "Item queued" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", PlayoutIdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const result = await queuePlayoutItem(id);
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);

// ── Editorial Control Routes (admin-only) ──
// Creator-scoped access arrives with the creator-enablement story. These routes
// are admin-only for the initial platform-admin editorial surface.

const ChannelIdParam = z.object({ channelId: z.string().min(1) });
const TierIdParam = z.object({ tierId: z.string().min(1) });

playoutRoutes.use("/channels/:channelId/editorial/*", requireAuth, requireRole("admin"));
playoutRoutes.use("/tiers/:tierId/editorial/*", requireAuth, requireRole("admin"));

// POST /channels/:channelId/editorial/mode — set editorial mode (auto|manual)
playoutRoutes.post(
  "/channels/:channelId/editorial/mode",
  describeRoute({
    description: "Set the editorial mode for a playout channel. Persists to DB and live-mutates the running engine.",
    tags: ["playout", "editorial"],
    responses: {
      200: { description: "Mode set" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", ChannelIdParam),
  validator("json", z.object({ mode: EditorialModeSchema })),
  async (c) => {
    const { channelId } = c.req.valid("param" as never) as { channelId: string };
    const { mode } = c.req.valid("json" as never) as { mode: "manual" | "auto" };
    const result = await editorialSetMode(channelId, mode);
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);

// POST /channels/:channelId/editorial/arm — arm or disarm the queue for take-over
playoutRoutes.post(
  "/channels/:channelId/editorial/arm",
  describeRoute({
    description: "Arm or disarm the channel queue for take-over. Transient live-only — not persisted to DB.",
    tags: ["playout", "editorial"],
    responses: {
      200: { description: "Arm state set" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", ChannelIdParam),
  validator("json", z.object({ armed: z.boolean() })),
  async (c) => {
    const { channelId } = c.req.valid("param" as never) as { channelId: string };
    const { armed } = c.req.valid("json" as never) as { armed: boolean };
    const result = await editorialArmQueue(channelId, armed, getLiquidsoapClient());
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);

// POST /channels/:channelId/editorial/take — arm + switch to auto (queue take-over)
playoutRoutes.post(
  "/channels/:channelId/editorial/take",
  describeRoute({
    description: "Arm the queue and ensure mode=auto (take-over). Persists mode=auto if needed (regenerate-restart) then arms live.",
    tags: ["playout", "editorial"],
    responses: {
      200: { description: "Take acknowledged" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", ChannelIdParam),
  async (c) => {
    const { channelId } = c.req.valid("param" as never) as { channelId: string };
    const result = await editorialTakeQueue(channelId, getLiquidsoapClient());
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);

// POST /channels/:channelId/editorial/manual — pin to a specific tier (manual mode)
playoutRoutes.post(
  "/channels/:channelId/editorial/manual",
  describeRoute({
    description: "Pin the channel to a specific editorial tier in manual mode. Persists mode=manual + tierId then regenerates and restarts.",
    tags: ["playout", "editorial"],
    responses: {
      200: { description: "Tier pinned" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", ChannelIdParam),
  validator("json", z.object({ tierId: z.string().min(1) })),
  async (c) => {
    const { channelId } = c.req.valid("param" as never) as { channelId: string };
    const { tierId } = c.req.valid("json" as never) as { tierId: string };
    const result = await editorialSetManualTier(channelId, tierId);
    if (!result.ok) throw result.error;
    return c.json({ ok: true });
  },
);
