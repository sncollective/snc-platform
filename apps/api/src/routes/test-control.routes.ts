import { timingSafeEqual } from "node:crypto";

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import { ForbiddenError } from "@snc/shared";

import { config } from "../config.js";
import {
  resetMayaCreatorProgramming,
  seedMayaCreatorProgramming,
} from "../services/test-control.js";

// ── Schemas ──

const MayaProgrammingSeedSchema = z.object({
  pool: z.boolean().optional(),
  queue: z.boolean().optional(),
  fixtureId: z.string().optional(),
  title: z.string().optional(),
  timestampIso: z.string().datetime().optional(),
  channelActive: z.boolean().optional(),
  syncPlaybackEngine: z.boolean().optional(),
});

const TEST_CONTROL_SECRET_HEADER = "x-test-control-secret";

const secretsMatch = (provided: string | undefined, expected: string): boolean => {
  if (provided === undefined) return false;
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

const requireTestControlSecret: MiddlewareHandler = async (c, next) => {
  const expected = config.TEST_CONTROL_SECRET;
  if (!expected) throw new ForbiddenError("Test-control secret is not configured");

  if (!secretsMatch(c.req.header(TEST_CONTROL_SECRET_HEADER), expected)) {
    throw new ForbiddenError("Invalid test-control secret");
  }

  await next();
};

// ── Route Surface ──

/**
 * E2E-only test-control surface.
 *
 * This router is mounted only by `app.ts` when the explicit test-control profile is enabled
 * outside production. Routes here are setup/reset adapters for Playwright, not product APIs.
 */
export const testControlRoutes = new Hono();

testControlRoutes.use("*", requireTestControlSecret);

testControlRoutes.get(
  "/status",
  describeRoute({
    description: "Report that the e2e-only test-control surface is mounted.",
    tags: ["test-control"],
    responses: {
      200: { description: "Test-control surface is available" },
    },
  }),
  (c) => c.json({ ok: true, profile: "e2e" as const }),
);

testControlRoutes.post(
  "/creator-programming/maya/reset",
  describeRoute({
    description: "Reset Maya creator-programming mutable demo state for e2e setup.",
    tags: ["test-control"],
    responses: {
      200: { description: "Maya programming state reset" },
      400: { description: "Invalid fixture options" },
      403: { description: "Missing or invalid test-control secret" },
      409: { description: "Required demo seed rows are missing" },
    },
  }),
  validator("json", MayaProgrammingSeedSchema.partial()),
  async (c) => {
    const body = c.req.valid("json");
    const result = await resetMayaCreatorProgramming(body);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);

testControlRoutes.post(
  "/creator-programming/maya/seed",
  describeRoute({
    description: "Reset then seed Maya creator-programming state for e2e setup.",
    tags: ["test-control"],
    responses: {
      200: { description: "Maya programming state seeded" },
      400: { description: "Invalid seed options" },
      403: { description: "Missing or invalid test-control secret" },
      409: { description: "Required demo seed rows are missing" },
    },
  }),
  validator("json", MayaProgrammingSeedSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await seedMayaCreatorProgramming(body);
    if (!result.ok) throw result.error;
    return c.json(result.value);
  },
);
