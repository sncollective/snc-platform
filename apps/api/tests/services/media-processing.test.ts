import { EventEmitter } from "node:events";

import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock Helpers ──

type MockProcess = {
  stdout: EventEmitter;
  stderr: EventEmitter;
  on: ReturnType<typeof vi.fn>;
};

/**
 * Create a mock ChildProcess-like object.
 * Tests control stdout/stderr data and exit code by calling the emitters and
 * invoking the `on("close", handler)` callback registered via proc.on.
 */
const createMockProcess = (): MockProcess => {
  const proc: MockProcess = {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    on: vi.fn(),
  };
  return proc;
};

/** Emit a close event with a given exit code using the registered handler. */
const emitClose = (proc: MockProcess, code: number) => {
  const closeCall = proc.on.mock.calls.find((c) => c[0] === "close");
  if (closeCall) (closeCall[1] as (code: number) => void)(code);
};

/** Emit an error event using the registered handler. */
const emitError = (proc: MockProcess, error: Error) => {
  const errorCall = proc.on.mock.calls.find((c) => c[0] === "error");
  if (errorCall) (errorCall[1] as (err: Error) => void)(error);
};

// ── Mock spawn ──

const mockSpawn = vi.fn();

/**
 * Configure mockSpawn so the next probeMedia() call receives the given JSON output
 * and exits with code 0. Events are emitted after a microtask tick so the
 * handler registration completes before data arrives.
 */
const mockSpawnOutput = (output: string) => {
  mockSpawn.mockImplementationOnce(() => {
    const proc = createMockProcess();
    // Schedule emission after the spawn caller registers its handlers
    Promise.resolve().then(() => {
      proc.stdout.emit("data", Buffer.from(output));
      proc.stderr.emit("data", Buffer.from(""));
      emitClose(proc, 0);
    });
    return proc;
  });
};

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("node:child_process", () => ({
    spawn: mockSpawn,
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  }));
  vi.doMock("../../src/config.js", () => ({
    config: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      LOG_LEVEL: "info",
    },
  }));
  return await import("../../src/services/media-processing.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── probeMedia ──

describe("probeMedia", () => {
  it("returns codec info for a video file", async () => {
    const { probeMedia } = await setupService();

    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const probePromise = probeMedia("/path/to/video.mp4");

    // Emit ffprobe JSON output
    const probeOutput = JSON.stringify({
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
        { codec_type: "audio", codec_name: "aac" },
      ],
      format: { duration: "123.456", bit_rate: "4000000" },
    });
    proc.stdout.emit("data", Buffer.from(probeOutput));
    proc.stderr.emit("data", Buffer.from(""));
    emitClose(proc, 0);

    const result = await probePromise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.videoCodec).toBe("h264");
      expect(result.value.audioCodec).toBe("aac");
      expect(result.value.width).toBe(1920);
      expect(result.value.height).toBe(1080);
      expect(result.value.duration).toBeCloseTo(123.456);
      expect(result.value.bitrate).toBe(4000000);
    }
  });

  it("returns null for missing video stream (audio-only file)", async () => {
    const { probeMedia } = await setupService();

    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const probePromise = probeMedia("/path/to/audio.mp3");

    const probeOutput = JSON.stringify({
      streams: [{ codec_type: "audio", codec_name: "mp3" }],
      format: { duration: "240.0", bit_rate: "128000" },
    });
    proc.stdout.emit("data", Buffer.from(probeOutput));
    proc.stderr.emit("data", Buffer.from(""));
    emitClose(proc, 0);

    const result = await probePromise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.videoCodec).toBeNull();
      expect(result.value.audioCodec).toBe("mp3");
      expect(result.value.width).toBeNull();
      expect(result.value.height).toBeNull();
    }
  });

  it("returns err when ffprobe exits with non-zero code", async () => {
    const { probeMedia } = await setupService();

    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const probePromise = probeMedia("/path/to/invalid.file");

    proc.stdout.emit("data", Buffer.from(""));
    proc.stderr.emit("data", Buffer.from("No such file or directory"));
    emitClose(proc, 1);

    const result = await probePromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FFMPEG_ERROR");
      expect(result.error.statusCode).toBe(502);
    }
  });

  it("returns err when spawn emits an error event", async () => {
    const { probeMedia } = await setupService();

    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const probePromise = probeMedia("/path/to/video.mp4");

    emitError(proc, new Error("ffprobe not found"));

    const result = await probePromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FFMPEG_ERROR");
    }
  });
});

// ── transcodeToH264 ──

