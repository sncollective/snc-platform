import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";

import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  UpdateNotificationPreferenceSchema,
} from "@snc/shared";

import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { notificationPreferences } from "../db/schema/notification.schema.js";
import { ERROR_401 } from "../lib/openapi-errors.js";

// ── Route ──

export const notificationPreferencesRoutes = new Hono<AuthEnv>();

/** Get all notification preferences for the current user. */
notificationPreferencesRoutes.get(
  "/",
  requireAuth,
  describeRoute({
    tags: ["notifications"],
    summary: "Get notification preferences",
    responses: { 200: { description: "Preferences list" }, 401: ERROR_401 },
  }),
  async (c) => {
    const user = c.get("user");

    const saved = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id));

    // Build full matrix with defaults (all enabled)
    const prefs = NOTIFICATION_EVENT_TYPES.flatMap((eventType) =>
      NOTIFICATION_CHANNELS.map((channel) => {
        const existing = saved.find(
          (p) => p.eventType === eventType && p.channel === channel,
        );
        return {
          eventType,
          channel,
          enabled: existing?.enabled ?? true,
        };
      }),
    );

    return c.json({ preferences: prefs });
  },
);

/** Update a single notification preference. */
notificationPreferencesRoutes.put(
  "/",
  requireAuth,
  describeRoute({
    tags: ["notifications"],
    summary: "Update notification preference",
    responses: { 200: { description: "Updated preference" }, 401: ERROR_401 },
  }),
  validator("json", UpdateNotificationPreferenceSchema),
  async (c) => {
    const user = c.get("user");
    const { eventType, channel, enabled } = c.req.valid("json");

    await db
      .insert(notificationPreferences)
      .values({
        userId: user.id,
        eventType,
        channel,
        enabled,
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.eventType,
          notificationPreferences.channel,
        ],
        set: { enabled, updatedAt: new Date() },
      });

    return c.json({ eventType, channel, enabled });
  },
);
