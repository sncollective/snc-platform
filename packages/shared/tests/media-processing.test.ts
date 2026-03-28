import { describe, it, expect } from "vitest";

import {
  requiresTranscode,
  TRANSCODE_REQUIRED_VIDEO_CODECS,
  ProbeResultSchema,
  ProcessingJobResponseSchema,
} from "../src/index.js";

import {
  ProcessingStatusSchema,
  ProcessingJobTypeSchema,
  ProcessingJobStatusSchema,
} from "../src/index.js";

// ── Tests ──

describe("requiresTranscode", () => {
  it("returns true for hevc", () => {
    expect(requiresTranscode("hevc")).toBe(true);
  });

  it("returns true for h265", () => {
    expect(requiresTranscode("h265")).toBe(true);
  });

  it("returns true for prores", () => {
    expect(requiresTranscode("prores")).toBe(true);
  });

  it("returns true for vp9", () => {
    expect(requiresTranscode("vp9")).toBe(true);
  });

  it("returns true for av1", () => {
    expect(requiresTranscode("av1")).toBe(true);
  });

  it("returns false for h264", () => {
    expect(requiresTranscode("h264")).toBe(false);
  });

  it("returns false for vp8", () => {
    expect(requiresTranscode("vp8")).toBe(false);
  });

  it("returns false for null", () => {
    expect(requiresTranscode(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(requiresTranscode("")).toBe(false);
  });

  it("is case-insensitive for HEVC", () => {
    expect(requiresTranscode("HEVC")).toBe(true);
  });

  it("is case-insensitive for ProRes", () => {
    expect(requiresTranscode("ProRes")).toBe(true);
  });

  it("is case-insensitive for H265", () => {
    expect(requiresTranscode("H265")).toBe(true);
  });
});

describe("TRANSCODE_REQUIRED_VIDEO_CODECS", () => {
  it("includes hevc and h265", () => {
    expect(TRANSCODE_REQUIRED_VIDEO_CODECS).toContain("hevc");
    expect(TRANSCODE_REQUIRED_VIDEO_CODECS).toContain("h265");
  });

  it("does not include h264", () => {
    expect(TRANSCODE_REQUIRED_VIDEO_CODECS).not.toContain("h264");
  });
});

describe("ProcessingStatusSchema", () => {
  it.each(["uploaded", "processing", "ready", "failed"])('accepts "%s"', (status) => {
    expect(ProcessingStatusSchema.parse(status)).toBe(status);
  });

  it('rejects "pending"', () => {
    expect(() => ProcessingStatusSchema.parse("pending")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => ProcessingStatusSchema.parse("")).toThrow();
  });
});

describe("ProcessingJobTypeSchema", () => {
  it.each(["probe", "transcode", "thumbnail", "vod-remux"])('accepts "%s"', (type) => {
    expect(ProcessingJobTypeSchema.parse(type)).toBe(type);
  });

  it('rejects "unknown"', () => {
    expect(() => ProcessingJobTypeSchema.parse("unknown")).toThrow();
  });
});

describe("ProcessingJobStatusSchema", () => {
  it.each(["queued", "processing", "completed", "failed"])('accepts "%s"', (status) => {
    expect(ProcessingJobStatusSchema.parse(status)).toBe(status);
  });

  it('rejects "pending"', () => {
    expect(() => ProcessingJobStatusSchema.parse("pending")).toThrow();
  });
});

describe("ProbeResultSchema", () => {
  it("validates a complete probe result", () => {
    const result = ProbeResultSchema.parse({
      videoCodec: "h264",
      audioCodec: "aac",
      subtitleCodec: null,
      width: 1920,
      height: 1080,
      duration: 123.456,
      bitrate: 4000000,
    });
    expect(result.videoCodec).toBe("h264");
    expect(result.audioCodec).toBe("aac");
    expect(result.subtitleCodec).toBeNull();
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.duration).toBe(123.456);
    expect(result.bitrate).toBe(4000000);
  });

  it("validates a probe result with subtitles", () => {
    const result = ProbeResultSchema.parse({
      videoCodec: "h264",
      audioCodec: "aac",
      subtitleCodec: "subrip",
      width: 1920,
      height: 1080,
      duration: 90.0,
      bitrate: 4000000,
    });
    expect(result.subtitleCodec).toBe("subrip");
  });

  it("validates an audio-only probe result with null video fields", () => {
    const result = ProbeResultSchema.parse({
      videoCodec: null,
      audioCodec: "mp3",
      subtitleCodec: null,
      width: null,
      height: null,
      duration: 240.0,
      bitrate: 128000,
    });
    expect(result.videoCodec).toBeNull();
    expect(result.audioCodec).toBe("mp3");
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });

  it("validates a result with all nullable fields as null", () => {
    const result = ProbeResultSchema.parse({
      videoCodec: null,
      audioCodec: null,
      subtitleCodec: null,
      width: null,
      height: null,
      duration: null,
      bitrate: null,
    });
    expect(result.videoCodec).toBeNull();
    expect(result.duration).toBeNull();
  });

  it("rejects when required fields are missing", () => {
    expect(() => ProbeResultSchema.parse({})).toThrow();
  });

  it("enforces integer constraint on width", () => {
    expect(() =>
      ProbeResultSchema.parse({
        videoCodec: "h264",
        audioCodec: "aac",
        subtitleCodec: null,
        width: 1920.5,
        height: 1080,
        duration: 10,
        bitrate: 1000,
      }),
    ).toThrow();
  });
});

describe("ProcessingJobResponseSchema", () => {
  const VALID_JOB = {
    id: "job_abc123",
    contentId: "content_xyz",
    type: "probe",
    status: "queued",
    progress: null,
    error: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    completedAt: null,
  };

  it("validates a complete job response", () => {
    const result = ProcessingJobResponseSchema.parse(VALID_JOB);
    expect(result.id).toBe("job_abc123");
    expect(result.type).toBe("probe");
    expect(result.status).toBe("queued");
  });

  it("accepts a completed job with progress 100", () => {
    const result = ProcessingJobResponseSchema.parse({
      ...VALID_JOB,
      status: "completed",
      progress: 100,
      completedAt: "2026-03-01T00:05:00.000Z",
    });
    expect(result.progress).toBe(100);
    expect(result.completedAt).toBe("2026-03-01T00:05:00.000Z");
  });

  it("rejects when required fields are missing", () => {
    expect(() => ProcessingJobResponseSchema.parse({})).toThrow();
  });

  it("rejects invalid datetime format for createdAt", () => {
    expect(() =>
      ProcessingJobResponseSchema.parse({ ...VALID_JOB, createdAt: "not-a-date" }),
    ).toThrow();
  });
});