describe("transcodeToH264", () => {
  it("resolves with ok on successful transcode", async () => {
    const { transcodeToH264 } = await setupService();

    const probeProc = createMockProcess();
    const transcodeProc = createMockProcess();
    mockSpawn
      .mockReturnValueOnce(probeProc)
      .mockReturnValueOnce(transcodeProc);

    const transcodePromise = transcodeToH264("/input.mkv", "/output.mp4");

    // Yield to let the internal probeMedia promise register its handlers
    await Promise.resolve();

    // Resolve the inner probeMedia call first
    const probeOutput = JSON.stringify({
      streams: [{ codec_type: "video", codec_name: "hevc", width: 1280, height: 720 }],
      format: { duration: "60.0", bit_rate: "2000000" },
    });
    probeProc.stdout.emit("data", Buffer.from(probeOutput));
    probeProc.stderr.emit("data", Buffer.from(""));
    emitClose(probeProc, 0);

    // Yield to let the transcode promise register its handlers after probe resolves
    await Promise.resolve();
    await Promise.resolve();

    // Then resolve the ffmpeg transcode
    transcodeProc.stderr.emit("data", Buffer.from(""));
    emitClose(transcodeProc, 0);

    const result = await transcodePromise;
    expect(result.ok).toBe(true);
  });

  it("calls onProgress callback with parsed progress percentage", async () => {
    const { transcodeToH264 } = await setupService();

    const probeProc = createMockProcess();
    const transcodeProc = createMockProcess();
    mockSpawn
      .mockReturnValueOnce(probeProc)
      .mockReturnValueOnce(transcodeProc);

    const onProgress = vi.fn();
    const transcodePromise = transcodeToH264("/input.mkv", "/output.mp4", { onProgress });

    // Yield to let the internal probeMedia promise register its handlers
    await Promise.resolve();

    // Probe returns 100s duration
    const probeOutput = JSON.stringify({
      streams: [{ codec_type: "video", codec_name: "hevc" }],
      format: { duration: "100.0", bit_rate: "2000000" },
    });
    probeProc.stdout.emit("data", Buffer.from(probeOutput));
    probeProc.stderr.emit("data", Buffer.from(""));
    emitClose(probeProc, 0);

    // Yield to let the transcode promise register its handlers after probe resolves
    await Promise.resolve();
    await Promise.resolve();

    // Emit a progress line (50s into a 100s video = 50%)
    transcodeProc.stderr.emit("data", Buffer.from("frame= 100 fps=25 q=23.0 size=1024kB time=00:00:50.00 bitrate=167.8kbits/s"));
    emitClose(transcodeProc, 0);

    await transcodePromise;
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100); // on close
  });

  it("returns err on ffmpeg transcode failure", async () => {
    const { transcodeToH264 } = await setupService();

    const probeProc = createMockProcess();
    const transcodeProc = createMockProcess();
    mockSpawn
      .mockReturnValueOnce(probeProc)
      .mockReturnValueOnce(transcodeProc);

    const transcodePromise = transcodeToH264("/input.mkv", "/output.mp4");

    // Yield to let the internal probeMedia promise register its handlers
    await Promise.resolve();

    const probeOutput = JSON.stringify({
      streams: [],
      format: { duration: "60.0", bit_rate: "2000000" },
    });
    probeProc.stdout.emit("data", Buffer.from(probeOutput));
    probeProc.stderr.emit("data", Buffer.from(""));
    emitClose(probeProc, 0);

    // Yield to let the transcode promise register its handlers after probe resolves
    await Promise.resolve();
    await Promise.resolve();

    transcodeProc.stderr.emit("data", Buffer.from("Encoder not found"));
    emitClose(transcodeProc, 1);

    const result = await transcodePromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FFMPEG_ERROR");
    }
  });
});

// ── extractThumbnail ──

