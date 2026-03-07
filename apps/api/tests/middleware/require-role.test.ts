import { describe, it, expect, vi, afterEach } from "vitest";
import { Hono } from "hono";

import type { Role } from "@snc/shared";
import type { AuthEnv } from "../../src/middleware/auth-env.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";

// ── Test Fixtures ──

const MOCK_USER = makeMockUser();
const MOCK_SESSION = makeMockSession();

// ── Mock Setup ──

/**
 * Build a minimal Hono app with requireRole middleware.
 *
 * - Simulates `requireAuth` having already run by setting user, session,
 *   and roles on context via a preceding middleware.
 * - No DB mock needed — `requireRole` reads roles from context.
 */
const setupRoleApp = async (
  requiredRoles: Role[],
  userRoleValues: Role[],
): Promise<Hono<AuthEnv>> => {
  const { requireRole } = await import(
    "../../src/middleware/require-role.js"
  );

  const { errorHandler } = await import(
    "../../src/middleware/error-handler.js"
  );

  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);

  // Simulate requireAuth having already run (sets user, session, and roles)
  app.use("*", async (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", MOCK_SESSION);
    c.set("roles", userRoleValues);
    await next();
  });

  app.get(
    "/protected",
    requireRole(...requiredRoles),
    (c) => {
      return c.json({ roles: c.get("roles") });
    },
  );

  return app;
};

const setupRoleAppNoUser = async (
  requiredRoles: Role[],
): Promise<Hono<AuthEnv>> => {
  const { requireRole } = await import(
    "../../src/middleware/require-role.js"
  );

  const { errorHandler } = await import(
    "../../src/middleware/error-handler.js"
  );

  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);

  // No user-setting middleware — simulates requireAuth not having run
  app.get(
    "/protected",
    requireRole(...requiredRoles),
    (c) => c.json({ ok: true }),
  );

  return app;
};

// ── Tests ──

describe("requireRole middleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("passes when user has the required role", async () => {
    const app = await setupRoleApp(
      ["creator"],
      ["subscriber", "creator"],
    );
    const res = await app.request("/protected");
    expect(res.status).toBe(200);
  });

  it("returns 403 when user lacks the required role", async () => {
    const app = await setupRoleApp(
      ["creator"],
      ["subscriber"],
    );
    const res = await app.request("/protected");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toStrictEqual({
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
  });

  it("passes when user has one of multiple required roles", async () => {
    const app = await setupRoleApp(
      ["creator", "cooperative-member"],
      ["cooperative-member"],
    );
    const res = await app.request("/protected");
    expect(res.status).toBe(200);
  });

  it("returns 403 when user lacks all of multiple required roles", async () => {
    const app = await setupRoleApp(
      ["creator", "cooperative-member"],
      ["subscriber"],
    );
    const res = await app.request("/protected");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("preserves roles on context after passing", async () => {
    const app = await setupRoleApp(
      ["subscriber"],
      ["subscriber", "creator"],
    );
    const res = await app.request("/protected");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roles).toStrictEqual(["subscriber", "creator"]);
  });

  it("returns 401 when user is not on context", async () => {
    const app = await setupRoleAppNoUser(["creator"]);
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
