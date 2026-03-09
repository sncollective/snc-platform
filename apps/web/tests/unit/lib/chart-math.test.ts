import { describe, it, expect } from "vitest";

import {
  computeChartLines,
  formatCo2Kg,
  formatMonthLabel,
  formatMonthShort,
  niceNum,
  niceTicks,
} from "../../../src/lib/chart-math.js";

describe("computeChartLines", () => {
  it("computes cumulative series for all 4 lines", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 10, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 5, projectedCo2Kg: 2, offsetCo2Kg: 0 },
      { month: "2026-03", actualCo2Kg: 0, projectedCo2Kg: 3, offsetCo2Kg: 8 },
    ];
    const lines = computeChartLines(data);
    expect(lines.actualUse).toEqual([10, 15, 15]);
    expect(lines.projectedUse).toEqual([10, 17, 20]);
    expect(lines.offsets).toEqual([0, 0, 8]);
    expect(lines.net).toEqual([10, 17, 12]);
  });

  it("returns empty arrays for empty input", () => {
    const lines = computeChartLines([]);
    expect(lines.months).toEqual([]);
    expect(lines.net).toEqual([]);
  });

  it("net goes negative when offsets exceed projected use", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 2, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 0, projectedCo2Kg: 0, offsetCo2Kg: 5 },
    ];
    const lines = computeChartLines(data);
    expect(lines.net[1]).toBe(-3);
  });
});

describe("formatCo2Kg", () => {
  it("formats zero", () => {
    expect(formatCo2Kg(0)).toBe("0 kg");
  });

  it("formats very small values with 3 decimals", () => {
    expect(formatCo2Kg(0.05)).toBe("0.050 kg");
  });

  it("formats small values with 1 decimal", () => {
    expect(formatCo2Kg(3.7)).toBe("3.7 kg");
  });

  it("formats large values as integers", () => {
    expect(formatCo2Kg(42.3)).toBe("42 kg");
  });

  it("formats negative values correctly", () => {
    expect(formatCo2Kg(-0.05)).toBe("-0.050 kg");
    expect(formatCo2Kg(-3.7)).toBe("-3.7 kg");
    expect(formatCo2Kg(-42.3)).toBe("-42 kg");
  });
});

describe("formatMonthLabel", () => {
  it("formats YYYY-MM as 'Mon YYYY'", () => {
    expect(formatMonthLabel("2026-01")).toBe("Jan 2026");
    expect(formatMonthLabel("2026-12")).toBe("Dec 2026");
  });

  it("handles edge cases gracefully", () => {
    expect(formatMonthLabel("2026-00")).toBe(" 2026");
    expect(formatMonthLabel("2026-13")).toBe(" 2026");
  });
});

describe("formatMonthShort", () => {
  it("formats YYYY-MM as \"Mon 'YY\"", () => {
    expect(formatMonthShort("2026-01")).toBe("Jan '26");
    expect(formatMonthShort("2026-12")).toBe("Dec '26");
  });
});

describe("niceNum", () => {
  it("rounds to nearest nice number", () => {
    expect(niceNum(11, true)).toBe(10);
    expect(niceNum(35, true)).toBe(50);
    expect(niceNum(75, true)).toBe(100);
  });

  it("ceiling to nearest nice number", () => {
    expect(niceNum(11, false)).toBe(20);
    expect(niceNum(35, false)).toBe(50);
    expect(niceNum(75, false)).toBe(100);
  });
});

describe("niceTicks", () => {
  it("returns nice min/max/step for a range", () => {
    const result = niceTicks(0, 100, 5);
    expect(result.min).toBeLessThanOrEqual(0);
    expect(result.max).toBeGreaterThanOrEqual(100);
    expect(result.step).toBeGreaterThan(0);
  });

  it("handles equal min and max", () => {
    const result = niceTicks(5, 5, 5);
    expect(result.min).toBeLessThan(5);
    expect(result.max).toBeGreaterThan(5);
    expect(result.step).toBeGreaterThan(0);
  });

  it("handles zero min and max", () => {
    const result = niceTicks(0, 0, 5);
    expect(result.min).toBeLessThan(0);
    expect(result.max).toBeGreaterThan(0);
  });

  it("handles negative ranges", () => {
    const result = niceTicks(-50, -10, 5);
    expect(result.min).toBeLessThanOrEqual(-50);
    expect(result.max).toBeGreaterThanOrEqual(-10);
    expect(result.step).toBeGreaterThan(0);
  });
});
