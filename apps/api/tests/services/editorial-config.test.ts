import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ── Drizzle-chainable mock state ──
//
// editorial-config makes the following Drizzle calls:
//   getEditorialConfig:       select().from().where()                          → []
//   getAllEditorialConfigs:    select().from() [x2] + orderBy()                → parallel
//   upsertEditorialConfig:    insert().values().onConflictDoUpdate().returning()
//   deleteEditorialConfig:    delete().where().returning()
//   createEditorialTier:      select().from().where() [for carry edges]
//                             insert().values().returning()
//   updateEditorialTier:      select().from().where() [current row]
//                             select().from().where() [carry edges]
//                             update().set().where().returning()
//   deleteEditorialTier:      delete().where().returning()
//   getEditorialTiers:        select().from().where().orderBy()

// We set up a superset of the needed chain nodes and re-wire in beforeEach.

// ── SELECT chain ──
const mockSelectOrderBy = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

// ── INSERT chain ──
const mockInsertReturning = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

// ── UPDATE chain ──
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdate = vi.fn();

// ── DELETE chain ──
const mockDeleteReturning = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

// ── Sample data ──

const NOW = new Date("2026-06-16T12:00:00.000Z");

const makeConfigRow = (overrides?: Partial<{
  channelId: string;
  mode: string;
  manualTierId: string | null;
  updatedAt: Date;
}>) => ({
  channelId: "chan-1",
  mode: "auto",
  manualTierId: null,
  updatedAt: NOW,
  ...overrides,
});

const makeTierRow = (overrides?: Partial<{
  id: string;
  channelId: string;
  tierType: string;
  priority: number;
  sourceChannelId: string | null;
}>) => ({
  id: "tier-1",
  channelId: "chan-1",
  tierType: "queue",
  priority: 0,
  sourceChannelId: null,
  ...overrides,
});

// ── Module setup factory ──

const setupModule = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/editorial.schema.js", () => ({
    channelEditorialConfig: {
      channelId: "channelId",
      mode: "mode",
      manualTierId: "manualTierId",
      updatedAt: "updatedAt",
    },
    channelEditorialTiers: {
      id: "id",
      channelId: "channelId",
      tierType: "tierType",
      priority: "priority",
      sourceChannelId: "sourceChannelId",
    },
  }));

  return await import("../../src/services/editorial-config.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// Re-wire chain after each reset
beforeEach(() => {
  // SELECT: select().from().where() or select().from().orderBy() or select().from().where().orderBy()
  mockSelectOrderBy.mockResolvedValue([]);
  mockSelectWhere.mockResolvedValue([]);
  mockSelectFrom.mockReturnValue({
    where: mockSelectWhere,
    orderBy: mockSelectOrderBy,
  });
  mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy });
  mockSelectOrderBy.mockResolvedValue([]);
  mockSelect.mockReturnValue({ from: mockSelectFrom });

  // INSERT: insert().values().onConflictDoUpdate().returning()
  mockInsertReturning.mockResolvedValue([]);
  mockOnConflictDoUpdate.mockReturnValue({ returning: mockInsertReturning });
  mockInsertValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate, returning: mockInsertReturning });
  mockInsert.mockReturnValue({ values: mockInsertValues });

  // UPDATE: update().set().where().returning()
  mockUpdateReturning.mockResolvedValue([]);
  mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });

  // DELETE: delete().where().returning()
  mockDeleteReturning.mockResolvedValue([]);
  mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
});

// ── getEditorialConfig ──

