import { vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { User, Session } from "@snc/shared";

import { TEST_CONFIG } from "./test-constants.js";
import { makeMockUser, makeMockSession } from "./auth-fixtures.js";

// ── Types ──

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: string[];
}

interface RouteTestContext {
  /** The assembled Hono app — rebuilt each test via beforeEach. */
  app: Hono;
  /** Mutable auth state; mutate fields in individual tests to change auth behavior. */
  auth: AuthState;
}

interface RouteTestOptions {
  /**
   * Additional `vi.doMock` calls for domain-specific modules (schemas, services, storage).
   * Called after the common mocks (config, db, auth middleware, role middleware) are registered.
   * Receives the freshly-imported error classes for use in mock implementations.
   */
  mocks?: (errors: {
    UnauthorizedError: new (msg?: string) => Error;
    ForbiddenError: new (msg?: string) => Error;
  }) => void;

  /**
   * Mount the route module onto the app.
   * Called after all mocks are registered and dynamic imports are resolved.
   * Receives the app instance to mount routes on.
   *
   * Example:
   * ```ts
   * mountRoute: async (app) => {
   *   const { contentRoutes } = await import("../../src/routes/content.routes.js");
   *   app.route("/api/content", contentRoutes);
   * }
   * ```
   */
  mountRoute: (app: Hono) => Promise<void>;

  /**
   * The mock db object to inject via `vi.doMock("../../src/db/connection.js")`.
   * Omit to skip the db mock (e.g., auth routes that don't use db directly).
   */
  db?: Record<string, unknown>;

  /**
   * Whether to mock `requireAuth` middleware. Defaults to `true`.
   * Set to `false` for routes that don't use auth middleware (e.g., auth, merch).
   */
  mockAuth?: boolean;

  /**
   * Whether to mock `requireRole` middleware. Defaults to `true`.
   * Set to `false` for routes that don't use role middleware (e.g., auth, me, subscription, merch, webhook).
   */
  mockRole?: boolean;

  /**
   * Default auth state for `beforeEach`. Defaults to an authenticated user with `["subscriber"]` roles.
   */
  defaultAuth?: Partial<AuthState>;

  /**
   * Additional `beforeEach` setup to run after common setup (e.g., re-wiring db chains).
   */
  beforeEach?: () => void;
}

// ── Factory ──

/**
 * Creates a route test context that encapsulates the common `vi.doMock` boilerplate
 * for API route tests. Returns a context object with `app` and `auth` properties
 * that are rebuilt each test.
 *
 * Usage:
 * ```ts
 * const ctx = setupRouteTest({
 *   db: mockDb,
 *   mountRoute: async (app) => {
 *     const { myRoutes } = await import("../../src/routes/my.routes.js");
 *     app.route("/api/my", myRoutes);
 *   },
 *   mocks: () => {
 *     vi.doMock("../../src/db/schema/my.schema.js", () => ({ myTable: {} }));
 *   },
 * });
 *
 * it("works", async () => {
 *   const res = await ctx.app.request("/api/my");
 *   expect(res.status).toBe(200);
 * });
 * ```
 */
export function setupRouteTest(options: RouteTestOptions): RouteTestContext {
  const ctx: RouteTestContext = {
    app: null as unknown as Hono,
    auth: {
      user: null,
      session: null,
      roles: [],
    },
  };

  const buildApp = async (): Promise<Hono> => {
    // Import error classes first so they share the same module instance as
    // errorHandler (after vi.resetModules() each test gets a fresh registry).
    const { UnauthorizedError, ForbiddenError } = await import("@snc/shared");

    // ── Common mocks ──

    vi.doMock("../../src/config.js", () => ({
      config: TEST_CONFIG,
      parseOrigins: (raw: string) =>
        raw
          .split(",")
          .map((o: string) => o.trim())
          .filter(Boolean),
    }));

    if (options.db) {
      vi.doMock("../../src/db/connection.js", () => ({
        db: options.db,
        sql: vi.fn(),
      }));
    }

    if (options.mockAuth !== false) {
      vi.doMock("../../src/middleware/require-auth.js", () => ({
        requireAuth: async (c: any, next: any) => {
          if (!ctx.auth.user) throw new UnauthorizedError();
          c.set("user", ctx.auth.user);
          c.set("session", ctx.auth.session);
          await next();
        },
      }));
    }

    if (options.mockRole !== false) {
      vi.doMock("../../src/middleware/require-role.js", () => ({
        requireRole:
          (...requiredRoles: string[]) =>
          async (c: any, next: any) => {
            if (!requiredRoles.some((r) => ctx.auth.roles.includes(r))) {
              throw new ForbiddenError("Insufficient permissions");
            }
            c.set("roles", ctx.auth.roles);
            await next();
          },
      }));
    }

    // ── Domain-specific mocks ──

    options.mocks?.({ UnauthorizedError, ForbiddenError });

    // ── Import and assemble app ──

    const { errorHandler } = await import(
      "../../src/middleware/error-handler.js"
    );
    const { corsMiddleware } = await import("../../src/middleware/cors.js");

    const app = new Hono();
    app.use("*", corsMiddleware);
    app.onError(errorHandler);

    await options.mountRoute(app);

    return app;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset auth state to defaults
    ctx.auth.user = options.defaultAuth?.user ?? makeMockUser();
    ctx.auth.session = options.defaultAuth?.session ?? makeMockSession();
    ctx.auth.roles = options.defaultAuth?.roles ?? ["subscriber"];

    // Run additional beforeEach setup (e.g., re-wire db chains)
    options.beforeEach?.();

    ctx.app = await buildApp();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  return ctx;
}
