import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

// These are the vi.fn() instances the module-under-test will call.
// They are re-wired per test using mockReturnValueOnce / mockReturnValue.
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockCheckCreatorPermission = vi.fn();

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
    streamKeys: {
      creatorId: "creatorId",
      keyHash: "keyHash",
      id: "id",
      revokedAt: "revokedAt",
    },
  }));
  vi.doMock("../../src/services/creator-team.js", () => ({
    checkCreatorPermission: mockCheckCreatorPermission,
  }));
  return await import("../../src/services/stream-keys.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── DB Chain Helpers ──

/** Builds a select chain that resolves to `rows` at the end of `.from().where()`. */
const buildSelectChain = (rows: unknown[]) => {
  const whereChain = vi.fn().mockResolvedValue(rows);
  const fromChain = { where: whereChain };
  const selectChain = { from: vi.fn().mockReturnValue(fromChain) };
  return selectChain;
};

/** Builds an insert chain `.values().returning()` that resolves to `rows`. */
const buildInsertChain = (rows: unknown[]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  }),
});

/** Builds an insert chain `.values()` that resolves immediately (no returning). */
const buildInsertNoReturnChain = () => ({
  values: vi.fn().mockResolvedValue([]),
});

/** Builds an update chain `.set().where().returning()` that resolves to `rows`. */
const buildUpdateChain = (rows: unknown[]) => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

// ── Fixtures ──

const makeKeyRow = (overrides?: Partial<{
  id: string;
  creatorId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: Date;
  revokedAt: Date | null;
}>) => ({
  id: "key-1",
  creatorId: "creator-1",
  name: "My Key",
  keyHash: "abc123hash",
  keyPrefix: "sk_a1b2c3d4e",
  createdAt: new Date("2026-03-01T00:00:00Z"),
  revokedAt: null,
  ...overrides,
});

// ── Tests ──

describe("stream key service", () => {
  describe("createStreamKey", () => {
    it("returns raw key starting with sk_ and stores only hash", async () => {
      mockCheckCreatorPermission.mockResolvedValueOnce(true);
      mockDbInsert.mockReturnValueOnce(buildInsertChain([makeKeyRow()]));

      const { createStreamKey } = await setupService();
      const result = await createStreamKey("user-1", "creator-1", "My Key", ["stakeholder"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rawKey).toMatch(/^sk_/);
        expect(result.value.rawKey).not.toBe(result.value.id);
      }
    });

    it("rejects non-owner with 403", async () => {
      mockCheckCreatorPermission.mockResolvedValueOnce(false);

      const { createStreamKey } = await setupService();
      const result = await createStreamKey("user-1", "creator-1", "My Key", ["stakeholder"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.statusCode).toBe(403);
      }
    });

    it("rejects with 403 when user has no membership", async () => {
      mockCheckCreatorPermission.mockResolvedValueOnce(false);

      const { createStreamKey } = await setupService();
      const result = await createStreamKey("user-1", "creator-1", "My Key", ["stakeholder"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.statusCode).toBe(403);
      }
    });

    it("allows platform admin even without creator membership", async () => {
      mockCheckCreatorPermission.mockResolvedValueOnce(true);
      mockDbInsert.mockReturnValueOnce(buildInsertChain([makeKeyRow()]));

      const { createStreamKey } = await setupService();
      const result = await createStreamKey("user-admin", "creator-1", "My Key", ["admin"]);

      expect(result.ok).toBe(true);
      expect(mockCheckCreatorPermission).toHaveBeenCalledWith("user-admin", "creator-1", "manageStreaming", ["admin"]);
    });
  });

  describe("listStreamKeys", () => {
    it("returns keys without raw values", async () => {
      const keyRow = makeKeyRow();
      mockCheckCreatorPermission.mockResolvedValueOnce(true);
      mockDbSelect.mockReturnValueOnce(buildSelectChain([keyRow]));

      const { listStreamKeys } = await setupService();
      const result = await listStreamKeys("user-1", "creator-1", ["stakeholder"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).not.toHaveProperty("rawKey");
        expect(result.value[0]).toHaveProperty("id", keyRow.id);
        expect(result.value[0]).toHaveProperty("keyPrefix", keyRow.keyPrefix);
      }
    });
  });

  describe("revokeStreamKey", () => {
    it("sets revokedAt on the key", async () => {
      const keyRow = makeKeyRow();
      const revokedRow = makeKeyRow({ revokedAt: new Date("2026-03-26T00:00:00Z") });

      mockCheckCreatorPermission.mockResolvedValueOnce(true);
      mockDbSelect.mockReturnValueOnce(buildSelectChain([keyRow]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateChain([revokedRow]));

      const { revokeStreamKey } = await setupService();
      const result = await revokeStreamKey("user-1", "creator-1", "key-1", ["stakeholder"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.revokedAt).not.toBeNull();
      }
    });

    it("returns 404 for unknown key", async () => {
      mockCheckCreatorPermission.mockResolvedValueOnce(true);
      mockDbSelect.mockReturnValueOnce(buildSelectChain([]));

      const { revokeStreamKey } = await setupService();
      const result = await revokeStreamKey("user-1", "creator-1", "unknown-key", ["stakeholder"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.statusCode).toBe(404);
      }
    });
  });

  describe("lookupCreatorByKeyHash", () => {
    it("returns creator info for active key", async () => {
      mockDbSelect.mockReturnValueOnce(
        buildSelectChain([{ creatorId: "creator-1", id: "key-1" }]),
      );

      const { lookupCreatorByKeyHash } = await setupService();
      const result = await lookupCreatorByKeyHash("somehash");

      expect(result).not.toBeNull();
      expect(result?.creatorId).toBe("creator-1");
      expect(result?.keyId).toBe("key-1");
    });

    it("returns null when no active key matches (revoked key filtered)", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectChain([]));

      const { lookupCreatorByKeyHash } = await setupService();
      const result = await lookupCreatorByKeyHash("revokedhash");

      expect(result).toBeNull();
    });
  });
});
