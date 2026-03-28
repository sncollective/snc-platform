import { describe, it, expect, vi, afterEach } from "vitest";

// ── Setup Factory ──

const setupModule = async () => {
  // Create fresh mocks per test so vi.resetAllMocks() doesn't clear implementations
  const mockBossStart = vi.fn().mockResolvedValue(undefined);
  const mockBossStop = vi.fn().mockResolvedValue(undefined);
  const mockBossOn = vi.fn();

  const mockBossInstance = {
    start: mockBossStart,
    stop: mockBossStop,
    on: mockBossOn,
  };

  // Use a class so it can be called with `new`
  class MockPgBoss {
    start = mockBossStart;
    stop = mockBossStop;
    on = mockBossOn;
  }

  // Track constructor calls via vi.spyOn equivalent — wrap the class in a spy-able way
  const MockPgBossSpy = vi.fn(function MockPgBossImpl(this: MockPgBoss) {
    this.start = mockBossStart;
    this.stop = mockBossStop;
    this.on = mockBossOn;
  });

  vi.doMock("pg-boss", () => ({
    PgBoss: MockPgBossSpy,
  }));
  vi.doMock("../../src/config.js", () => ({
    config: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      LOG_LEVEL: "info",
    },
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  }));

  const module = await import("../../src/jobs/boss.js");
  return { ...module, MockPgBossSpy, mockBossStart, mockBossStop, mockBossOn, mockBossInstance };
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Tests ──

describe("startBoss", () => {
  it("creates a PgBoss instance and calls start()", async () => {
    const { startBoss, MockPgBossSpy, mockBossStart } = await setupModule();

    const boss = await startBoss();

    expect(MockPgBossSpy).toHaveBeenCalledOnce();
    expect(mockBossStart).toHaveBeenCalledOnce();
    expect(boss).toBeDefined();
  });

  it("configures PgBoss with the DATABASE_URL and pgboss schema", async () => {
    const { startBoss, MockPgBossSpy } = await setupModule();

    await startBoss();

    expect(MockPgBossSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgres://test:test@localhost:5432/test",
        schema: "pgboss",
      }),
    );
  });

  it("registers an error event listener", async () => {
    const { startBoss, mockBossOn } = await setupModule();

    await startBoss();

    expect(mockBossOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("returns the same instance on second call (idempotent)", async () => {
    const { startBoss, MockPgBossSpy, mockBossStart } = await setupModule();

    const boss1 = await startBoss();
    const boss2 = await startBoss();

    // PgBoss constructor should only be called once
    expect(MockPgBossSpy).toHaveBeenCalledOnce();
    expect(mockBossStart).toHaveBeenCalledOnce();
    expect(boss1).toBe(boss2);
  });
});

describe("stopBoss", () => {
  it("calls graceful stop on the boss instance", async () => {
    const { startBoss, stopBoss, mockBossStop } = await setupModule();

    await startBoss();
    await stopBoss();

    expect(mockBossStop).toHaveBeenCalledWith();
  });

  it("sets boss to null after stopping (getBoss returns null)", async () => {
    const { startBoss, stopBoss, getBoss } = await setupModule();

    await startBoss();
    expect(getBoss()).not.toBeNull();

    await stopBoss();
    expect(getBoss()).toBeNull();
  });

  it("is safe to call when not started (no error)", async () => {
    const { stopBoss, mockBossStop } = await setupModule();

    // Should not throw
    await expect(stopBoss()).resolves.toBeUndefined();
    expect(mockBossStop).not.toHaveBeenCalled();
  });
});

describe("getBoss", () => {
  it("returns null before startBoss is called", async () => {
    const { getBoss } = await setupModule();

    expect(getBoss()).toBeNull();
  });

  it("returns the boss instance after startBoss is called", async () => {
    const { startBoss, getBoss } = await setupModule();

    await startBoss();
    expect(getBoss()).not.toBeNull();
  });
});
