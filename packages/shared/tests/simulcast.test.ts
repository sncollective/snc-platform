import { describe, it, expect } from "vitest";

import {
  RTMP_URL_REGEX,
  isAllowedSimulcastRtmpUrl,
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

  it("accepts custom public RTMP destinations on allowed ports", () => {
    const result = CreateSimulcastDestinationSchema.parse({
      ...VALID_CREATE,
      platform: "custom",
      rtmpUrl: "rtmp://stream.example.com:1935/live",
    });
    expect(result.rtmpUrl).toBe("rtmp://stream.example.com:1935/live");
  });

  it("rejects private, link-local, localhost, and internal-name destinations", () => {
    for (const rtmpUrl of [
      "rtmp://10.0.0.5/app",
      "rtmp://172.20.0.5/app",
      "rtmp://192.168.1.10/app",
      "rtmp://127.0.0.1/app",
      "rtmp://169.254.169.254/latest",
      "rtmp://[::1]/app",
      "rtmp://[fd00::1]/app",
      "rtmp://localhost/app",
      "rtmp://snc-postgres/app",
    ]) {
      expect(() =>
        CreateSimulcastDestinationSchema.parse({ ...VALID_CREATE, platform: "custom", rtmpUrl }),
      ).toThrow();
    }
  });

  it("rejects custom destinations on non-RTMP ports", () => {
    expect(() =>
      CreateSimulcastDestinationSchema.parse({
        ...VALID_CREATE,
        platform: "custom",
        rtmpUrl: "rtmp://stream.example.com:5432/live",
      }),
    ).toThrow();
  });

  it("rejects built-in platform URLs outside their approved domains", () => {
    expect(() =>
      CreateSimulcastDestinationSchema.parse({
        ...VALID_CREATE,
        platform: "twitch",
        rtmpUrl: "rtmp://stream.example.com/live",
      }),
    ).toThrow();
  });
});

// ── isAllowedSimulcastRtmpUrl ──

describe("isAllowedSimulcastRtmpUrl", () => {
  it("allows Twitch and YouTube ingest domains for built-in platforms", () => {
    expect(isAllowedSimulcastRtmpUrl("rtmp://live.twitch.tv/app", "twitch")).toBe(true);
    expect(isAllowedSimulcastRtmpUrl("rtmp://a.rtmp.youtube.com/live2", "youtube")).toBe(true);
  });

  it("rejects built-in platform domain mismatches", () => {
    expect(isAllowedSimulcastRtmpUrl("rtmp://a.rtmp.youtube.com/live2", "twitch")).toBe(false);
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
