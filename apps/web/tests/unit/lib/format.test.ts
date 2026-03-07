import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  formatRelativeDate,
  formatDate,
  formatTime,
  formatPrice,
  formatInterval,
  formatIntervalShort,
  formatCo2,
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

  it("returns 'Xm ago' for dates less than 60 minutes ago", () => {
    const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinutesAgo)).toBe("5m ago");
  });

  it("returns 'Xh ago' for dates less than 24 hours ago", () => {
    const threeHoursAgo = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(threeHoursAgo)).toBe("3h ago");
  });

  it("returns 'Xd ago' for dates less than 7 days ago", () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe("2d ago");
  });

  it("returns 'Xw ago' for dates less than 30 days ago", () => {
    const oneWeekAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(oneWeekAgo)).toBe("1w ago");
    expect(formatRelativeDate(twoWeeksAgo)).toBe("2w ago");
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
