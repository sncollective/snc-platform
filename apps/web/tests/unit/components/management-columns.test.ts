import { describe, it, expect } from "vitest";

import {
  getVisibleColumns,
  buildGridTemplate,
  formatDuration,
} from "../../../src/components/content/management-columns.js";

describe("getVisibleColumns", () => {
  it("returns all-typed columns for 'all' filter", () => {
    const cols = getVisibleColumns("all");
    // base columns: title, type, status, date, visibility
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("title");
    expect(keys).toContain("type");
    expect(keys).toContain("status");
    expect(keys).toContain("date");
    expect(keys).toContain("visibility");
  });

  it("includes duration and processing for 'audio' filter", () => {
    const cols = getVisibleColumns("audio");
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("duration");
    expect(keys).toContain("processing");
  });

  it("includes duration and processing for 'video' filter", () => {
    const cols = getVisibleColumns("video");
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("duration");
    expect(keys).toContain("processing");
  });

  it("excludes duration and processing for 'written' filter", () => {
    const cols = getVisibleColumns("written");
    const keys = cols.map((c) => c.key);
    expect(keys).not.toContain("duration");
    expect(keys).not.toContain("processing");
  });

  it("returns only base columns (5) for 'all' filter", () => {
    const cols = getVisibleColumns("all");
    // "all" shows base columns only — type-specific columns appear when a type is selected
    expect(cols.length).toBe(5);
    const keys = cols.map((c) => c.key);
    expect(keys).not.toContain("duration");
    expect(keys).not.toContain("processing");
  });

  it("returns 7 columns for audio (all base + duration + processing)", () => {
    const cols = getVisibleColumns("audio");
    expect(cols.length).toBe(7);
  });

  it("returns 5 base columns for written (no duration/processing)", () => {
    const cols = getVisibleColumns("written");
    expect(cols.length).toBe(5);
  });
});

describe("formatDuration", () => {
  it("formats seconds to mm:ss", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(3661)).toBe("61:01");
  });

  it("returns dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("buildGridTemplate", () => {
  it("joins column widths with spaces", () => {
    const cols = getVisibleColumns("written");
    const template = buildGridTemplate(cols);
    expect(template).toContain("1fr");
    expect(template).toBe(cols.map((c) => c.width).join(" "));
  });

  it("produces a non-empty string for valid columns", () => {
    const cols = getVisibleColumns("audio");
    const template = buildGridTemplate(cols);
    expect(template.length).toBeGreaterThan(0);
    expect(template.split(" ").length).toBe(cols.length);
  });
});
