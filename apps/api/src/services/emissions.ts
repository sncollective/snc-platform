import { and, count, sum, sql, desc, eq, ne } from "drizzle-orm";

import { type EmissionsSummary } from "@snc/shared";

import { db } from "../db/connection.js";
import { emissions } from "../db/schema/emission.schema.js";

// ── Private: Shared SQL Expression Builders ──

const actualSumExpr = sql<string>`sum(case when ${emissions.scope} != 0 and ${emissions.projected} = false then ${emissions.co2Kg} else 0 end)`;
const projectedSumExpr = sql<string>`sum(case when ${emissions.scope} != 0 and ${emissions.projected} = true then ${emissions.co2Kg} else 0 end)`;
const offsetSumExpr = sql<string>`sum(case when ${emissions.scope} = 0 then abs(${emissions.co2Kg}) else 0 end)`;

// ── Public Types ──

export interface EmissionsBreakdownResult {
  summary: EmissionsSummary;
  byScope: Array<{ scope: number; co2Kg: number; entryCount: number }>;
  byCategory: Array<{ category: string; co2Kg: number; entryCount: number }>;
  monthly: Array<{ month: string; actualCo2Kg: number; projectedCo2Kg: number; offsetCo2Kg: number }>;
  entries: Array<typeof emissions.$inferSelect>;
}

// ── Public API ──

export async function fetchEmissionsSummary(): Promise<EmissionsSummary> {
  const entryCountExpr = sql<number>`count(case when ${emissions.scope} != 0 and ${emissions.projected} = false then 1 end)`;
  const latestDateExpr = sql<string | null>`max(case when ${emissions.scope} != 0 and ${emissions.projected} = false then ${emissions.date} end)`;

  const [row] = await db
    .select({
      grossCo2Kg: actualSumExpr,
      projectedCo2Kg: projectedSumExpr,
      offsetCo2Kg: offsetSumExpr,
      entryCount: entryCountExpr,
      latestDate: latestDateExpr,
    })
    .from(emissions);

  const grossCo2Kg = Number(row?.grossCo2Kg ?? 0);
  const projectedGrossAdd = Number(row?.projectedCo2Kg ?? 0);
  const offsetCo2Kg = Number(row?.offsetCo2Kg ?? 0);
  const netCo2Kg = grossCo2Kg - offsetCo2Kg;
  const projectedGrossCo2Kg = grossCo2Kg + projectedGrossAdd;
  const doubleOffsetTargetCo2Kg = projectedGrossCo2Kg * 2;
  const additionalOffsetCo2Kg = Math.max(0, doubleOffsetTargetCo2Kg - offsetCo2Kg);

  return {
    grossCo2Kg,
    offsetCo2Kg,
    netCo2Kg,
    entryCount: Number(row?.entryCount ?? 0),
    latestDate: row?.latestDate ?? null,
    projectedGrossCo2Kg,
    doubleOffsetTargetCo2Kg,
    additionalOffsetCo2Kg,
  };
}

export async function fetchEmissionsBreakdown(): Promise<EmissionsBreakdownResult> {
  const monthCol = sql<string>`substring(${emissions.date} from 1 for 7)`;

  const [summary, byScope, byCategory, monthly, entries] = await Promise.all([
    fetchEmissionsSummary(),
    db
      .select({
        scope: emissions.scope,
        co2Kg: sum(emissions.co2Kg),
        entryCount: count(),
      })
      .from(emissions)
      .where(and(ne(emissions.scope, 0), eq(emissions.projected, false)))
      .groupBy(emissions.scope),
    db
      .select({
        category: emissions.category,
        co2Kg: sum(emissions.co2Kg),
        entryCount: count(),
      })
      .from(emissions)
      .where(and(ne(emissions.scope, 0), eq(emissions.projected, false)))
      .groupBy(emissions.category),
    db
      .select({
        month: monthCol,
        actualCo2Kg: actualSumExpr,
        projectedCo2Kg: projectedSumExpr,
        offsetCo2Kg: offsetSumExpr,
      })
      .from(emissions)
      .groupBy(monthCol)
      .orderBy(monthCol),
    db
      .select()
      .from(emissions)
      .orderBy(desc(emissions.date)),
  ]);

  return {
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
    entries,
  };
}
