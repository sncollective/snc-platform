import { describe, it, expect } from "vitest";

import { toISO, toISOOrNull } from "../../src/lib/response-helpers.js";

// ── toISO ──

describe("toISO", () => {
  it("converts a Date to an ISO 8601 string", () => {
    const date = new Date("2025-06-15T12:00:00.000Z");
    expect(toISO(date)).toBe("2025-06-15T12:00:00.000Z");
  });

  it("returns the same value as Date.toISOString()", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    expect(toISO(date)).toBe(date.toISOString());
  });

  it("handles epoch zero", () => {
    expect(toISO(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
  });
});

// ── toISOOrNull ──

describe("toISOOrNull", () => {
  it("converts a Date to an ISO 8601 string", () => {
    const date = new Date("2025-03-01T09:30:00.000Z");
    expect(toISOOrNull(date)).toBe("2025-03-01T09:30:00.000Z");
  });

  it("returns null when given null", () => {
    expect(toISOOrNull(null)).toBeNull();
  });

  it("returns the same value as Date.toISOString() for non-null input", () => {
    const date = new Date("2026-12-31T23:59:59.999Z");
    expect(toISOOrNull(date)).toBe(date.toISOString());
  });
});
