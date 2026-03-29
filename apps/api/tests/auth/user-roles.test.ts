import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Role } from "@snc/shared";

// ── Mock State ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDb = { select: mockSelect };

// ── Setup Factory ──

const setupUserRoles = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: mockDb,
  }));

  vi.doMock("../../src/db/schema/user.schema.js", () => ({
    userRoles: {
      userId: {},
      role: {},
    },
  }));

  return await import("../../src/auth/user-roles.js");
};

// ── getUserRoles ──

describe("getUserRoles", () => {
  let getUserRoles: (userId: string) => Promise<Role[]>;

  beforeEach(async () => {
    mockSelectWhere.mockResolvedValue([]);
    const mod = await setupUserRoles();
    getUserRoles = mod.getUserRoles;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns an empty array when the user has no roles", async () => {
    mockSelectWhere.mockResolvedValue([]);

    const result = await getUserRoles("user-abc");

    expect(result).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns the roles for a user", async () => {
    mockSelectWhere.mockResolvedValue([
      { role: "stakeholder" },
      { role: "admin" },
    ]);

    const result = await getUserRoles("user-xyz");

    expect(result).toEqual(["stakeholder", "admin"]);
  });

  it("returns a single role when only one is assigned", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "admin" }]);

    const result = await getUserRoles("user-123");

    expect(result).toStrictEqual(["admin"]);
  });

  it("calls db.select with the correct userId", async () => {
    mockSelectWhere.mockResolvedValue([]);

    await getUserRoles("user-target");

    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockSelectFrom).toHaveBeenCalledOnce();
    expect(mockSelectWhere).toHaveBeenCalledOnce();
  });
});

// ── batchGetUserRoles ──

describe("batchGetUserRoles", () => {
  let batchGetUserRoles: (userIds: string[]) => Promise<Map<string, Role[]>>;

  beforeEach(async () => {
    mockSelectWhere.mockResolvedValue([]);
    const mod = await setupUserRoles();
    batchGetUserRoles = mod.batchGetUserRoles;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns an empty Map when given an empty array", async () => {
    const result = await batchGetUserRoles([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    // DB should not be queried for an empty input
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns a Map with roles grouped by userId", async () => {
    mockSelectWhere.mockResolvedValue([
      { userId: "user-1", role: "stakeholder" },
      { userId: "user-2", role: "admin" },
      { userId: "user-1", role: "admin" },
    ]);

    const result = await batchGetUserRoles(["user-1", "user-2"]);

    expect(result.get("user-1")).toEqual(["stakeholder", "admin"]);
    expect(result.get("user-2")).toEqual(["admin"]);
  });

  it("returns an empty Map when no rows are returned for the given users", async () => {
    mockSelectWhere.mockResolvedValue([]);

    const result = await batchGetUserRoles(["user-no-roles"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("handles a single user with a single role", async () => {
    mockSelectWhere.mockResolvedValue([{ userId: "user-solo", role: "stakeholder" }]);

    const result = await batchGetUserRoles(["user-solo"]);

    expect(result.get("user-solo")).toStrictEqual(["stakeholder"]);
    expect(result.size).toBe(1);
  });

  it("does not include entries for users with no roles in the result", async () => {
    mockSelectWhere.mockResolvedValue([
      { userId: "user-with-role", role: "admin" },
    ]);

    const result = await batchGetUserRoles(["user-with-role", "user-no-role"]);

    expect(result.has("user-with-role")).toBe(true);
    expect(result.has("user-no-role")).toBe(false);
  });
});
