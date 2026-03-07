import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock Helpers ──

const mockHandler = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  defaultAuth: { user: null, session: null, roles: [] },
  mocks: () => {
    vi.doMock("../../src/auth/auth.js", () => ({
      auth: {
        handler: mockHandler,
      },
    }));
  },
  mountRoute: async (app) => {
    const { authRoutes } = await import("../../src/routes/auth.routes.js");
    app.route("/api/auth", authRoutes);
  },
  beforeEach: () => {
    mockHandler.mockReset();
  },
});

// ── Tests ──

describe("auth routes", () => {
  describe("POST /api/auth/sign-up/email", () => {
    it("delegates to Better Auth handler and returns signup response", async () => {
      const signupBody = {
        user: {
          id: "user_new1",
          name: "New User",
          email: "new@example.com",
          emailVerified: false,
          image: null,
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
        session: {
          token: "tok_new1",
          expiresAt: "2025-02-01T00:00:00Z",
        },
      };

      mockHandler.mockResolvedValue(
        new Response(JSON.stringify(signupBody), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              "better-auth.session_token=tok_new1; HttpOnly; Path=/",
          },
        }),
      );

      const res = await ctx.app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3001",
        },
        body: JSON.stringify({
          name: "New User",
          email: "new@example.com",
          password: "securepassword123",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.email).toBe("new@example.com");
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it("returns error for duplicate email", async () => {
      mockHandler.mockResolvedValue(
        new Response(
          JSON.stringify({ message: "User already exists" }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const res = await ctx.app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3001",
        },
        body: JSON.stringify({
          name: "Duplicate",
          email: "existing@example.com",
          password: "securepassword123",
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.message).toBeDefined();
    });
  });

  describe("POST /api/auth/sign-in/email", () => {
    it("delegates to Better Auth handler and returns session", async () => {
      mockHandler.mockResolvedValue(
        new Response(
          JSON.stringify({
            user: {
              id: "user_1",
              name: "Test",
              email: "test@example.com",
            },
            session: {
              token: "tok_signin1",
              expiresAt: "2025-02-01T00:00:00Z",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie":
                "better-auth.session_token=tok_signin1; HttpOnly; Path=/",
            },
          },
        ),
      );

      const res = await ctx.app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3001",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "securepassword123",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.session.token).toBe("tok_signin1");
    });

    it("returns error for invalid credentials", async () => {
      mockHandler.mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Invalid email or password" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const res = await ctx.app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3001",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBeDefined();
      // Verify no user enumeration — message should be generic
      expect(body.message).not.toContain("not found");
    });
  });

  describe("POST /api/auth/sign-out", () => {
    it("delegates to Better Auth handler for signout", async () => {
      mockHandler.mockResolvedValue(
        new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const res = await ctx.app.request("/api/auth/sign-out", {
        method: "POST",
        headers: {
          Cookie: "better-auth.session_token=valid_token",
          Origin: "http://localhost:3001",
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe("GET /api/auth/get-session", () => {
    it("returns session info when authenticated", async () => {
      const sessionData = {
        user: {
          id: "user_1",
          name: "Test",
          email: "test@example.com",
          emailVerified: true,
          image: null,
        },
        session: {
          token: "tok_session1",
          expiresAt: "2025-02-01T00:00:00Z",
        },
      };

      mockHandler.mockResolvedValue(
        new Response(JSON.stringify(sessionData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await ctx.app.request("/api/auth/get-session", {
        headers: {
          Cookie: "better-auth.session_token=valid_token",
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.email).toBe("test@example.com");
      expect(body.session.token).toBe("tok_session1");
    });

    it("returns null when not authenticated", async () => {
      mockHandler.mockResolvedValue(
        new Response(JSON.stringify(null), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await ctx.app.request("/api/auth/get-session");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toBeNull();
    });
  });

  describe("handler delegation", () => {
    it("passes raw Request to auth.handler", async () => {
      mockHandler.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await ctx.app.request("/api/auth/get-session");

      expect(mockHandler).toHaveBeenCalledOnce();
      const callArg = mockHandler.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Request);
    });

    it("routes undocumented paths via catch-all", async () => {
      mockHandler.mockResolvedValue(
        new Response(JSON.stringify({ csrf: "token123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await ctx.app.request("/api/auth/csrf");

      expect(res.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledOnce();
    });
  });
});
