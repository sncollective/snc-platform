import { describe, it, expect } from "vitest";

import {
  RTMP_URL_REGEX,
  CreateSimulcastDestinationSchema,
  UpdateSimulcastDestinationSchema,
} from "../src/index.js";

// ── RTMP_URL_REGEX ──

describe("RTMP_URL_REGEX", () => {
  it("accepts rtmp:// URL with a host", () => {
    expect(RTMP_URL_REGEX.test("rtmp://live.twitch.tv/app")).toBe(true);
  });

  it("accepts rtmps:// URL with a host", () => {
    expect(RTMP_URL_REGEX.test("rtmps://live.twitch.tv/app")).toBe(true);
  });

  it("rejects https:// URL", () => {
    expect(RTMP_URL_REGEX.test("https://example.com")).toBe(false);
  });

  it("rejects rtmp:// with nothing after the scheme", () => {
    expect(RTMP_URL_REGEX.test("rtmp://")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(RTMP_URL_REGEX.test("")).toBe(false);
  });
});

// ── CreateSimulcastDestinationSchema.rtmpUrl ──

const VALID_CREATE = {
  platform: "twitch" as const,
  label: "My Twitch",
  rtmpUrl: "rtmp://live.twitch.tv/app",
  streamKey: "sk_abc123",
};

describe("CreateSimulcastDestinationSchema rtmpUrl", () => {
  it("accepts rtmp:// URL", () => {
    const result = CreateSimulcastDestinationSchema.parse(VALID_CREATE);
    expect(result.rtmpUrl).toBe("rtmp://live.twitch.tv/app");
  });

  it("accepts rtmps:// URL", () => {
    const result = CreateSimulcastDestinationSchema.parse({
      ...VALID_CREATE,
      rtmpUrl: "rtmps://live.twitch.tv/app",
    });
    expect(result.rtmpUrl).toBe("rtmps://live.twitch.tv/app");
  });

  it("rejects https:// URL with validation error", () => {
    expect(() =>
      CreateSimulcastDestinationSchema.parse({
        ...VALID_CREATE,
        rtmpUrl: "https://example.com",
      }),
    ).toThrow();
  });

  it("rejects empty string", () => {
    expect(() =>
      CreateSimulcastDestinationSchema.parse({ ...VALID_CREATE, rtmpUrl: "" }),
    ).toThrow();
  });

  it("rejects ftp:// URL", () => {
    expect(() =>
      CreateSimulcastDestinationSchema.parse({
        ...VALID_CREATE,
        rtmpUrl: "ftp://files.example.com/stream",
      }),
    ).toThrow();
  });
});

// ── UpdateSimulcastDestinationSchema.rtmpUrl ──

describe("UpdateSimulcastDestinationSchema rtmpUrl", () => {
  it("accepts rtmp:// when provided", () => {
    const result = UpdateSimulcastDestinationSchema.parse({
      rtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
    });
    expect(result.rtmpUrl).toBe("rtmp://a.rtmp.youtube.com/live2");
  });

  it("accepts rtmps:// when provided", () => {
    const result = UpdateSimulcastDestinationSchema.parse({
      rtmpUrl: "rtmps://live.twitch.tv/app",
    });
    expect(result.rtmpUrl).toBe("rtmps://live.twitch.tv/app");
  });

  it("accepts omitted rtmpUrl (field is optional)", () => {
    const result = UpdateSimulcastDestinationSchema.parse({ isActive: true });
    expect(result.rtmpUrl).toBeUndefined();
  });

  it("rejects https:// URL on update", () => {
    expect(() =>
      UpdateSimulcastDestinationSchema.parse({ rtmpUrl: "https://example.com" }),
    ).toThrow();
  });
});
