import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
    },
    sql: vi.fn(),
  }));
  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    streamSessions: {
      id: "id",
      creatorId: "creatorId",
      streamKeyId: "streamKeyId",
      srsClientId: "srsClientId",
      srsStreamName: "srsStreamName",
      startedAt: "startedAt",
      endedAt: "endedAt",
      peakViewers: "peakViewers",
    },
    streamEvents: {
      id: "id",
      sessionId: "sessionId",
      eventType: "eventType",
      payload: "payload",
    },
  }));
  return await import("../../src/services/stream-sessions.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── DB Chain Helpers ──

/** .from().where() → resolves to rows */
const buildSelectWhereChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

/** .from().where().orderBy() → resolves to rows */
const buildSelectWhereOrderByChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

/** .from().where().orderBy().limit() → resolves to rows */
const buildSelectWhereOrderByLimitChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }),
});

/** insert .values() → resolves (no returning needed) */
const buildInsertValuesChain = () => ({
  values: vi.fn().mockResolvedValue([]),
});

/** insert .values().returning() → resolves to rows */
const buildInsertReturningChain = (rows: unknown[]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  }),
});

/** update .set().where() → resolves */
const buildUpdateSetWhereChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

// ── Fixtures ──

const makeSessionRow = (overrides?: Partial<{
  id: string;
  creatorId: string;
  streamKeyId: string;
  srsClientId: string;
  srsStreamName: string;
  startedAt: Date;
  endedAt: Date | null;
  peakViewers: number;
}>) => ({
  id: "session-1",
  creatorId: "creator-1",
  streamKeyId: "key-1",
  srsClientId: "srs-client-1",
  srsStreamName: "livestream",
  startedAt: new Date("2026-03-01T10:00:00Z"),
  endedAt: null,
  peakViewers: 0,
  ...overrides,
});

// ── Tests ──

describe("stream sessions service", () => {
  describe("openSession", () => {
    it("creates session and event rows", async () => {
      const sessionRow = makeSessionRow();

      // session insert → returns session row
      mockDbInsert
        .mockReturnValueOnce(buildInsertReturningChain([sessionRow]))
        // event insert → no returning
        .mockReturnValueOnce(buildInsertValuesChain());

      const { openSession } = await setupService();
      const result = await openSession({
        creatorId: "creator-1",
        streamKeyId: "key-1",
        srsClientId: "srs-client-1",
        srsStreamName: "livestream",
        callbackPayload: { action: "on_publish" },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.creatorId).toBe("creator-1");
        expect(result.value.srsStreamName).toBe("livestream");
      }
      expect(mockDbInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("closeSession", () => {
    it("updates endedAt on matching session", async () => {
      const sessionRow = makeSessionRow();

      // select active session → found
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([sessionRow]));
      // update session
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());
      // event insert
      mockDbInsert.mockReturnValueOnce(buildInsertValuesChain());

      const { closeSession } = await setupService();
      const result = await closeSession({
        srsClientId: "srs-client-1",
        callbackPayload: { action: "on_unpublish" },
      });

      expect(result.ok).toBe(true);
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("handles missing session gracefully — logs event with null sessionId", async () => {
      // select active session → not found
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));
      // orphan event insert
      mockDbInsert.mockReturnValueOnce(buildInsertValuesChain());

      const { closeSession } = await setupService();
      const result = await closeSession({
        srsClientId: "unknown-client",
        callbackPayload: { action: "on_unpublish" },
      });

      expect(result.ok).toBe(true);
      expect(mockDbUpdate).not.toHaveBeenCalled();
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("getActiveSessions", () => {
    it("returns only sessions with null endedAt", async () => {
      const activeSessions = [makeSessionRow()];

      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByChain(activeSessions));

      const { getActiveSessions } = await setupService();
      const result = await getActiveSessions();

      expect(result).toHaveLength(1);
      expect(result[0]?.endedAt).toBeNull();
    });
  });

  describe("getLastLiveAt", () => {
    it("returns most recent completed session endedAt", async () => {
      const endDate = new Date("2026-03-25T15:00:00Z");

      mockDbSelect.mockReturnValueOnce(
        buildSelectWhereOrderByLimitChain([{ endedAt: endDate }]),
      );

      const { getLastLiveAt } = await setupService();
      const result = await getLastLiveAt();

      expect(result).toEqual(endDate);
    });

    it("returns null when no completed sessions exist", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByLimitChain([]));

      const { getLastLiveAt } = await setupService();
      const result = await getLastLiveAt();

      expect(result).toBeNull();
    });
  });
});
