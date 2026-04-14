import { describe, it, expect, vi, afterEach } from "vitest";

import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";

// ── Mock Setup ──

const mockGetUserRoles = vi.fn();

const setupAuthHelpers = async () => {
  vi.doMock("../../src/auth/auth.js", () => ({
    auth: {
      api: { getSession: vi.fn() },
    },
  }));

  vi.doMock("../../src/auth/user-roles.js", () => ({
    getUserRoles: mockGetUserRoles,
  }));

  return await import("../../src/middleware/auth-helpers.js");
};

// ── Raw Session Fixtures ──
// Better Auth returns Date objects; hydrateAuthContext converts them to ISO strings.

const RAW_USER = {
  ...makeMockUser(),
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-06-15T10:30:00Z"),
  image: undefined as string | undefined | null,
};

const RAW_SESSION = {
  ...makeMockSession(),
  expiresAt: new Date("2025-02-01T00:00:00Z"),
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

// ── Tests ──

describe("hydrateAuthContext", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("converts user Date fields to ISO strings", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: null },
      session: RAW_SESSION,
    });

    expect(result.user.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(result.user.updatedAt).toBe("2025-06-15T10:30:00.000Z");
  });

  it("converts session.expiresAt Date to ISO string", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: null },
      session: RAW_SESSION,
    });

    expect(result.session.expiresAt).toBe("2025-02-01T00:00:00.000Z");
  });

  it("normalizes undefined image to null", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: undefined },
      session: RAW_SESSION,
    });

    expect(result.user.image).toBeNull();
  });

  it("preserves image when it is a string", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: "https://example.com/avatar.png" },
      session: RAW_SESSION,
    });

    expect(result.user.image).toBe("https://example.com/avatar.png");
  });

  it("preserves null image when explicitly null", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: null },
      session: RAW_SESSION,
    });

    expect(result.user.image).toBeNull();
  });

  it("fetches roles via getUserRoles using the user ID", async () => {
    mockGetUserRoles.mockResolvedValue(["admin", "stakeholder"]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: null },
      session: RAW_SESSION,
    });

    expect(mockGetUserRoles).toHaveBeenCalledWith(RAW_USER.id);
    expect(result.roles).toStrictEqual(["admin", "stakeholder"]);
  });

  it("returns empty roles array when user has no roles", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: null },
      session: RAW_SESSION,
    });

    expect(result.roles).toStrictEqual([]);
  });

  it("preserves non-date user fields unchanged", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: null },
      session: RAW_SESSION,
    });

    expect(result.user.id).toBe(RAW_USER.id);
    expect(result.user.email).toBe(RAW_USER.email);
    expect(result.user.name).toBe(RAW_USER.name);
    expect(result.user.emailVerified).toBe(RAW_USER.emailVerified);
  });

  it("preserves non-date session fields unchanged", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    const { hydrateAuthContext } = await setupAuthHelpers();

    const result = await hydrateAuthContext({
      user: { ...RAW_USER, image: null },
      session: RAW_SESSION,
    });

    expect(result.session.id).toBe(RAW_SESSION.id);
    expect(result.session.userId).toBe(RAW_SESSION.userId);
    expect(result.session.token).toBe(RAW_SESSION.token);
  });
});
