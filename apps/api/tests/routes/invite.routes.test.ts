import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Service Mocks ──

const mockCreateInvite = vi.fn();
const mockValidateInvite = vi.fn();
const mockAcceptInvite = vi.fn();
const mockRequireCreatorPermission = vi.fn();

// ── Test Context ──

const ctx = setupRouteTest({
  defaultAuth: { user: makeMockUser(), roles: [] },
  mockAuth: false, // we provide our own requireAuth that also sets roles
  mocks: () => {
    vi.doMock("../../src/middleware/require-auth.js", () => ({
      requireAuth: async (c: any, next: any) => {
        const { UnauthorizedError } = await import("@snc/shared");
        if (!ctx.auth.user) throw new UnauthorizedError();
        c.set("user", ctx.auth.user);
        c.set("session", ctx.auth.session);
        c.set("roles", ctx.auth.roles);
        await next();
      },
    }));

    vi.doMock("../../src/services/invites.js", () => ({
      createInvite: mockCreateInvite,
      validateInvite: mockValidateInvite,
      acceptInvite: mockAcceptInvite,
    }));

    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
    }));
  },
  mountRoute: async (app) => {
    const { inviteRoutes } = await import("../../src/routes/invite.routes.js");
    app.route("/api/invites", inviteRoutes);
  },
  beforeEach: () => {
    mockCreateInvite.mockResolvedValue({ ok: true, value: { id: "inv-1", email: "a@b.com", expiresAt: new Date() } });
    mockValidateInvite.mockResolvedValue({
      ok: true,
      value: {
        id: "inv-1",
        type: "creator_owner",
        email: "a@b.com",
        payload: { displayName: "Test" },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    mockAcceptInvite.mockResolvedValue({ ok: true, value: { type: "creator_owner", creatorId: "creator-1" } });
    mockRequireCreatorPermission.mockResolvedValue(undefined);
  },
});

// ── Create Invite ──

describe("POST /api/invites", () => {
  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "creator_owner", email: "a@b.com", displayName: "Test" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin tries to create creator_owner invite", async () => {
    ctx.auth.roles = [];
    const res = await ctx.app.request("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "creator_owner", email: "a@b.com", displayName: "Test" }),
    });
    expect(res.status).toBe(403);
    expect(mockCreateInvite).not.toHaveBeenCalled();
  });

  it("allows admin to create creator_owner invite", async () => {
    ctx.auth.roles = ["admin"];
    const res = await ctx.app.request("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "creator_owner", email: "a@b.com", displayName: "Test Creator" }),
    });
    expect(res.status).toBe(201);
    expect(mockCreateInvite).toHaveBeenCalledWith(
      { type: "creator_owner", email: "a@b.com", displayName: "Test Creator" },
      "user_test123",
    );
  });

  it("allows creator owner to send team_member invite", async () => {
    ctx.auth.roles = [];
    const res = await ctx.app.request("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "team_member", email: "member@b.com", creatorId: "creator-1", role: "editor" }),
    });
    expect(res.status).toBe(201);
    expect(mockRequireCreatorPermission).toHaveBeenCalledWith(
      "user_test123",
      "creator-1",
      "manageMembers",
      [],
    );
  });

  it("returns 503 when email not configured", async () => {
    ctx.auth.roles = ["admin"];
    mockCreateInvite.mockResolvedValueOnce({
      ok: false,
      error: { code: "EMAIL_NOT_CONFIGURED", message: "Email not configured", statusCode: 503 },
    });
    const res = await ctx.app.request("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "creator_owner", email: "a@b.com", displayName: "Test" }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("returns 400 for invalid body", async () => {
    ctx.auth.roles = ["admin"];
    const res = await ctx.app.request("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "creator_owner" }), // missing email and displayName
    });
    expect(res.status).toBe(400);
  });
});

// ── Validate Invite ──

describe("GET /api/invites/:token", () => {
  it("returns invite details for valid token (public, no auth needed)", async () => {
    ctx.auth.user = null; // unauthenticated should still work
    const res = await ctx.app.request("/api/invites/valid-token-123");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("inv-1");
    expect(body.type).toBe("creator_owner");
    expect(body.email).toBe("a@b.com");
    expect(typeof body.expiresAt).toBe("string");
  });

  it("returns 404 for invalid or expired token", async () => {
    mockValidateInvite.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVITE_INVALID", message: "Invalid invite", statusCode: 404 },
    });
    const res = await ctx.app.request("/api/invites/bad-token");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("INVITE_INVALID");
  });
});

// ── Accept Invite ──

describe("POST /api/invites/:token/accept", () => {
  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request("/api/invites/some-token/accept", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("accepts invite and returns type and creatorId", async () => {
    const res = await ctx.app.request("/api/invites/valid-token/accept", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("creator_owner");
    expect(body.creatorId).toBe("creator-1");
    expect(mockAcceptInvite).toHaveBeenCalledWith("valid-token", "user_test123");
  });

  it("returns 403 when email does not match", async () => {
    mockAcceptInvite.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVITE_EMAIL_MISMATCH", message: "Email mismatch", statusCode: 403 },
    });
    const res = await ctx.app.request("/api/invites/token-123/accept", {
      method: "POST",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("INVITE_EMAIL_MISMATCH");
  });

  it("returns 404 when token is invalid or expired", async () => {
    mockAcceptInvite.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVITE_INVALID", message: "Invalid invite", statusCode: 404 },
    });
    const res = await ctx.app.request("/api/invites/expired-token/accept", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