describe("extractThumbnail", () => {
  it("resolves with ok on success", async () => {
    const { extractThumbnail } = await setupService();

    const probeProc = createMockProcess();
    const thumbProc = createMockProcess();
    mockSpawn
      .mockReturnValueOnce(probeProc)
      .mockReturnValueOnce(thumbProc);

    const thumbPromise = extractThumbnail("/input.mp4", "/thumb.jpg");

    // Yield to let the internal probeMedia promise register its handlers
    await Promise.resolve();

    // Probe returns 100s duration (so thumb seeks to 10s)
    const probeOutput = JSON.stringify({
      streams: [{ codec_type: "video", codec_name: "h264", width: 1280, height: 720 }],
      format: { duration: "100.0", bit_rate: "2000000" },
    });
    probeProc.stdout.emit("data", Buffer.from(probeOutput));
    probeProc.stderr.emit("data", Buffer.from(""));
    emitClose(probeProc, 0);

    // Yield to let the thumbnail promise register its handlers after probe resolves
    await Promise.resolve();
    await Promise.resolve();

    emitClose(thumbProc, 0);

    const result = await thumbPromise;
    expect(result.ok).toBe(true);
  });

  it("returns err on ffmpeg thumbnail failure", async () => {
    const { extractThumbnail } = await setupService();

    const probeProc = createMockProcess();
    const thumbProc = createMockProcess();
    mockSpawn
      .mockReturnValueOnce(probeProc)
      .mockReturnValueOnce(thumbProc);

    const thumbPromise = extractThumbnail("/input.mp4", "/thumb.jpg");

    // Yield to let the internal probeMedia promise register its handlers
    await Promise.resolve();

    const probeOutput = JSON.stringify({
      streams: [],
      format: { duration: "60.0" },
    });
    probeProc.stdout.emit("data", Buffer.from(probeOutput));
    probeProc.stderr.emit("data", Buffer.from(""));
    emitClose(probeProc, 0);

    // Yield to let the thumbnail promise register its handlers after probe resolves
    await Promise.resolve();
    await Promise.resolve();

    emitClose(thumbProc, 1);

    const result = await thumbPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FFMPEG_ERROR");
    }
  });
});

// ── probeMedia — format.tags extraction ──

describe("probeMedia — format.tags extraction", () => {
  const makeProbeOutput = (tags: Record<string, string>) =>
    JSON.stringify({
      format: { duration: "5400.0", bit_rate: "8000000", tags },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
        { codec_type: "audio", codec_name: "aac" },
      ],
    });

  it("extracts TITLE tag", async () => {
    const { probeMedia } = await setupService();
    mockSpawnOutput(makeProbeOutput({ TITLE: "The Good Film" }));
    const result = await probeMedia("/fake/path.mkv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags.title).toBe("The Good Film");
  });

  it("extracts lowercase title tag", async () => {
    const { probeMedia } = await setupService();
    mockSpawnOutput(makeProbeOutput({ title: "lowercase title" }));
    const result = await probeMedia("/fake/path.mkv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags.title).toBe("lowercase title");
  });

  it("parses DATE tag to year integer", async () => {
    const { probeMedia } = await setupService();
    mockSpawnOutput(makeProbeOutput({ DATE: "2019-06-21" }));
    const result = await probeMedia("/fake/path.mkv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags.year).toBe(2019);
  });

  it("parses plain YEAR tag", async () => {
    const { probeMedia } = await setupService();
    mockSpawnOutput(makeProbeOutput({ YEAR: "2021" }));
    const result = await probeMedia("/fake/path.mkv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags.year).toBe(2021);
  });

  it("falls back to ARTIST when DIRECTOR absent", async () => {
    const { probeMedia } = await setupService();
    mockSpawnOutput(makeProbeOutput({ ARTIST: "Jane Doe" }));
    const result = await probeMedia("/fake/path.mkv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags.director).toBe("Jane Doe");
  });

  it("returns null tags when format.tags absent", async () => {
    const { probeMedia } = await setupService();
    mockSpawnOutput(makeProbeOutput({}));
    const result = await probeMedia("/fake/path.mkv");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tags.title).toBeNull();
      expect(result.value.tags.year).toBeNull();
      expect(result.value.tags.director).toBeNull();
    }
  });

  it("rejects year out of valid range", async () => {
    const { probeMedia } = await setupService();
    mockSpawnOutput(makeProbeOutput({ YEAR: "0000" }));
    const result = await probeMedia("/fake/path.mkv");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags.year).toBeNull();
  });
});

// ── remuxToMp4 ──

describe("remuxToMp4", () => {
  it("resolves with ok on success", async () => {
    const { remuxToMp4 } = await setupService();

    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const remuxPromise = remuxToMp4("/input.flv", "/output.mp4");

    emitClose(proc, 0);

    const result = await remuxPromise;
    expect(result.ok).toBe(true);
  });

  it("returns err on ffmpeg remux failure", async () => {
    const { remuxToMp4 } = await setupService();

    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const remuxPromise = remuxToMp4("/input.flv", "/output.mp4");

    emitClose(proc, 1);

    const result = await remuxPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FFMPEG_ERROR");
    }
  });

  it("passes -c copy and -movflags +faststart to ffmpeg", async () => {
    const { remuxToMp4 } = await setupService();

    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const remuxPromise = remuxToMp4("/input.flv", "/output.mp4");
    emitClose(proc, 0);
    await remuxPromise;

    expect(mockSpawn).toHaveBeenCalledWith(
      "ffmpeg",
      expect.arrayContaining(["-c", "copy", "-movflags", "+faststart"]),
    );
  });
});
