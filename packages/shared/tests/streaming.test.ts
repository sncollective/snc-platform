import { describe, it, expect } from "vitest";

import { StreamStatusSchema, StreamKeyCreatedResponseSchema } from "../src/index.js";

describe("StreamStatusSchema", () => {
  it("accepts valid live status with primary stream", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: true,
      viewerCount: 42,
      lastLiveAt: "2026-03-18T10:00:00.000Z",
      hlsUrl: "http://stream.example.com/hls/stream.m3u8",
      primary: {
        creator: {
          id: "creator-1",
          displayName: "Test Creator",
          handle: "testcreator",
          avatarUrl: "/api/creators/creator-1/avatar",
        },
        viewerCount: 42,
        hlsUrl: "http://stream.example.com/hls/stream.m3u8",
        startedAt: "2026-03-18T10:00:00.000Z",
      },
      others: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid offline status with null lastLiveAt", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: false,
      viewerCount: 0,
      lastLiveAt: null,
      hlsUrl: null,
      primary: null,
      others: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative viewerCount", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: false,
      viewerCount: -1,
      lastLiveAt: null,
      hlsUrl: null,
      primary: null,
      others: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-datetime lastLiveAt string", () => {
    const result = StreamStatusSchema.safeParse({
      isLive: false,
      viewerCount: 0,
      lastLiveAt: "not-a-date",
      hlsUrl: null,
      primary: null,
      others: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = StreamStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("StreamKeyCreatedResponseSchema", () => {
  it("includes rawKey field", () => {
    const result = StreamKeyCreatedResponseSchema.safeParse({
      id: "key-1",
      name: "My Stream Key",
      keyPrefix: "sk_a1b2c3d4e",
      createdAt: "2026-03-18T10:00:00.000Z",
      revokedAt: null,
      rawKey: "sk_a1b2c3d4e5f6g7h8i9j0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing rawKey field", () => {
    const result = StreamKeyCreatedResponseSchema.safeParse({
      id: "key-1",
      name: "My Stream Key",
      keyPrefix: "sk_a1b2c3d4e",
      createdAt: "2026-03-18T10:00:00.000Z",
      revokedAt: null,
    });
    expect(result.success).toBe(false);
  });
});
