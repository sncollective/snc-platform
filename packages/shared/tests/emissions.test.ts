import { describe, it, expect } from "vitest";

import {
  EmissionEntrySchema,
  CreateEmissionEntrySchema,
  CreateOffsetEntrySchema,
  EmissionsSummarySchema,
  EmissionsBreakdownSchema,
} from "../src/emissions.js";

describe("emissions schemas", () => {
  // ── EmissionEntrySchema ──

  describe("EmissionEntrySchema", () => {
    it("parses a valid entry", () => {
      const entry = {
        id: "abc-123",
        date: "2026-03-31",
        scope: 2,
        category: "cloud-compute",
        subcategory: "ai-development",
        source: "Claude Code",
        description: "March usage",
        amount: 7704527,
        unit: "tokens",
        co2Kg: 0.034443,
        method: "token-estimate",
        projected: false,
        metadata: { inputTokens: 8122 },
        createdAt: "2026-03-31T00:00:00.000Z",
        updatedAt: "2026-03-31T00:00:00.000Z",
      };

      const result = EmissionEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it("accepts null metadata", () => {
      const entry = {
        id: "abc-123",
        date: "2026-03-31",
        scope: 2,
        category: "cloud-compute",
        subcategory: "ai-development",
        source: "Claude Code",
        description: "March usage",
        amount: 7704527,
        unit: "tokens",
        co2Kg: 0.034443,
        method: "token-estimate",
        projected: false,
        metadata: null,
        createdAt: "2026-03-31T00:00:00.000Z",
        updatedAt: "2026-03-31T00:00:00.000Z",
      };

      const result = EmissionEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const result = EmissionEntrySchema.safeParse({ id: "abc" });
      expect(result.success).toBe(false);
    });
  });

  // ── CreateEmissionEntrySchema ──

  describe("CreateEmissionEntrySchema", () => {
    const validBody = {
      date: "2026-03-31",
      scope: 2,
      category: "cloud-compute",
      subcategory: "ai-development",
      source: "Claude Code",
      description: "March usage",
      amount: 100,
      unit: "tokens",
      co2Kg: 0.5,
      method: "token-estimate",
    };

    it("parses a valid create body", () => {
      const result = CreateEmissionEntrySchema.safeParse(validBody);
      expect(result.success).toBe(true);
    });

    it("rejects invalid date format", () => {
      const result = CreateEmissionEntrySchema.safeParse({
        ...validBody,
        date: "March 31, 2026",
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative amount", () => {
      const result = CreateEmissionEntrySchema.safeParse({
        ...validBody,
        amount: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects zero amount", () => {
      const result = CreateEmissionEntrySchema.safeParse({
        ...validBody,
        amount: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative co2Kg", () => {
      const result = CreateEmissionEntrySchema.safeParse({
        ...validBody,
        co2Kg: -0.5,
      });
      expect(result.success).toBe(false);
    });

    it("accepts zero co2Kg", () => {
      const result = CreateEmissionEntrySchema.safeParse({
        ...validBody,
        co2Kg: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty category", () => {
      const result = CreateEmissionEntrySchema.safeParse({
        ...validBody,
        category: "",
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional metadata", () => {
      const result = CreateEmissionEntrySchema.safeParse({
        ...validBody,
        metadata: { models: ["claude-opus-4-6"] },
      });
      expect(result.success).toBe(true);
    });
  });

  // ── CreateOffsetEntrySchema ──

  describe("CreateOffsetEntrySchema", () => {
    const validOffset = {
      date: "2026-03-31",
      source: "Gold Standard VER",
      description: "Voluntary carbon offset",
      amount: 1,
      unit: "credits",
      co2Kg: 10,
      method: "verified-offset",
    };

    it("parses a valid offset body", () => {
      const result = CreateOffsetEntrySchema.safeParse(validOffset);
      expect(result.success).toBe(true);
    });

    it("rejects negative co2Kg", () => {
      const result = CreateOffsetEntrySchema.safeParse({
        ...validOffset,
        co2Kg: -5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid date format", () => {
      const result = CreateOffsetEntrySchema.safeParse({
        ...validOffset,
        date: "March 31",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty source", () => {
      const result = CreateOffsetEntrySchema.safeParse({
        ...validOffset,
        source: "",
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional metadata", () => {
      const result = CreateOffsetEntrySchema.safeParse({
        ...validOffset,
        metadata: { registry: "Gold Standard" },
      });
      expect(result.success).toBe(true);
    });
  });

  // ── EmissionsSummarySchema ──

  describe("EmissionsSummarySchema", () => {
    it("parses a valid summary with gross/offset/net and projection fields", () => {
      const result = EmissionsSummarySchema.safeParse({
        grossCo2Kg: 0.034443,
        offsetCo2Kg: 0.01,
        netCo2Kg: 0.024,
        entryCount: 1,
        latestDate: "2026-03-31",
        projectedGrossCo2Kg: 1168,
        doubleOffsetTargetCo2Kg: 2336,
        additionalOffsetCo2Kg: 1336,
      });
      expect(result.success).toBe(true);
    });

    it("accepts null latestDate", () => {
      const result = EmissionsSummarySchema.safeParse({
        grossCo2Kg: 0,
        offsetCo2Kg: 0,
        netCo2Kg: 0,
        entryCount: 0,
        latestDate: null,
        projectedGrossCo2Kg: 0,
        doubleOffsetTargetCo2Kg: 0,
        additionalOffsetCo2Kg: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── EmissionsBreakdownSchema ──

  describe("EmissionsBreakdownSchema", () => {
    it("parses a valid breakdown with offset and projection fields", () => {
      const result = EmissionsBreakdownSchema.safeParse({
        summary: {
          grossCo2Kg: 0.034443,
          offsetCo2Kg: 0.01,
          netCo2Kg: 0.024,
          entryCount: 1,
          latestDate: "2026-03-31",
          projectedGrossCo2Kg: 1168,
          doubleOffsetTargetCo2Kg: 2336,
          additionalOffsetCo2Kg: 1336,
        },
        byScope: [{ scope: 2, co2Kg: 0.034443, entryCount: 1 }],
        byCategory: [
          { category: "cloud-compute", co2Kg: 0.034443, entryCount: 1 },
        ],
        monthly: [{ month: "2026-03", actualCo2Kg: 0.034443, projectedCo2Kg: 0, offsetCo2Kg: 0.01 }],
        entries: [
          {
            id: "abc",
            date: "2026-03-31",
            scope: 2,
            category: "cloud-compute",
            subcategory: "ai-development",
            source: "Claude Code",
            description: "Test",
            amount: 100,
            unit: "tokens",
            co2Kg: 0.034443,
            method: "token-estimate",
            projected: false,
            metadata: null,
            createdAt: "2026-03-31T00:00:00.000Z",
            updatedAt: "2026-03-31T00:00:00.000Z",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty arrays", () => {
      const result = EmissionsBreakdownSchema.safeParse({
        summary: {
          grossCo2Kg: 0,
          offsetCo2Kg: 0,
          netCo2Kg: 0,
          entryCount: 0,
          latestDate: null,
          projectedGrossCo2Kg: 0,
          doubleOffsetTargetCo2Kg: 0,
          additionalOffsetCo2Kg: 0,
        },
        byScope: [],
        byCategory: [],
        monthly: [],
        entries: [],
      });
      expect(result.success).toBe(true);
    });
  });
});
