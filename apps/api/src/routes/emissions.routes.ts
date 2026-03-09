import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { and, count, sum, max, sql, desc, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  EmissionEntrySchema,
  CreateEmissionEntrySchema,
  CreateOffsetEntrySchema,
  EmissionsSummarySchema,
  EmissionsBreakdownSchema,
  type EmissionsSummary,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { emissions } from "../db/schema/emission.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403 } from "./openapi-errors.js";

// ── Private Helpers ──

interface EmissionRow {
  id: string;
  date: string;
  scope: number;
  category: string;
  subcategory: string;
  source: string;
  description: string;
  amount: number;
  unit: string;
  co2Kg: number;
  method: string;
  projected: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

function stripSessionDates(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const { sessionDates, ...rest } = metadata;
  return Object.keys(rest).length > 0 ? rest : null;
}

function toEntryResponse(row: EmissionRow) {
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

async function fetchEmissionsSummary(): Promise<EmissionsSummary> {
  const [grossRow] = await db
    .select({
      co2Kg: sum(emissions.co2Kg),
      entryCount: count(),
      latestDate: max(emissions.date),
    })
    .from(emissions)
    .where(and(ne(emissions.scope, 0), eq(emissions.projected, false)));

  const [projectedRow] = await db
    .select({
      co2Kg: sum(emissions.co2Kg),
    })
    .from(emissions)
    .where(and(ne(emissions.scope, 0), eq(emissions.projected, true)));

  const [offsetRow] = await db
    .select({
      co2Kg: sum(emissions.co2Kg),
    })
    .from(emissions)
    .where(eq(emissions.scope, 0));

  const grossCo2Kg = Number(grossRow?.co2Kg ?? 0);
  const projectedGrossAdd = Number(projectedRow?.co2Kg ?? 0);
  const offsetCo2Kg = Math.abs(Number(offsetRow?.co2Kg ?? 0));
  const netCo2Kg = grossCo2Kg - offsetCo2Kg;
  const projectedGrossCo2Kg = grossCo2Kg + projectedGrossAdd;
  const doubleOffsetTargetCo2Kg = projectedGrossCo2Kg * 2;
  const additionalOffsetCo2Kg = Math.max(0, doubleOffsetTargetCo2Kg - offsetCo2Kg);

  return {
    totalCo2Kg: netCo2Kg,
    grossCo2Kg,
    offsetCo2Kg,
    netCo2Kg,
    entryCount: grossRow?.entryCount ?? 0,
    latestDate: grossRow?.latestDate ?? null,
    projectedGrossCo2Kg,
    doubleOffsetTargetCo2Kg,
    additionalOffsetCo2Kg,
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
    const summary = await fetchEmissionsSummary();
    return c.json(summary);
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
    const summary = await fetchEmissionsSummary();

    const byScope = await db
      .select({
        scope: emissions.scope,
        co2Kg: sum(emissions.co2Kg),
        entryCount: count(),
      })
      .from(emissions)
      .where(and(ne(emissions.scope, 0), eq(emissions.projected, false)))
      .groupBy(emissions.scope);

    const byCategory = await db
      .select({
        category: emissions.category,
        co2Kg: sum(emissions.co2Kg),
        entryCount: count(),
      })
      .from(emissions)
      .where(and(ne(emissions.scope, 0), eq(emissions.projected, false)))
      .groupBy(emissions.category);

    const monthCol = sql<string>`substring(${emissions.date} from 1 for 7)`;
    const actualSumExpr = sql<string>`sum(case when ${emissions.scope} != 0 and ${emissions.projected} = false then ${emissions.co2Kg} else 0 end)`;
    const projectedSumExpr = sql<string>`sum(case when ${emissions.scope} != 0 and ${emissions.projected} = true then ${emissions.co2Kg} else 0 end)`;
    const offsetSumExpr = sql<string>`sum(case when ${emissions.scope} = 0 then abs(${emissions.co2Kg}) else 0 end)`;

    const monthly = await db
      .select({
        month: monthCol,
        actualCo2Kg: actualSumExpr,
        projectedCo2Kg: projectedSumExpr,
        offsetCo2Kg: offsetSumExpr,
      })
      .from(emissions)
      .groupBy(monthCol)
      .orderBy(monthCol);

    const entries = await db
      .select()
      .from(emissions)
      .orderBy(desc(emissions.date));

    return c.json({
      summary,
      byScope: byScope.map((r) => ({
        scope: r.scope,
        co2Kg: Number(r.co2Kg ?? 0),
        entryCount: r.entryCount,
      })),
      byCategory: byCategory.map((r) => ({
        category: r.category,
        co2Kg: Number(r.co2Kg ?? 0),
        entryCount: r.entryCount,
      })),
      monthly: monthly.map((r) => ({
        month: r.month,
        actualCo2Kg: Number(r.actualCo2Kg ?? 0),
        projectedCo2Kg: Number(r.projectedCo2Kg ?? 0),
        offsetCo2Kg: Number(r.offsetCo2Kg ?? 0),
      })),
      entries: entries.map(toEntryResponse),
    });
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
      200: {
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

    return c.json(toEntryResponse(row!));
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
      200: {
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

    return c.json(toEntryResponse(row!));
  },
);
