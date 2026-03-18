import type {
  EmissionsSummary,
  EmissionsBreakdown,
  EmissionEntry,
} from "@snc/shared";

// ── Web-level Fixtures (API response shapes with ISO strings) ──

export const makeMockEmissionEntry = (
  overrides?: Partial<EmissionEntry>,
): EmissionEntry => ({
  id: "13be9694-df8c-4c03-ac72-acde4901563a",
  date: "2026-03-31",
  scope: 2,
  category: "cloud-compute",
  subcategory: "ai-development",
  source: "Claude Code (claude-opus-4-6)",
  description: "March 2026 Claude Code development usage",
  amount: 7704527,
  unit: "tokens",
  co2Kg: 0.034443,
  method: "token-estimate",
  projected: false,
  metadata: {
    inputTokens: 8122,
    outputTokens: 36722,
    costUSD: 4.97,
  },
  createdAt: "2026-03-31T00:00:00.000Z",
  updatedAt: "2026-03-31T00:00:00.000Z",
  ...overrides,
});

export const makeMockEmissionsSummary = (
  overrides?: Partial<EmissionsSummary>,
): EmissionsSummary => ({
  grossCo2Kg: 0.034443,
  offsetCo2Kg: 0.01,
  netCo2Kg: 0.024,
  entryCount: 1,
  latestDate: "2026-03-31",
  projectedGrossCo2Kg: 1168,
  doubleOffsetTargetCo2Kg: 2336,
  additionalOffsetCo2Kg: 1336,
  ...overrides,
});

export const makeMockEmissionsBreakdown = (
  overrides?: Partial<EmissionsBreakdown>,
): EmissionsBreakdown => ({
  summary: makeMockEmissionsSummary(),
  byScope: [{ scope: 2, co2Kg: 0.034443, entryCount: 1 }],
  byCategory: [
    { category: "cloud-compute", co2Kg: 0.034443, entryCount: 1 },
  ],
  monthly: [{ month: "2026-03", actualCo2Kg: 0.034443, projectedCo2Kg: 0, offsetCo2Kg: 0.01 }],
  entries: [makeMockEmissionEntry()],
  ...overrides,
});
