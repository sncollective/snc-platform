import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import type { AuthEnv } from "../../src/middleware/auth-env.js";
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

const setupAuthApp = async (): Promise<Hono<AuthEnv>> => {
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

  const { requireAuth } = await import(
    "../../src/middleware/require-auth.js"
  );

  const { errorHandler } = await import(
    "../../src/middleware/error-handler.js"
  );

  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);
  app.get("/protected", requireAuth, (c) => {
    return c.json({
      user: c.get("user"),
      session: c.get("session"),
      roles: c.get("roles"),
    });
  });
  return app;
};

// ── Tests ──

describe("requireAuth middleware", () => {
  let app: Hono<AuthEnv>;

  beforeEach(async () => {
    mockGetSession.mockReset();
    mockGetUserRoles.mockReset();
    mockGetUserRoles.mockResolvedValue(["subscriber"]);
    app = await setupAuthApp();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 401 when no session cookie is present", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toStrictEqual({
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });
  });

  it("returns 401 when session is expired or invalid", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/protected", {
      headers: { Cookie: "better-auth.session_token=expired_token" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("sets user and session on context when session is valid", async () => {
    mockGetSession.mockResolvedValue({
      user: MOCK_USER,
      session: MOCK_SESSION,
    });
    const res = await app.request("/protected", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(MOCK_USER.id);
    expect(body.user.email).toBe(MOCK_USER.email);
    expect(body.session.id).toBe(MOCK_SESSION.id);
    expect(body.session.userId).toBe(MOCK_SESSION.userId);
  });

  it("passes raw request headers to auth.api.getSession", async () => {
    mockGetSession.mockResolvedValue({
      user: MOCK_USER,
      session: MOCK_SESSION,
    });
    await app.request("/protected", {
      headers: {
        Cookie: "better-auth.session_token=valid_token",
        "X-Custom": "value",
      },
    });
    expect(mockGetSession).toHaveBeenCalledOnce();
    const callArg = mockGetSession.mock.calls[0][0];
    expect(callArg).toHaveProperty("headers");
    expect(callArg.headers).toBeInstanceOf(Headers);
  });

  it("normalizes user.image to null when undefined", async () => {
    mockGetSession.mockResolvedValue({
      user: { ...MOCK_USER, image: undefined },
      session: MOCK_SESSION,
    });
    const res = await app.request("/protected", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.image).toBeNull();
  });

  it("preserves user.image when it is a string", async () => {
    mockGetSession.mockResolvedValue({
      user: { ...MOCK_USER, image: "https://example.com/avatar.png" },
      session: MOCK_SESSION,
    });
    const res = await app.request("/protected", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.image).toBe("https://example.com/avatar.png");
  });

  it("sets roles on context from getUserRoles after session validation", async () => {
    mockGetSession.mockResolvedValue({
      user: MOCK_USER,
      session: MOCK_SESSION,
    });
    mockGetUserRoles.mockResolvedValue(["subscriber", "creator"]);

    const res = await app.request("/protected", {
      headers: { Cookie: "better-auth.session_token=valid_token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roles).toStrictEqual(["subscriber", "creator"]);
    expect(mockGetUserRoles).toHaveBeenCalledWith(MOCK_USER.id);
  });

  it("does not call getUserRoles when session is invalid", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });
});
