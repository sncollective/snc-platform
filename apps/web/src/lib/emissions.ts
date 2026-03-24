import type { EmissionsSummary, EmissionsBreakdown } from "@snc/shared";

import { apiGet } from "./fetch-utils.js";

// ── Public API ──

/** Fetch aggregate CO2 emissions summary. */
export async function fetchEmissionsSummary(): Promise<EmissionsSummary> {
  return apiGet<EmissionsSummary>("/api/emissions/summary");
}

/** Fetch monthly emissions breakdown by source. */
export async function fetchEmissionsBreakdown(): Promise<EmissionsBreakdown> {
  return apiGet<EmissionsBreakdown>("/api/emissions/breakdown");
}
