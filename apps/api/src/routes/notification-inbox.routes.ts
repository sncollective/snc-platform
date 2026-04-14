import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import {
  InboxNotificationsQuerySchema,
  InboxNotificationsResponseSchema,
  UnreadCountResponseSchema,
} from "@snc/shared";

import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401 } from "../lib/openapi-errors.js";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "../services/notification-inbox.js";

// ── Param Schemas ──

const NotificationIdParam = z.object({ id: z.string().min(1) });

// ── Public API ──

/** In-app notification inbox routes. All routes require authentication. */
export const notificationInboxRoutes = new Hono<AuthEnv>();

// ── GET /notifications ──

notificationInboxRoutes.get(
  "/",
  requireAuth,
  describeRoute({
    description: "Get paginated notifications for the current user (newest first)",
    tags: ["notifications"],
    responses: {
      200: {
        description: "Paginated notification list",
        content: {
          "application/json": {
            schema: resolver(InboxNotificationsResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
    },
  }),
  validator("query", InboxNotificationsQuerySchema),
  async (c) => {
    const user = c.get("user");
    const { before, limit } = c.req.valid("query" as never) as {
      before?: string;
      limit: number;
    };

    const result = await getNotifications({
      userId: user.id,
      limit,
      ...(before !== undefined && { before }),
    });
    if (!result.ok) throw result.error;

    return c.json(result.value);
  },
);

// ── GET /notifications/unread-count ──

notificationInboxRoutes.get(
  "/unread-count",
  requireAuth,
  describeRoute({
    description: "Get the current user's unread notification count",
    tags: ["notifications"],
    responses: {
      200: {
        description: "Unread count",
        content: {
          "application/json": {
            schema: resolver(UnreadCountResponseSchema),
          },
        },
      },
      401: ERROR_401,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const result = await getUnreadCount(user.id);
    if (!result.ok) throw result.error;

    return c.json({ count: result.value });
  },
);

// ── PATCH /notifications/:id/read ──

notificationInboxRoutes.patch(
  "/:id/read",
  requireAuth,
  describeRoute({
    description: "Mark a single notification as read",
    tags: ["notifications"],
    responses: {
      200: { description: "Marked as read" },
      401: ERROR_401,
    },
  }),
  validator("param", NotificationIdParam),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param" as never) as { id: string };

    const result = await markRead(user.id, id);
    if (!result.ok) throw result.error;

    return c.json({ ok: true });
  },
);

// ── POST /notifications/read-all ──

notificationInboxRoutes.post(
  "/read-all",
  requireAuth,
  describeRoute({
    description: "Mark all notifications as read for the current user",
    tags: ["notifications"],
    responses: {
      200: { description: "All notifications marked as read" },
      401: ERROR_401,
    },
  }),
  async (c) => {
    const user = c.get("user");

    const result = await markAllRead(user.id);
    if (!result.ok) throw result.error;

    return c.json({ ok: true });
  },
);
