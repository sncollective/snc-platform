import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock Helpers ──

const mockFetch = vi.fn();
const BROADCAST_ID = "f0f0f0f0-0000-0000-0000-000000000001";
// db.select().from().where() resolves to the broadcast channel row. The resolution
// value is (re)set in each setupModule call so vi.resetAllMocks() in afterEach can't
// strand it returning undefined.
const mockDbWhere = vi.fn();

const mockFetchResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

const makeNowPlayingResponse = () => ({
  uri: "s3://snc-storage/playout/item-1/1080p.mp4",
  title: "Test Film",
  elapsed: 30.0,
  remaining: 60.0,
});

// ── Setup Factories ──

const setupModule = async (withApiUrl = true) => {
  vi.stubGlobal("fetch", mockFetch);
  // Default DB resolution (broadcast channel row). A test wanting the "no broadcast"
  // path overrides with mockResolvedValueOnce([]) AFTER calling setupModule.
  mockDbWhere.mockResolvedValue([{ id: BROADCAST_ID }]);
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({
      LIQUIDSOAP_API_URL: withApiUrl ? "http://localhost:8888" : undefined,
    }),
  }));
  // db.select({...}).from(...).where(...) → broadcast channel row.
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where: mockDbWhere }),
      }),
    },
  }));
  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: { id: "id", ownership: "ownership", role: "role" },
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      }),
    },
  }));
  return await import("../../src/services/liquidsoap.js");
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── Tests ──

describe("getNowPlaying", () => {
  it("returns null when LIQUIDSOAP_API_URL is not configured", async () => {
    const { getNowPlaying } = await setupModule(false);
    const result = await getNowPlaying();
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns now-playing data when Liquidsoap is running", async () => {
    const { getNowPlaying } = await setupModule();
    mockFetch.mockReturnValue(mockFetchResponse(makeNowPlayingResponse()));

    const result = await getNowPlaying();

    expect(result).not.toBeNull();
    expect(result?.uri).toBe("s3://snc-storage/playout/item-1/1080p.mp4");
    expect(result?.title).toBe("Test Film");
    expect(result?.elapsed).toBe(30.0);
    expect(result?.remaining).toBe(60.0);
  });

  it("returns null when Liquidsoap returns non-ok status", async () => {
    const { getNowPlaying } = await setupModule();
    mockFetch.mockReturnValue(mockFetchResponse({}, 500));

    const result = await getNowPlaying();
    expect(result).toBeNull();
  });

  it("returns null when Liquidsoap is unreachable (fetch throws)", async () => {
    const { getNowPlaying } = await setupModule();
    mockFetch.mockRejectedValue(new Error("connection refused"));

    const result = await getNowPlaying();
    expect(result).toBeNull();
  });

  it("returns null on timeout (AbortError)", async () => {
    const { getNowPlaying } = await setupModule();
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValue(abortError);

    const result = await getNowPlaying();
    expect(result).toBeNull();
  });

  it("calls the broadcast channel's per-channel now-playing endpoint", async () => {
    const { getNowPlaying } = await setupModule();
    mockFetch.mockReturnValue(mockFetchResponse(makeNowPlayingResponse()));

    await getNowPlaying();

    // S/NC TV is a generated channel now — the consumer reads its per-channel path,
    // not the retired legacy /now-playing.
    expect(mockFetch).toHaveBeenCalledWith(
      `http://localhost:8888/channels/${BROADCAST_ID}/now-playing`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns null (no fetch) when no broadcast channel is seeded", async () => {
    const { getNowPlaying } = await setupModule();
    mockDbWhere.mockResolvedValue([]); // override: no broadcast channel

    const result = await getNowPlaying();

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("tolerates the additive `selected` field in the per-channel response", async () => {
    const { getNowPlaying } = await setupModule();
    mockFetch.mockReturnValue(
      mockFetchResponse({ ...makeNowPlayingResponse(), selected: "ch_xyz_live" }),
    );

    const result = await getNowPlaying();

    // `selected` is ignored; the legacy four fields still map through.
    expect(result?.uri).toBe("s3://snc-storage/playout/item-1/1080p.mp4");
    expect(result?.title).toBe("Test Film");
  });
});