describe("getEditorialConfig", () => {
  it("returns the config when it exists", async () => {
    const { getEditorialConfig } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makeConfigRow()]);

    const result = await getEditorialConfig("chan-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.channelId).toBe("chan-1");
      expect(result.value.mode).toBe("auto");
      expect(result.value.manualTierId).toBeNull();
      expect(result.value.updatedAt).toBe(NOW.toISOString());
    }
  });

  it("returns NotFoundError when no config exists", async () => {
    const { getEditorialConfig } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([]);

    const result = await getEditorialConfig("chan-missing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ── getAllEditorialConfigs ──

describe("getAllEditorialConfigs", () => {
  it("returns configs with their ordered tiers", async () => {
    const { getAllEditorialConfigs } = await setupModule();

    // First select() call → configs, second select() call → tiers
    let selectCallCount = 0;
    mockSelectFrom.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // configs select: .from() resolves directly
        return {
          // No .where() or .orderBy() — Promise.all awaits the select itself
          then: (resolve: (v: unknown) => void) =>
            resolve([makeConfigRow()]),
          where: mockSelectWhere,
          orderBy: mockSelectOrderBy,
        };
      }
      // tiers select: .from().orderBy()
      return {
        where: mockSelectWhere,
        orderBy: vi.fn().mockResolvedValue([
          makeTierRow({ id: "tier-1", priority: 0 }),
          makeTierRow({ id: "tier-2", priority: 1, tierType: "pool" }),
        ]),
      };
    });

    // The service does Promise.all([db.select().from(cfg), db.select().from(tiers).orderBy()])
    // Patch the two select calls to return appropriate resolved values
    let mockSelectCallCount = 0;
    mockSelect.mockImplementation(() => {
      mockSelectCallCount++;
      if (mockSelectCallCount === 1) {
        return {
          from: vi.fn().mockResolvedValue([makeConfigRow()]),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            makeTierRow({ id: "tier-1", priority: 0 }),
            makeTierRow({ id: "tier-2", priority: 1, tierType: "pool" }),
          ]),
        }),
      };
    });

    const result = await getAllEditorialConfigs();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.channelId).toBe("chan-1");
      expect(result.value[0]?.tiers).toHaveLength(2);
      expect(result.value[0]?.tiers[0]?.priority).toBe(0);
      expect(result.value[0]?.tiers[1]?.priority).toBe(1);
    }
  });

  it("returns empty array when no configs exist", async () => {
    const { getAllEditorialConfigs } = await setupModule();

    let mockSelectCallCount = 0;
    mockSelect.mockImplementation(() => {
      mockSelectCallCount++;
      if (mockSelectCallCount === 1) {
        return { from: vi.fn().mockResolvedValue([]) };
      }
      return { from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) };
    });

    const result = await getAllEditorialConfigs();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });
});

// ── upsertEditorialConfig ──

