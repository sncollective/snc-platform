import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { randomUUID } from "node:crypto";

import {
  EmissionEntrySchema,
  CreateEmissionEntrySchema,
  CreateOffsetEntrySchema,
  EmissionsSummarySchema,
  EmissionsBreakdownSchema,
  type EmissionEntry,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { emissions } from "../db/schema/emission.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403 } from "../lib/openapi-errors.js";
import { fetchEmissionsSummary, fetchEmissionsBreakdown } from "../services/emissions.js";

// ── Private Types ──

type EmissionRow = typeof emissions.$inferSelect;

// ── Private Helpers ──

function stripSessionDates(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const { sessionDates, ...rest } = metadata;
  return Object.keys(rest).length > 0 ? rest : null;
}

function toEntryResponse(row: EmissionRow): EmissionEntry {
  return {
    id: row.id,
    date: row.date,
    scope: row.scope,
    category: row.category,
    subcategory: row.subcategory,
    source: row.source,
    description: row.description,
    amount: row.amount,
    unit: row.unit,
    co2Kg: row.co2Kg,
    method: row.method,
    projected: row.projected,
    metadata: stripSessionDates(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Public API ──

export const emissionsRoutes = new Hono<AuthEnv>();

emissionsRoutes.get(
  "/summary",
  describeRoute({
    description: "Emissions summary (total CO2, entry count, latest date)",
    tags: ["emissions"],
    responses: {
      200: {
        description: "Emissions summary",
        content: {
          "application/json": { schema: resolver(EmissionsSummarySchema) },
        },
      },
    },
  }),
  async (c) => {
    return c.json(await fetchEmissionsSummary());
  },
);

emissionsRoutes.get(
  "/breakdown",
  describeRoute({
    description: "Full emissions breakdown by scope, category, and month",
    tags: ["emissions"],
    responses: {
      200: {
        description: "Emissions breakdown",
        content: {
          "application/json": { schema: resolver(EmissionsBreakdownSchema) },
        },
      },
    },
  }),
  async (c) => {
    const breakdown = await fetchEmissionsBreakdown();
    return c.json({ ...breakdown, entries: breakdown.entries.map(toEntryResponse) });
  },
);

emissionsRoutes.post(
  "/entries",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Create a new emission entry",
    tags: ["emissions"],
    responses: {
      201: {
        description: "Created emission entry",
        content: {
          "application/json": { schema: resolver(EmissionEntrySchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateEmissionEntrySchema),
  async (c) => {
    const body = c.req.valid("json");
    const id = randomUUID();
    const now = new Date();

    const [row] = await db
      .insert(emissions)
      .values({
        id,
        date: body.date,
        scope: body.scope,
        category: body.category,
        subcategory: body.subcategory,
        source: body.source,
        description: body.description,
        amount: body.amount,
        unit: body.unit,
        co2Kg: body.co2Kg,
        method: body.method,
        projected: body.projected,
        metadata: body.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(toEntryResponse(row!), 201);
  },
);

emissionsRoutes.post(
  "/offsets",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Create a new carbon offset entry",
    tags: ["emissions"],
    responses: {
      201: {
        description: "Created offset entry",
        content: {
          "application/json": { schema: resolver(EmissionEntrySchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateOffsetEntrySchema),
  async (c) => {
    const body = c.req.valid("json");
    const id = randomUUID();
    const now = new Date();

    const [row] = await db
      .insert(emissions)
      .values({
        id,
        date: body.date,
        scope: 0,
        category: "offset",
        subcategory: "offset",
        source: body.source,
        description: body.description,
        amount: body.amount,
        unit: body.unit,
        co2Kg: -Math.abs(body.co2Kg),
        method: body.method,
        metadata: body.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(toEntryResponse(row!), 201);
  },
);
