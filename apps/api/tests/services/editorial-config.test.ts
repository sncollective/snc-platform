import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ── Drizzle-chainable mock state ──
//
// editorial-config makes the following Drizzle calls:
//   getEditorialConfig:       select().from().where()                          → []
//   getAllEditorialConfigs:    select().from() [x2] + orderBy()                → parallel
//   upsertEditorialConfig:    select().from().where()  [manualTierId check]
//                             insert().values().onConflictDoUpdate().returning()
//   deleteEditorialConfig:    delete().where().returning()
//   createEditorialTier:      select().from().where()  [fetchChannel]
//                             select().from().where()  [existingTiers]
//                             select().from().where()  [carry edges — channel-as-source only]
//                             insert().values().returning()
//   updateEditorialTier:      select().from().where()  [current row]
//                             select().from().where()  [fetchChannel — on tierType change]
//                             select().from().where()  [existingTiers — on tierType change]
//                             select().from().where()  [carry edges — channel-as-source]
//                             update().set().where().returning()
//   deleteEditorialTier:      delete().where().returning()
//   getEditorialTiers:        select().from().where().orderBy()

// We set up a superset of the needed chain nodes and re-wire in beforeEach.
// Individual tests that need sequential mockResolvedValueOnce calls can do so
// on the shared mock functions.

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

const NOW = new Date("2026-06-17T12:00:00.000Z");

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
  enabled: boolean;
  sourceChannelId: string | null;
}>) => ({
  id: "tier-1",
  channelId: "chan-1",
  tierType: "queue",
  priority: 0,
  enabled: true,
  sourceChannelId: null,
  ...overrides,
});

const makePlatformChannel = (overrides?: Partial<{
  ownership: string;
  creatorId: string | null;
  role: string;
}>) => ({
  ownership: "platform",
  creatorId: null,
  role: "playout",
  ...overrides,
});

const makeBroadcastChannel = () => ({
  ownership: "platform",
  creatorId: null,
  role: "broadcast",
});

const makeCreatorChannel = (creatorId = "creator-1") => ({
  ownership: "creator",
  creatorId,
  role: "playout",
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
      enabled: "enabled",
      sourceChannelId: "sourceChannelId",
    },
  }));
  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: {
      id: "id",
      ownership: "ownership",
      creatorId: "creatorId",
      role: "role",
      defaultPlayoutChannelId: "defaultPlayoutChannelId",
    },
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
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
  //         insert().values().returning()  (direct returning for non-upsert)
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

// ── poolContentScope ──

