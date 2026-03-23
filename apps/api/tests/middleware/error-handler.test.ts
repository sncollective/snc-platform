import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "@snc/shared";

import { errorHandler } from "../../src/middleware/error-handler.js";
import type { ErrorResponseBody } from "../../src/middleware/error-handler.js";

/**
 * Helper: create a test Hono app with the error handler registered via
 * `app.onError()` and a route that throws the given error.
 *
 * Note: In Hono v4, `app.onError()` is the correct hook for global error
 * handling. Middleware try-catch does not intercept route handler errors
 * because Hono's compose() catches them before propagating back through next().
 */
const createTestApp = (errorToThrow: Error) => {
  const app = new Hono();
  app.onError(errorHandler);
  app.get("/test", () => {
    throw errorToThrow;
  });
  return app;
};

describe("errorHandler middleware", () => {
  it("maps NotFoundError to 404 with structured JSON", async () => {
    const app = createTestApp(new NotFoundError("thing not found"));
    const res = await app.request("/test");

    expect(res.status).toBe(404);
    const body: ErrorResponseBody = await res.json();
    expect(body).toStrictEqual({
      error: { code: "NOT_FOUND", message: "thing not found" },
    });
  });

  it("maps ValidationError to 400 with structured JSON", async () => {
    const app = createTestApp(new ValidationError("bad input"));
    const res = await app.request("/test");

    expect(res.status).toBe(400);
    const body: ErrorResponseBody = await res.json();
    expect(body).toStrictEqual({
      error: { code: "VALIDATION_ERROR", message: "bad input" },
    });
  });

  it("maps UnauthorizedError to 401 with structured JSON", async () => {
    const app = createTestApp(new UnauthorizedError());
    const res = await app.request("/test");

    expect(res.status).toBe(401);
    const body: ErrorResponseBody = await res.json();
    expect(body).toStrictEqual({
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });
  });

  it("maps ForbiddenError to 403 with structured JSON", async () => {
    const app = createTestApp(new ForbiddenError());
    const res = await app.request("/test");

    expect(res.status).toBe(403);
    const body: ErrorResponseBody = await res.json();
    expect(body).toStrictEqual({
      error: { code: "FORBIDDEN", message: "Forbidden" },
    });
  });

  it("maps unknown Error to 500 INTERNAL_ERROR without leaking message", async () => {
    const app = createTestApp(new Error("secret db details"));
    const res = await app.request("/test");

    expect(res.status).toBe(500);
    const body: ErrorResponseBody = await res.json();
    expect(body).toStrictEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  });

  it("logs unknown errors via pino with request context", async () => {
    const { rootLogger } = await import("../../src/logging/logger.js");
    const errorSpy = vi.spyOn(rootLogger, "error").mockImplementation(() => {});

    const thrownError = new Error("unexpected");
    const app = createTestApp(thrownError);

    await app.request("/test");

    expect(errorSpy).toHaveBeenCalledWith(
      {
        error: "unexpected",
        path: "/test",
        method: "GET",
      },
      "Unhandled error",
    );
    errorSpy.mockRestore();
  });

  it("does not log AppError instances", async () => {
    const { rootLogger } = await import("../../src/logging/logger.js");
    const errorSpy = vi.spyOn(rootLogger, "error").mockImplementation(() => {});

    const app = createTestApp(new NotFoundError("gone"));

    await app.request("/test");

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("includes details when AppError has a details property", async () => {
    class DetailedError extends AppError {
      readonly details: Record<string, unknown>;

      constructor(message: string, details: Record<string, unknown>) {
        super("DETAILED_ERROR", message, 422);
        this.name = "DetailedError";
        this.details = details;
      }
    }

    const app = createTestApp(
      new DetailedError("check failed", { field: "email", reason: "invalid" }),
    );
    const res = await app.request("/test");

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toStrictEqual({
      error: {
        code: "DETAILED_ERROR",
        message: "check failed",
        details: { field: "email", reason: "invalid" },
      },
    });
  });

  it("does not include details key when AppError has no details", async () => {
    const app = createTestApp(new NotFoundError("gone"));
    const res = await app.request("/test");
    const body = await res.json();

    expect(body.error).not.toHaveProperty("details");
  });

  it("returns JSON content-type header", async () => {
    const app = createTestApp(new NotFoundError("gone"));
    const res = await app.request("/test");

    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
