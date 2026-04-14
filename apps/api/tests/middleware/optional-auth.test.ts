import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import type { OptionalAuthEnv } from "../../src/middleware/optional-auth.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";

// ── Test Fixtures ──
// Better Auth returns Date objects; the middleware converts them to ISO strings.

const MOCK_USER = {
  ...makeMockUser(),
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};
const MOCK_SESSION = {
  ...makeMockSession(),
  expiresAt: new Date("2025-02-01T00:00:00Z"),
};

// ── Mock Setup ──

const mockGetSession = vi.fn();
const mockGetUserRoles = vi.fn();

const setupOptionalAuthApp = async (): Promise<Hono<OptionalAuthEnv>> => {
  vi.doMock("../../src/auth/auth.js", () => ({
    auth: {
      api: {
        getSession: mockGetSession,
      },
    },
  }));

  vi.doMock("../../src/auth/user-roles.js", () => ({
    getUserRoles: mockGetUserRoles,
  }));

  const { optionalAuth } = await import(
    "../../src/middleware/optional-auth.js"
  );

  const app = new Hono<OptionalAuthEnv>();
  app.get("/optional", optionalAuth, (c) => {
    return c.json({
      user: c.get("user"),
      session: c.get("session"),
      roles: c.get("roles"),
    });
  });
  return app;
};

// ── Tests ──

describe("optionalAuth middleware", () => {
  let app: Hono<OptionalAuthEnv>;

  beforeEach(async () => {
    mockGetSession.mockReset();
    mockGetUserRoles.mockReset();
    mockGetUserRoles.mockResolvedValue([]);
    app = await setupOptionalAuthApp();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("sets user, session, and roles on context when session is valid", async () => {
    mockGetSession.mockResolvedValue({
      user: MOCK_USER,
      session: MOCK_SESSION,
    });
    mockGetUserRoles.mockResolvedValue(["stakeholder"]);

    const res = await app.request("/optional", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(MOCK_USER.id);
    expect(body.user.email).toBe(MOCK_USER.email);
    expect(body.user.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(body.user.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(body.session.id).toBe(MOCK_SESSION.id);
    expect(body.session.expiresAt).toBe("2025-02-01T00:00:00.000Z");
    expect(body.roles).toStrictEqual(["stakeholder"]);
    expect(mockGetUserRoles).toHaveBeenCalledWith(MOCK_USER.id);
  });

  it("sets null user, null session, and empty roles when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await app.request("/optional");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
    expect(body.session).toBeNull();
    expect(body.roles).toStrictEqual([]);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });

  it("sets null user, null session, and empty roles when session resolution throws", async () => {
    mockGetSession.mockRejectedValue(new Error("auth service unavailable"));

    const res = await app.request("/optional");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
    expect(body.session).toBeNull();
    expect(body.roles).toStrictEqual([]);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });

  it("normalizes user.image to null when undefined", async () => {
    mockGetSession.mockResolvedValue({
      user: { ...MOCK_USER, image: undefined },
      session: MOCK_SESSION,
    });

    const res = await app.request("/optional", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.image).toBeNull();
  });

  it("passes raw request headers to auth.api.getSession", async () => {
    mockGetSession.mockResolvedValue(null);

    await app.request("/optional", {
      headers: {
        Cookie: "better-auth.session_token=some_token",
        "X-Custom": "value",
      },
    });

    expect(mockGetSession).toHaveBeenCalledOnce();
    const callArg = mockGetSession.mock.calls[0]?.[0] as { headers: Headers };
    expect(callArg).toHaveProperty("headers");
    expect(callArg.headers).toBeInstanceOf(Headers);
  });
});
