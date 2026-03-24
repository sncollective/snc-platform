import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ForbiddenError, CREATOR_ROLE_PERMISSIONS } from "@snc/shared";

// ── Mock State ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDb = { select: mockSelect };

const mockGetUserRoles = vi.fn();

// ── Setup Factory ──

const setupCreatorTeam = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: mockDb,
  }));

  vi.doMock("../../src/auth/user-roles.js", () => ({
    getUserRoles: mockGetUserRoles,
  }));

  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorMembers: {
      userId: {},
      creatorId: {},
      role: {},
    },
  }));

  return await import("../../src/services/creator-team.js");
};

// ── Tests ──

describe("getCreatorMemberships", () => {
  let getCreatorMemberships: (
    userId: string,
  ) => Promise<Array<{ creatorId: string; role: string }>>;

  beforeEach(async () => {
    mockSelectWhere.mockResolvedValue([]);
    const mod = await setupCreatorTeam();
    getCreatorMemberships = mod.getCreatorMemberships;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns memberships for a user", async () => {
    mockSelectWhere.mockResolvedValue([
      { creatorId: "creator_1", role: "owner" },
      { creatorId: "creator_2", role: "editor" },
    ]);

    const result = await getCreatorMemberships("user_123");

    expect(result).toEqual([
      { creatorId: "creator_1", role: "owner" },
      { creatorId: "creator_2", role: "editor" },
    ]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns empty array when user has no memberships", async () => {
    mockSelectWhere.mockResolvedValue([]);

    const result = await getCreatorMemberships("user_456");

    expect(result).toEqual([]);
  });
});

describe("checkCreatorPermission", () => {
  let checkCreatorPermission: (
    userId: string,
    creatorId: string,
    permission: string,
    userRoles?: string[],
  ) => Promise<boolean>;

  beforeEach(async () => {
    mockSelectWhere.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue([]);
    const mod = await setupCreatorTeam();
    checkCreatorPermission = mod.checkCreatorPermission;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns true when user has admin platform role", async () => {
    mockGetUserRoles.mockResolvedValue(["admin"]);

    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "editProfile",
    );

    expect(result).toBe(true);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("bypasses getUserRoles when userRoles are pre-fetched", async () => {
    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "editProfile",
      ["admin"],
    );

    expect(result).toBe(true);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });

  it("returns true when user is owner and has the permission", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "owner" }]);

    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "manageMembers",
    );

    expect(result).toBe(true);
  });

  it("returns true when user is editor with editProfile permission", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "editor" }]);

    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "editProfile",
    );

    expect(result).toBe(true);
  });

  it("returns false when user is editor and lacks manageMembers permission", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "editor" }]);

    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "manageMembers",
    );

    expect(result).toBe(false);
  });

  it("returns false when user is viewer and lacks editProfile permission", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "viewer" }]);

    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "editProfile",
    );

    expect(result).toBe(false);
  });

  it("returns true when viewer has viewPrivate permission", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "viewer" }]);

    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "viewPrivate",
    );

    expect(result).toBe(true);
  });

  it("returns false when user is not a member of the creator", async () => {
    mockSelectWhere.mockResolvedValue([]);

    const result = await checkCreatorPermission(
      "user_123",
      "creator_456",
      "editProfile",
    );

    expect(result).toBe(false);
  });

  it("falls back to getUserRoles when userRoles is undefined", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    mockSelectWhere.mockResolvedValue([]);

    await checkCreatorPermission("user_123", "creator_456", "editProfile");

    expect(mockGetUserRoles).toHaveBeenCalledWith("user_123");
  });
});

describe("requireCreatorPermission", () => {
  let requireCreatorPermission: (
    userId: string,
    creatorId: string,
    permission: string,
    userRoles?: string[],
  ) => Promise<void>;

  beforeEach(async () => {
    mockSelectWhere.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue([]);
    const mod = await setupCreatorTeam();
    requireCreatorPermission = mod.requireCreatorPermission;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("does not throw when user has the required permission", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "owner" }]);

    await expect(
      requireCreatorPermission(
        "user_123",
        "creator_456",
        "manageMembers",
      ),
    ).resolves.toBeUndefined();
  });

  it("throws ForbiddenError when user lacks the permission", async () => {
    mockSelectWhere.mockResolvedValue([{ role: "viewer" }]);

    await expect(
      requireCreatorPermission(
        "user_123",
        "creator_456",
        "editProfile",
      ),
    ).rejects.toThrow("Insufficient permissions");
  });

  it("throws ForbiddenError when user is not a member of the creator", async () => {
    mockSelectWhere.mockResolvedValue([]);

    await expect(
      requireCreatorPermission(
        "user_123",
        "creator_456",
        "manageContent",
      ),
    ).rejects.toThrow("Insufficient permissions");
  });

  it("does not throw when user has admin role", async () => {
    mockGetUserRoles.mockResolvedValue(["admin"]);

    await expect(
      requireCreatorPermission(
        "user_123",
        "creator_456",
        "manageMembers",
      ),
    ).resolves.toBeUndefined();
  });

  it("uses pre-fetched userRoles when provided", async () => {
    await expect(
      requireCreatorPermission(
        "user_123",
        "creator_456",
        "editProfile",
        ["admin"],
      ),
    ).resolves.toBeUndefined();

    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });
});
