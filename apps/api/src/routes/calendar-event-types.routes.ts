import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq } from "drizzle-orm";

import {
  EventTypesResponseSchema,
  CreateCustomEventTypeSchema,
  DEFAULT_EVENT_TYPES,
  DEFAULT_EVENT_TYPE_LABELS,
  ConflictError,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { customEventTypes } from "../db/schema/calendar.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
} from "../lib/openapi-errors.js";

// ── Public API ──

export const calendarEventTypeRoutes = new Hono<AuthEnv>();

// ── GET /event-types — List available event types ──

calendarEventTypeRoutes.get(
  "/event-types",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "List all available event types (defaults merged with custom)",
    tags: ["calendar"],
    responses: {
      200: {
        description: "List of event types",
        content: {
          "application/json": {
            schema: resolver(EventTypesResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const customRows = await db.select({ id: customEventTypes.id, label: customEventTypes.label, slug: customEventTypes.slug }).from(customEventTypes);

    const defaultItems = DEFAULT_EVENT_TYPES.map((slug) => ({
      id: `default:${slug}`,
      label: DEFAULT_EVENT_TYPE_LABELS[slug] ?? slug,
      slug,
    }));

    const customSlugs = new Set(customRows.map((r) => r.slug));
    const filteredDefaults = defaultItems.filter(
      (d) => !customSlugs.has(d.slug),
    );

    const customItems = customRows.map((r) => ({
      id: r.id,
      label: r.label,
      slug: r.slug,
    }));

    const allItems = [...filteredDefaults, ...customItems].sort((a, b) =>
      a.slug === "other" ? 1 : b.slug === "other" ? -1 : 0,
    );

    return c.json({ items: allItems });
  },
);

// ── POST /event-types — Create custom event type ──

calendarEventTypeRoutes.post(
  "/event-types",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description: "Create a custom event type",
    tags: ["calendar"],
    responses: {
      201: {
        description: "Custom event type created",
        content: {
          "application/json": {
            schema: resolver(EventTypesResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateCustomEventTypeSchema),
  async (c) => {
    const { label } = c.req.valid("json");
    const user = c.get("user");

    const slug = label
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // Check if slug conflicts with default types
    if ((DEFAULT_EVENT_TYPES as readonly string[]).includes(slug)) {
      throw new ConflictError(
        `Event type with slug "${slug}" already exists as a default type`,
      );
    }

    // Check if slug already exists in DB
    const [existing] = await db
      .select()
      .from(customEventTypes)
      .where(eq(customEventTypes.slug, slug));

    if (existing) {
      throw new ConflictError(
        `Event type with slug "${slug}" already exists`,
      );
    }

    const id = randomUUID();
    const now = new Date();

    const [created] = await db
      .insert(customEventTypes)
      .values({
        id,
        label,
        slug,
        createdBy: user.id,
        createdAt: now,
      })
      .returning();

    return c.json(
      { items: [{ id: created!.id, label: created!.label, slug: created!.slug }] },
      201,
    );
  },
);