describe("poolContentScope", () => {
  it("returns { allCreators: true } for a platform-owned channel", async () => {
    const { poolContentScope } = await setupModule();
    const scope = poolContentScope(makePlatformChannel());
    expect(scope).toEqual({ allCreators: true });
  });

  it("returns { allCreators: true } for a platform channel with no creatorId", async () => {
    const { poolContentScope } = await setupModule();
    const scope = poolContentScope({ ownership: "platform", creatorId: null });
    expect(scope).toEqual({ allCreators: true });
  });

  it("returns { creatorId } for a creator-owned channel", async () => {
    const { poolContentScope } = await setupModule();
    const scope = poolContentScope(makeCreatorChannel("creator-42"));
    expect(scope).toEqual({ creatorId: "creator-42" });
  });

  it("falls back to allCreators when ownership is 'creator' but creatorId is null", async () => {
    const { poolContentScope } = await setupModule();
    // Edge case: ownership='creator' but no creatorId (data inconsistency) → allCreators
    const scope = poolContentScope({ ownership: "creator", creatorId: null });
    expect(scope).toEqual({ allCreators: true });
  });
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
  it("returns configs with their ordered tiers (including enabled field)", async () => {
    const { getAllEditorialConfigs } = await setupModule();

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
            makeTierRow({ id: "tier-1", priority: 0, enabled: true }),
            makeTierRow({ id: "tier-2", priority: 1, tierType: "channel-as-source", sourceChannelId: "chan-2", enabled: false }),
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
      expect(result.value[0]?.tiers[0]?.enabled).toBe(true);
      expect(result.value[0]?.tiers[1]?.priority).toBe(1);
      expect(result.value[0]?.tiers[1]?.enabled).toBe(false);
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
  it("creates config when none exists (auto mode, no manualTierId)", async () => {
    const { upsertEditorialConfig } = await setupModule();
    const row = makeConfigRow({ mode: "auto" });
    // No manualTierId — skips the tier ownership check; goes straight to insert
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await upsertEditorialConfig("chan-1", { mode: "auto" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.channelId).toBe("chan-1");
      expect(result.value.mode).toBe("auto");
      expect(result.value.manualTierId).toBeNull();
    }
  });

  it("updates config with manualTierId when the tier belongs to the same channel", async () => {
    const { upsertEditorialConfig } = await setupModule();
    // Tier ownership check: manualTierId lookup returns a tier on the same channel
    mockSelectWhere.mockResolvedValueOnce([{ channelId: "chan-1" }]);
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

  it("rejects manualTierId that does not exist", async () => {
    const { upsertEditorialConfig } = await setupModule();
    // Tier lookup returns nothing → tier not found
    mockSelectWhere.mockResolvedValueOnce([]);

    const result = await upsertEditorialConfig("chan-1", {
      mode: "manual",
      manualTierId: "tier-missing",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("tier-missing");
    }
  });

  it("rejects manualTierId belonging to a different channel (same-channel validation)", async () => {
    const { upsertEditorialConfig } = await setupModule();
    // Tier lookup returns a tier that belongs to chan-other, not chan-1
    mockSelectWhere.mockResolvedValueOnce([{ channelId: "chan-other" }]);

    const result = await upsertEditorialConfig("chan-1", {
      mode: "manual",
      manualTierId: "tier-on-other-chan",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("chan-other");
    }
  });

  it("returns ValidationError when insert returns no row", async () => {
    const { upsertEditorialConfig } = await setupModule();
    // No manualTierId → no ownership check; insert returns empty
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

  it("does NOT cascade tiers — only the config row is deleted", async () => {
    // Semantic verification: deleteEditorialConfig only calls db.delete once
    // (the config row). Tiers FK to channels.id, not the config row, so they
    // are not cascade-deleted here. This test guards against future regressions
    // that accidentally add a tier-delete call.
    const { deleteEditorialConfig } = await setupModule();
    mockDeleteReturning.mockResolvedValueOnce([{ channelId: "chan-1" }]);

    await deleteEditorialConfig("chan-1");

    expect(mockDelete).toHaveBeenCalledTimes(1);
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
  it("creates a queue tier for a platform channel (enabled defaults true)", async () => {
    const { createEditorialTier } = await setupModule();
    // fetchChannel → platform channel
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    // existingTiers → none
    mockSelectWhere.mockResolvedValueOnce([]);
    const row = makeTierRow({ tierType: "queue", priority: 0, enabled: true });
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
      expect(result.value.enabled).toBe(true);
      expect(result.value.sourceChannelId).toBeNull();
    }
  });

  it("creates a tier with enabled=false when explicitly set", async () => {
    const { createEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    mockSelectWhere.mockResolvedValueOnce([]);
    const row = makeTierRow({ tierType: "live", priority: 0, enabled: false });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-1", {
      tierType: "live",
      priority: 0,
      enabled: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enabled).toBe(false);
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
      tierType: "queue",
      priority: 1,
      sourceChannelId: "chan-other",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("sourceChannelId");
    }
  });

  it("creates a channel-as-source tier on a platform channel with no cycle and no existing live tier", async () => {
    const { createEditorialTier } = await setupModule();

    // fetchChannel → platform channel
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    // existingTiers → no live tier
    mockSelectWhere.mockResolvedValueOnce([]);
    // carry edges → empty (no existing channel-as-source edges)
    mockSelectWhere.mockResolvedValueOnce([]);

    const row = makeTierRow({
      tierType: "channel-as-source",
      priority: 3,
      sourceChannelId: "chan-source",
    });
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

    // fetchChannel → platform channel
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    // existingTiers → no conflicting tiers
    mockSelectWhere.mockResolvedValueOnce([]);
    // carry edges → chan-source already carries chan-1 (A → B, B → A cycle)
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

  // ── Ownership validation: creator channel constraints ──

  it("rejects 'channel-as-source' tier on a creator-owned channel", async () => {
    const { createEditorialTier } = await setupModule();
    // The sourceConstraint check passes first (sourceChannelId IS set),
    // then fetchChannel returns a creator channel → ownership reject
    // fetchChannel
    mockSelectWhere.mockResolvedValueOnce([makeCreatorChannel()]);
    // Note: existingTiers query never reached; ownership check fires first

    const result = await createEditorialTier("chan-creator", {
      tierType: "channel-as-source",
      priority: 1,
      sourceChannelId: "chan-other",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Creator-owned");
    }
  });

  it("allows 'queue' tier on a creator-owned channel", async () => {
    const { createEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makeCreatorChannel()]);
    mockSelectWhere.mockResolvedValueOnce([]); // existingTiers
    const row = makeTierRow({ tierType: "queue", channelId: "chan-creator" });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-creator", {
      tierType: "queue",
      priority: 0,
    });

    expect(result.ok).toBe(true);
  });

  it("allows 'live' tier on a creator-owned channel", async () => {
    const { createEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makeCreatorChannel()]);
    mockSelectWhere.mockResolvedValueOnce([]);
    const row = makeTierRow({ tierType: "live", channelId: "chan-creator" });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-creator", {
      tierType: "live",
      priority: 0,
    });

    expect(result.ok).toBe(true);
  });

  // ── Ownership validation: admin channel constraints ──

  it("rejects 'channel-as-source' tier on an admin channel that already has 'live'", async () => {
    const { createEditorialTier } = await setupModule();
    // fetchChannel → platform channel
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    // existingTiers → already has a 'live' tier
    mockSelectWhere.mockResolvedValueOnce([
      { id: "tier-live", tierType: "live" },
    ]);

    const result = await createEditorialTier("chan-admin", {
      tierType: "channel-as-source",
      priority: 1,
      sourceChannelId: "chan-other",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("mutually exclusive");
    }
  });

  it("rejects 'live' tier on an admin channel that already has 'channel-as-source'", async () => {
    const { createEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    mockSelectWhere.mockResolvedValueOnce([
      { id: "tier-carry", tierType: "channel-as-source" },
    ]);

    const result = await createEditorialTier("chan-admin", {
      tierType: "live",
      priority: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("mutually exclusive");
    }
  });

  // ── Broadcast exemption: S/NC TV may hold both live + channel-as-source ──

  it("allows 'channel-as-source' on the broadcast channel that already has 'live' (exempt from XOR)", async () => {
    const { createEditorialTier } = await setupModule();
    // fetchChannel → broadcast channel (role: "broadcast")
    mockSelectWhere.mockResolvedValueOnce([makeBroadcastChannel()]);
    // existingTiers → already has a 'live' tier (would be rejected for a playout channel)
    mockSelectWhere.mockResolvedValueOnce([{ id: "tier-live", tierType: "live" }]);
    // carry edges → empty (no cycle)
    mockSelectWhere.mockResolvedValueOnce([]);
    const row = makeTierRow({
      tierType: "channel-as-source",
      priority: 2,
      sourceChannelId: "chan-classics",
    });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-broadcast", {
      tierType: "channel-as-source",
      priority: 2,
      sourceChannelId: "chan-classics",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tierType).toBe("channel-as-source");
    }
  });

  it("allows 'live' on the broadcast channel that already has 'channel-as-source' (exempt from XOR)", async () => {
    const { createEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makeBroadcastChannel()]);
    mockSelectWhere.mockResolvedValueOnce([
      { id: "tier-carry", tierType: "channel-as-source" },
    ]);
    const row = makeTierRow({ tierType: "live", priority: 0 });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-broadcast", {
      tierType: "live",
      priority: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tierType).toBe("live");
    }
  });

  it("allows 'queue' on an admin channel that already has 'live'", async () => {
    const { createEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    mockSelectWhere.mockResolvedValueOnce([{ id: "tier-live", tierType: "live" }]);
    const row = makeTierRow({ tierType: "queue", priority: 1 });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValueOnce([row]);

    const result = await createEditorialTier("chan-admin", {
      tierType: "queue",
      priority: 1,
    });

    expect(result.ok).toBe(true);
  });

  it("returns NotFoundError when channel does not exist", async () => {
    const { createEditorialTier } = await setupModule();
    // fetchChannel returns nothing
    mockSelectWhere.mockResolvedValueOnce([]);

    const result = await createEditorialTier("chan-missing", {
      tierType: "queue",
      priority: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ── updateEditorialTier ──

describe("updateEditorialTier", () => {
  it("updates priority only (no tierType or source change)", async () => {
    const { updateEditorialTier } = await setupModule();
    // Fetch current row
    mockSelectWhere.mockResolvedValueOnce([makeTierRow({ priority: 0 })]);
    // Update returns updated row
    mockUpdateReturning.mockResolvedValueOnce([makeTierRow({ priority: 5 })]);

    const result = await updateEditorialTier("tier-1", { priority: 5 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe(5);
    }
  });

  it("updates enabled flag (disable a tier)", async () => {
    const { updateEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makeTierRow({ enabled: true })]);
    mockUpdateReturning.mockResolvedValueOnce([makeTierRow({ enabled: false })]);

    const result = await updateEditorialTier("tier-1", { enabled: false });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enabled).toBe(false);
    }
  });

  it("updates tierType from 'queue' to 'live' (valid for platform channel)", async () => {
    const { updateEditorialTier } = await setupModule();
    // Current row: queue tier on a platform channel
    mockSelectWhere.mockResolvedValueOnce([makeTierRow({ tierType: "queue" })]);
    // fetchChannel → platform
    mockSelectWhere.mockResolvedValueOnce([makePlatformChannel()]);
    // existingTiers on that channel (excluding this tier) → no carry tier
    mockSelectWhere.mockResolvedValueOnce([]);
    mockUpdateReturning.mockResolvedValueOnce([makeTierRow({ tierType: "live" })]);

    const result = await updateEditorialTier("tier-1", { tierType: "live" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tierType).toBe("live");
    }
  });

  it("rejects tierType change to 'channel-as-source' on a creator channel", async () => {
    const { updateEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makeTierRow({ tierType: "queue", channelId: "chan-creator" })]);
    mockSelectWhere.mockResolvedValueOnce([makeCreatorChannel()]);
    mockSelectWhere.mockResolvedValueOnce([]); // existingTiers

    const result = await updateEditorialTier("tier-1", {
      tierType: "channel-as-source",
      sourceChannelId: "chan-other",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Creator-owned");
    }
  });

  it("rejects adding a channel-as-source carry edge that forms a cycle", async () => {
    const { updateEditorialTier } = await setupModule();
    // Current tier: already a channel-as-source tier, changing the source
    mockSelectWhere.mockResolvedValueOnce([
      makeTierRow({ tierType: "channel-as-source", sourceChannelId: "chan-old-source" }),
    ]);
    // tierType not changing → no ownership re-check
    // carry edges: chan-new-source → chan-1 (would form cycle with chan-1 → chan-new-source)
    mockSelectWhere.mockResolvedValueOnce([
      { channelId: "chan-new-source", sourceChannelId: "chan-1" },
    ]);

    const result = await updateEditorialTier("tier-1", {
      sourceChannelId: "chan-new-source",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("cycle");
    }
  });

  it("rejects sourceConstraint violation on update (carry without sourceChannelId)", async () => {
    const { updateEditorialTier } = await setupModule();
    // Current: channel-as-source; update tries to clear sourceChannelId
    mockSelectWhere.mockResolvedValueOnce([
      makeTierRow({ tierType: "channel-as-source", sourceChannelId: "chan-source" }),
    ]);

    const result = await updateEditorialTier("tier-1", {
      sourceChannelId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("sourceChannelId");
    }
  });

  it("returns NotFoundError when tier does not exist", async () => {
    const { updateEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([]);

    const result = await updateEditorialTier("tier-missing", { priority: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns NotFoundError when update returns no row (race condition)", async () => {
    const { updateEditorialTier } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([makeTierRow({ priority: 0 })]);
    // Update returns empty (race: deleted between select and update)
    mockUpdateReturning.mockResolvedValueOnce([]);

    const result = await updateEditorialTier("tier-1", { priority: 5 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
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
  it("returns tiers ordered by priority (with enabled field)", async () => {
    const { getEditorialTiers } = await setupModule();
    mockSelectOrderBy.mockResolvedValueOnce([
      makeTierRow({ id: "tier-1", priority: 0, enabled: true }),
      makeTierRow({ id: "tier-2", priority: 1, tierType: "channel-as-source", sourceChannelId: "chan-src", enabled: false }),
    ]);

    const result = await getEditorialTiers("chan-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.id).toBe("tier-1");
      expect(result.value[0]?.enabled).toBe(true);
      expect(result.value[1]?.id).toBe("tier-2");
      expect(result.value[1]?.enabled).toBe(false);
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

// ── ensureBroadcastEditorialConfig (BLOCKER 2: boot-time backfill) ──

describe("ensureBroadcastEditorialConfig", () => {
  it("no-ops (ok, no writes) when no broadcast channel exists", async () => {
    const { ensureBroadcastEditorialConfig } = await setupModule();
    // broadcast-channel lookup → none
    mockSelectWhere.mockResolvedValueOnce([]);

    const result = await ensureBroadcastEditorialConfig();

    expect(result.ok).toBe(true);
    // No config upsert attempted.
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips tier creation when the complete tier set already exists (idempotent)", async () => {
    const { ensureBroadcastEditorialConfig } = await setupModule();
    // 1) broadcast-channel lookup → broadcast with a carry target (expect 3 tiers)
    mockSelectWhere.mockResolvedValueOnce([
      { id: "snctv", defaultPlayoutChannelId: "classics" },
    ]);
    // 2) upsertEditorialConfig insert → config row
    mockInsertReturning.mockResolvedValueOnce([makeConfigRow({ channelId: "snctv" })]);
    // 3) getEditorialTiers → 3 tiers already present
    mockSelectOrderBy.mockResolvedValueOnce([
      makeTierRow({ id: "t0", channelId: "snctv", tierType: "live", priority: 0 }),
      makeTierRow({ id: "t1", channelId: "snctv", tierType: "queue", priority: 1 }),
      makeTierRow({ id: "t2", channelId: "snctv", tierType: "channel-as-source", priority: 2, sourceChannelId: "classics" }),
    ]);

    const result = await ensureBroadcastEditorialConfig();

    expect(result.ok).toBe(true);
    // Config upsert ran once (idempotent), but NO tier inserts beyond it.
    // The config upsert is the only insert; tier creation is skipped.
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("leaves a partial tier set untouched (does not duplicate or crash)", async () => {
    const { ensureBroadcastEditorialConfig } = await setupModule();
    mockSelectWhere.mockResolvedValueOnce([
      { id: "snctv", defaultPlayoutChannelId: "classics" },
    ]);
    mockInsertReturning.mockResolvedValueOnce([makeConfigRow({ channelId: "snctv" })]);
    // getEditorialTiers → only 1 of 3 tiers (a prior run failed mid-creation)
    mockSelectOrderBy.mockResolvedValueOnce([
      makeTierRow({ id: "t0", channelId: "snctv", tierType: "live", priority: 0 }),
    ]);

    const result = await ensureBroadcastEditorialConfig();

    // Returns ok (must not block boot), and does NOT create more tiers (only the config insert ran).
    expect(result.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
