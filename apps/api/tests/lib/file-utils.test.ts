import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import { NotFoundError, ok, err, AppError } from "@snc/shared";
import type { StorageProvider } from "@snc/shared";

import { errorHandler } from "../../src/middleware/error-handler.js";
import {
  parseRangeHeader,
  resolveRange,
  streamFile,
} from "../../src/lib/file-utils.js";
import type { AuthEnv } from "../../src/middleware/auth-env.js";

// ── Helpers ──

const makeTextStream = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

const makeStorage = (overrides: Partial<StorageProvider> = {}): StorageProvider => ({
  upload: vi.fn(),
  download: vi.fn(),
  downloadRange: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
  head: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  ...overrides,
});

/**
 * Build a minimal Hono app with a route that calls streamFile using the given
 * storage mock. The error handler is registered so NotFoundError maps to 404.
 */
const createTestApp = (storage: StorageProvider) => {
  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);
  app.get("/test/:key{.+}", async (c) => {
    const key = c.req.param("key");
    return streamFile(c, storage, key, "File not found");
  });
  return app;
};

// ── parseRangeHeader ──

describe("parseRangeHeader", () => {
  it("parses a bounded range", () => {
    const result = parseRangeHeader("bytes=0-999");
    expect(result).toStrictEqual({ type: "bounded", start: 0, end: 999 });
  });

  it("parses an open range (start only)", () => {
    const result = parseRangeHeader("bytes=500-");
    expect(result).toStrictEqual({ type: "open", start: 500 });
  });

  it("parses a suffix range (end only)", () => {
    const result = parseRangeHeader("bytes=-500");
    expect(result).toStrictEqual({ type: "suffix", suffix: 500 });
  });

  it("returns null for malformed header (missing bytes= prefix)", () => {
    expect(parseRangeHeader("0-999")).toBeNull();
  });

  it("returns null for non-byte unit", () => {
    expect(parseRangeHeader("chunks=0-999")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRangeHeader("")).toBeNull();
  });

  it("returns null when both start and end are empty", () => {
    expect(parseRangeHeader("bytes=-")).toBeNull();
  });
});

// ── resolveRange ──

describe("resolveRange", () => {
  it("clamps bounded end to totalSize - 1", () => {
    const result = resolveRange({ type: "bounded", start: 0, end: 9999 }, 1000);
    expect(result).toStrictEqual({ start: 0, end: 999 });
  });

  it("resolves open range to end of file", () => {
    const result = resolveRange({ type: "open", start: 500 }, 1000);
    expect(result).toStrictEqual({ start: 500, end: 999 });
  });

  it("resolves suffix range to last N bytes", () => {
    const result = resolveRange({ type: "suffix", suffix: 200 }, 1000);
    expect(result).toStrictEqual({ start: 800, end: 999 });
  });

  it("returns null when start >= totalSize", () => {
    const result = resolveRange({ type: "bounded", start: 1000, end: 1999 }, 1000);
    expect(result).toBeNull();
  });

  it("returns null when start > end after clamping", () => {
    // This can't naturally happen with bounded since we clamp end, but open/suffix can yield start > end
    // suffix of 0 bytes on a 10-byte file: start=10, end=9 → invalid
    const result = resolveRange({ type: "suffix", suffix: 0 }, 10);
    expect(result).toBeNull();
  });
});

// ── streamFile ──

describe("streamFile", () => {
  let storage: StorageProvider;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    storage = makeStorage();
    app = createTestApp(storage);
  });

  it("returns 200 with full body when no Range header", async () => {
    vi.mocked(storage.download).mockResolvedValue(
      ok({ stream: makeTextStream("hello world"), size: 11 }),
    );

    const res = await app.request("/test/content/abc/media.mp3");

    expect(res.status).toBe(200);
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Length")).toBe("11");
    const body = await res.text();
    expect(body).toBe("hello world");
  });

  it("always sets Accept-Ranges: bytes", async () => {
    vi.mocked(storage.download).mockResolvedValue(
      ok({ stream: makeTextStream("data"), size: 4 }),
    );

    const res = await app.request("/test/content/abc/media.mp4");

    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
  });

  it("returns 206 with Content-Range for a valid bounded Range header", async () => {
    vi.mocked(storage.head).mockResolvedValue(
      ok({ size: 1000, contentType: "audio/mpeg" }),
    );
    vi.mocked(storage.downloadRange).mockResolvedValue(
      ok({
        stream: makeTextStream("chunk"),
        contentLength: 5,
        totalSize: 1000,
        range: { start: 0, end: 4 },
      }),
    );

    const res = await app.request("/test/content/abc/audio.mp3", {
      headers: { range: "bytes=0-4" },
    });

    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-4/1000");
    expect(res.headers.get("Content-Length")).toBe("5");
    const body = await res.text();
    expect(body).toBe("chunk");
  });

  it("returns 416 for a malformed Range header", async () => {
    vi.mocked(storage.head).mockResolvedValue(
      ok({ size: 1000, contentType: "audio/mpeg" }),
    );

    const res = await app.request("/test/content/abc/audio.mp3", {
      headers: { range: "invalid-header" },
    });

    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */1000");
  });

  it("returns 416 for an unsatisfiable range (start >= totalSize)", async () => {
    vi.mocked(storage.head).mockResolvedValue(
      ok({ size: 100, contentType: "audio/mpeg" }),
    );

    const res = await app.request("/test/content/abc/audio.mp3", {
      headers: { range: "bytes=200-300" },
    });

    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */100");
  });

  it("throws NotFoundError (404) when storage.download fails on missing key", async () => {
    vi.mocked(storage.download).mockResolvedValue(
      err(new NotFoundError("File not found")),
    );

    const res = await app.request("/test/content/nonexistent/media.mp4");

    expect(res.status).toBe(404);
  });

  it("throws NotFoundError (404) when storage.head fails on range request", async () => {
    vi.mocked(storage.head).mockResolvedValue(
      err(new NotFoundError("File not found")),
    );

    const res = await app.request("/test/content/nonexistent/audio.mp3", {
      headers: { range: "bytes=0-99" },
    });

    expect(res.status).toBe(404);
  });

  it("Content-Length on 206 is the chunk size, not the total size", async () => {
    vi.mocked(storage.head).mockResolvedValue(
      ok({ size: 5000, contentType: "audio/mpeg" }),
    );
    vi.mocked(storage.downloadRange).mockResolvedValue(
      ok({
        stream: makeTextStream("x".repeat(100)),
        contentLength: 100,
        totalSize: 5000,
        range: { start: 0, end: 99 },
      }),
    );

    const res = await app.request("/test/content/abc/audio.mp3", {
      headers: { range: "bytes=0-99" },
    });

    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Length")).toBe("100");
    expect(res.headers.get("Content-Range")).toBe("bytes 0-99/5000");
  });
});
