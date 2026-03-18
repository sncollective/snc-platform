import { describe, it, expect } from "vitest";

import { StreamStatusSchema } from "../src/index.js";

describe("StreamStatusSchema", () => {
  it("accepts valid live status", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: true,
      viewerCount: 42,
      lastLiveAt: "2026-03-18T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid offline status with null lastLiveAt", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: false,
      viewerCount: 0,
      lastLiveAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative viewerCount", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: false,
      viewerCount: -1,
      lastLiveAt: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-datetime lastLiveAt string", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: false,
      viewerCount: 0,
      lastLiveAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = StreamStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
