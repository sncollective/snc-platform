import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  formatRelativeDate,
  formatDate,
  formatTime,
  formatPrice,
  formatInterval,
  formatIntervalShort,
  formatCo2,
  getUserTimezone,
  toLocalDateKey,
  formatLocalDate,
} from "../../../src/lib/format.js";

const NOW = new Date("2026-02-26T12:00:00.000Z");

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for dates less than 60 seconds ago", () => {
    const thirtySecondsAgo = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeDate(thirtySecondsAgo)).toBe("just now");
  });

  it("returns natural language for dates less than 60 minutes ago", () => {
    const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinutesAgo)).toBe("5 minutes ago");
  });

  it("returns natural language for dates less than 24 hours ago", () => {
    const threeHoursAgo = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(threeHoursAgo)).toBe("about 3 hours ago");
  });

  it("returns natural language for dates less than 7 days ago", () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe("2 days ago");
  });

  it("returns natural language for dates less than 30 days ago", () => {
    const oneWeekAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(oneWeekAgo)).toBe("7 days ago");
    expect(formatRelativeDate(twoWeeksAgo)).toBe("14 days ago");
  });

  it("returns formatted date for dates 30 or more days ago", () => {
    // 45 days before 2026-02-26 = 2026-01-12
    const fortyFiveDaysAgo = new Date(NOW.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fortyFiveDaysAgo)).toBe("Jan 12, 2026");
  });

  it("returns 'just now' for future dates", () => {
    const tenSecondsFromNow = new Date(NOW.getTime() + 10 * 1000).toISOString();
    expect(formatRelativeDate(tenSecondsFromNow)).toBe("just now");
  });
});

describe("formatDate", () => {
  it("formats a date as 'Mon DD, YYYY'", () => {
    expect(formatDate("2026-02-26T00:00:00.000Z")).toBe("Feb 26, 2026");
  });

  it("formats a different date correctly", () => {
    expect(formatDate("2025-12-25T12:00:00.000Z")).toBe("Dec 25, 2025");
  });
});

describe("formatCo2", () => {
  it("returns '0 g' for zero", () => {
    expect(formatCo2(0)).toBe("0 g");
  });

  it("returns grams for small positive values", () => {
    expect(formatCo2(0.5)).toBe("500.0 g");
  });

  it("returns kg for values >= 1", () => {
    expect(formatCo2(1)).toBe("1.0 kg");
    expect(formatCo2(42.7)).toBe("42.7 kg");
  });

  it("returns kg for negative values with abs >= 1", () => {
    expect(formatCo2(-10)).toBe("-10.0 kg");
    expect(formatCo2(-1000)).toBe("-1000.0 kg");
  });

  it("returns grams for negative values with abs < 1", () => {
    expect(formatCo2(-0.5)).toBe("-500.0 g");
  });
});

describe("formatTime", () => {
  it("returns '0:00' for 0 seconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("returns single-digit seconds padded to two digits", () => {
    expect(formatTime(5)).toBe("0:05");
  });

  it("returns exact minutes with zero seconds", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("formats minutes and seconds correctly", () => {
    expect(formatTime(83)).toBe("1:23");
  });

  it("formats longer durations correctly", () => {
    expect(formatTime(296)).toBe("4:56");
  });

  it("returns '0:00' for Infinity", () => {
    expect(formatTime(Infinity)).toBe("0:00");
  });

  it("returns '0:00' for NaN", () => {
    expect(formatTime(NaN)).toBe("0:00");
  });

  it("returns '0:00' for negative values", () => {
    expect(formatTime(-5)).toBe("0:00");
  });
});

describe("formatPrice", () => {
  it("formats whole dollar amounts", () => {
    expect(formatPrice(1000)).toBe("$10.00");
  });

  it("formats amounts with cents", () => {
    expect(formatPrice(999)).toBe("$9.99");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("formats small amounts (less than a dollar)", () => {
    expect(formatPrice(50)).toBe("$0.50");
  });

  it("formats large amounts", () => {
    expect(formatPrice(99999)).toBe("$999.99");
  });
});

describe("formatInterval", () => {
  it("formats month interval", () => {
    expect(formatInterval("month")).toBe("/ month");
  });

  it("formats year interval", () => {
    expect(formatInterval("year")).toBe("/ year");
  });
});

describe("formatIntervalShort", () => {
  it("returns 'mo' for month", () => {
    expect(formatIntervalShort("month")).toBe("mo");
  });

  it("returns 'yr' for year", () => {
    expect(formatIntervalShort("year")).toBe("yr");
  });
});

describe("getUserTimezone", () => {
  it("returns a non-empty string", () => {
    const tz = getUserTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("falls back to America/Denver when Intl throws", () => {
    const original = Intl.DateTimeFormat;
    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: () => { throw new Error("not supported"); },
    });
    const tz = getUserTimezone();
    expect(tz).toBe("America/Denver");
    vi.stubGlobal("Intl", { ...Intl, DateTimeFormat: original });
  });
});

describe("toLocalDateKey", () => {
  it("returns a YYYY-MM-DD string for an ISO date", () => {
    // 2026-03-20T14:00:00Z is some date — just check the format
    const key = toLocalDateKey("2026-03-20T14:00:00.000Z");
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns different keys for different ISO timestamps", () => {
    const key1 = toLocalDateKey("2026-01-01T00:00:00.000Z");
    const key2 = toLocalDateKey("2026-06-15T00:00:00.000Z");
    expect(key1).not.toBe(key2);
  });
});

describe("formatLocalDate", () => {
  it("returns a human-readable date string from a YYYY-MM-DD key", () => {
    // The result includes month, day, year — just verify the shape
    const result = formatLocalDate("2026-03-20");
    expect(result).toMatch(/\w+\s+\d+,\s+\d{4}/);
  });

  it("includes the correct year", () => {
    const result = formatLocalDate("2026-07-04");
    expect(result).toContain("2026");
  });
});
