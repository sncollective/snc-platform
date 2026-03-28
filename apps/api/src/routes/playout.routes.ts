import { Hono } from "hono";
import { validator } from "hono-openapi";

import {
  CreatePlayoutItemSchema,
  UpdatePlayoutItemSchema,
  ReorderPlayoutItemsSchema,
} from "@snc/shared";
import type { CreatePlayoutItem, UpdatePlayoutItem, ReorderPlayoutItems } from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import {
  listPlayoutItems,
  getPlayoutItem,
  createPlayoutItem,
  updatePlayoutItem,
  deletePlayoutItem,
  reorderPlayoutItems,
  getPlayoutStatus,
  queuePlayoutItem,
  skipCurrentTrack,
} from "../services/playout.js";

export const playoutRoutes = new Hono<AuthEnv>();

// All playout routes require admin role
playoutRoutes.use("*", requireAuth, requireRole("admin"));

// GET /items — list all playout items
playoutRoutes.get("/items", async (c) => {
  const items = await listPlayoutItems();
  return c.json({ items });
});

// GET /items/:id — get a single playout item
playoutRoutes.get("/items/:id", async (c) => {
  const result = await getPlayoutItem(c.req.param("id"));
  if (!result.ok) throw result.error;
  return c.json(result.value);
});

// POST /items — create a new playout item
playoutRoutes.post(
  "/items",
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
  validator("json", UpdatePlayoutItemSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as UpdatePlayoutItem;
    const result = await updatePlayoutItem(c.req.param("id"), body);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

// DELETE /items/:id — delete a playout item
playoutRoutes.delete("/items/:id", async (c) => {
  const result = await deletePlayoutItem(c.req.param("id"));
  if (!result.ok) throw result.error;
  return c.json({ ok: true });
});

// PUT /items/reorder — reorder playout items
playoutRoutes.put(
  "/items/reorder",
  validator("json", ReorderPlayoutItemsSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as ReorderPlayoutItems;
    const result = await reorderPlayoutItems(body.orderedIds);
    if (!result.ok) throw result.error;
    return c.json({ items: result.value });
  },
);

// GET /status — now-playing + queue state (admin fast-poll endpoint)
playoutRoutes.get("/status", async (c) => {
  const status = await getPlayoutStatus();
  return c.json(status);
});

// POST /skip — skip current track
playoutRoutes.post("/skip", async (c) => {
  const result = await skipCurrentTrack();
  if (!result.ok) throw result.error;
  return c.json({ ok: true });
});

// POST /queue/:id — queue a playout item to play next
playoutRoutes.post("/queue/:id", async (c) => {
  const result = await queuePlayoutItem(c.req.param("id"));
  if (!result.ok) throw result.error;
  return c.json({ ok: true });
});