describe("upsertEditorialConfig", () => {
  it("creates config when none exists (round-trip shape)", async () => {
    const { upsertEditorialConfig } = await setupModule();
    const row = makeConfigRow({ mode: "auto" });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await upsertEditorialConfig("chan-1", { mode: "auto" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.channelId).toBe("chan-1");
      expect(result.value.mode).toBe("auto");
      expect(result.value.manualTierId).toBeNull();
    }
  });

  it("updates config with manualTierId (manual mode round-trip)", async () => {
    const { upsertEditorialConfig } = await setupModule();
    const row = makeConfigRow({ mode: "manual", manualTierId: "tier-99" });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await upsertEditorialConfig("chan-1", {
      mode: "manual",
      manualTierId: "tier-99",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe("manual");
      expect(result.value.manualTierId).toBe("tier-99");
    }
  });

  it("returns ValidationError when insert returns no row", async () => {
    const { upsertEditorialConfig } = await setupModule();
    mockInsertReturning.mockResolvedValueOnce([]);

    const result = await upsertEditorialConfig("chan-missing", { mode: "auto" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

// ── deleteEditorialConfig ──

describe("deleteEditorialConfig", () => {
  it("returns ok when config is deleted", async () => {
    const { deleteEditorialConfig } = await setupModule();
    mockDeleteReturning.mockResolvedValueOnce([{ channelId: "chan-1" }]);

    const result = await deleteEditorialConfig("chan-1");

    expect(result.ok).toBe(true);
  });

  it("returns NotFoundError when config does not exist", async () => {
    const { deleteEditorialConfig } = await setupModule();
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteEditorialConfig("chan-missing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ── createEditorialTier ──

describe("createEditorialTier", () => {
  it("creates a queue tier (sourceChannelId must be null)", async () => {
    const { createEditorialTier } = await setupModule();
    // No carry-edge select needed for non-channel-as-source tiers
    const row = makeTierRow({ tierType: "queue", priority: 0 });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-1", {
      tierType: "queue",
      priority: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tierType).toBe("queue");
      expect(result.value.priority).toBe(0);
      expect(result.value.sourceChannelId).toBeNull();
    }
  });

  it("rejects when tierType is 'channel-as-source' but sourceChannelId is null", async () => {
    const { createEditorialTier } = await setupModule();

    const result = await createEditorialTier("chan-1", {
      tierType: "channel-as-source",
      priority: 2,
      // sourceChannelId omitted
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("sourceChannelId");
    }
  });

  it("rejects when tierType is NOT 'channel-as-source' but sourceChannelId is set", async () => {
    const { createEditorialTier } = await setupModule();

    const result = await createEditorialTier("chan-1", {
      tierType: "pool",
      priority: 1,
      sourceChannelId: "chan-other",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("sourceChannelId");
    }
  });

  it("creates a channel-as-source tier when sourceChannelId is provided and no cycle", async () => {
    const { createEditorialTier } = await setupModule();

    // The select for existing carry edges returns empty (no existing edges)
    mockSelectWhere.mockResolvedValueOnce([]);

    const row = makeTierRow({
      tierType: "channel-as-source",
      priority: 3,
      sourceChannelId: "chan-source",
    });
    // Need to reset so insert chain resolves correctly
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-1", {
      tierType: "channel-as-source",
      priority: 3,
      sourceChannelId: "chan-source",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tierType).toBe("channel-as-source");
      expect(result.value.sourceChannelId).toBe("chan-source");
    }
  });

  it("rejects a cycle-forming channel-as-source write", async () => {
    const { createEditorialTier } = await setupModule();

    // chan-source already carries chan-1 (would create A → B, B → A cycle)
    mockSelectWhere.mockResolvedValueOnce([
      { channelId: "chan-source", sourceChannelId: "chan-1" },
    ]);

    const result = await createEditorialTier("chan-1", {
      tierType: "channel-as-source",
      priority: 3,
      sourceChannelId: "chan-source",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("cycle");
    }
  });
});

// ── deleteEditorialTier ──

describe("deleteEditorialTier", () => {
  it("returns ok when tier is deleted", async () => {
    const { deleteEditorialTier } = await setupModule();
    mockDeleteReturning.mockResolvedValueOnce([{ id: "tier-1" }]);

    const result = await deleteEditorialTier("tier-1");

    expect(result.ok).toBe(true);
  });

  it("returns NotFoundError when tier does not exist", async () => {
    const { deleteEditorialTier } = await setupModule();
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteEditorialTier("tier-missing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ── getEditorialTiers ──

describe("getEditorialTiers", () => {
  it("returns tiers ordered by priority", async () => {
    const { getEditorialTiers } = await setupModule();
    mockSelectOrderBy.mockResolvedValueOnce([
      makeTierRow({ id: "tier-1", priority: 0 }),
      makeTierRow({ id: "tier-2", priority: 1, tierType: "pool" }),
    ]);

    const result = await getEditorialTiers("chan-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.id).toBe("tier-1");
      expect(result.value[1]?.id).toBe("tier-2");
    }
  });

  it("returns empty array when channel has no tiers", async () => {
    const { getEditorialTiers } = await setupModule();
    mockSelectOrderBy.mockResolvedValueOnce([]);

    const result = await getEditorialTiers("chan-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });
});
