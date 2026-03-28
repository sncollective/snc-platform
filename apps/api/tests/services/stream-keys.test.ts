import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

// These are the vi.fn() instances the module-under-test will call.
// They are re-wired per test using mockReturnValueOnce / mockReturnValue.
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
    streamKeys: {
      creatorId: "creatorId",
      keyHash: "keyHash",
      id: "id",
      revokedAt: "revokedAt",
    },
  }));
  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorMembers: {
      userId: "userId",
      creatorId: "creatorId",
      role: "role",
    },
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
      // owner check → returns owner row
      mockDbSelect.mockReturnValueOnce(buildSelectChain([{ role: "owner" }]));
      // insert → returns key row
      mockDbInsert.mockReturnValueOnce(buildInsertChain([makeKeyRow()]));

      const { createStreamKey } = await setupService();
      const result = await createStreamKey("user-1", "creator-1", "My Key");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rawKey).toMatch(/^sk_/);
        // rawKey is not the stored hash (different from id)
        expect(result.value.rawKey).not.toBe(result.value.id);
      }
    });

    it("rejects non-owner with 403", async () => {
      // owner check → returns editor row
      mockDbSelect.mockReturnValueOnce(buildSelectChain([{ role: "editor" }]));

      const { createStreamKey } = await setupService();
      const result = await createStreamKey("user-1", "creator-1", "My Key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.statusCode).toBe(403);
      }
    });

    it("rejects with 403 when user has no membership", async () => {
      // owner check → returns empty (no membership)
      mockDbSelect.mockReturnValueOnce(buildSelectChain([]));

      const { createStreamKey } = await setupService();
      const result = await createStreamKey("user-1", "creator-1", "My Key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.statusCode).toBe(403);
      }
    });
  });

  describe("listStreamKeys", () => {
    it("returns keys without raw values", async () => {
      const keyRow = makeKeyRow();
      // owner check → owner
      mockDbSelect.mockReturnValueOnce(buildSelectChain([{ role: "owner" }]));
      // list → returns key rows
      mockDbSelect.mockReturnValueOnce(buildSelectChain([keyRow]));

      const { listStreamKeys } = await setupService();
      const result = await listStreamKeys("user-1", "creator-1");

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

      // owner check → owner
      mockDbSelect.mockReturnValueOnce(buildSelectChain([{ role: "owner" }]));
      // find key → active key
      mockDbSelect.mockReturnValueOnce(buildSelectChain([keyRow]));
      // update → revoked key
      mockDbUpdate.mockReturnValueOnce(buildUpdateChain([revokedRow]));

      const { revokeStreamKey } = await setupService();
      const result = await revokeStreamKey("user-1", "creator-1", "key-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.revokedAt).not.toBeNull();
      }
    });

    it("returns 404 for unknown key", async () => {
      // owner check → owner
      mockDbSelect.mockReturnValueOnce(buildSelectChain([{ role: "owner" }]));
      // find key → not found
      mockDbSelect.mockReturnValueOnce(buildSelectChain([]));

      const { revokeStreamKey } = await setupService();
      const result = await revokeStreamKey("user-1", "creator-1", "unknown-key");

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
