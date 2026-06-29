import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import {
  resetMayaCreatorProgramming,
  seedMayaCreatorProgramming,
} from "../services/test-control.js";

// ── Schemas ──

const MayaProgrammingSeedSchema = z.object({
  pool: z.boolean().optional(),
  queue: z.boolean().optional(),
});

// ── Route Surface ──

/**
 * E2E-only test-control surface.
 *
 * This router is mounted only by `app.ts` when the explicit test-control profile is enabled
 * outside production. Routes here are setup/reset adapters for Playwright, not product APIs.
 */
export const testControlRoutes = new Hono();

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
      409: { description: "Required demo seed rows are missing" },
    },
  }),
  async (c) => {
    const result = await resetMayaCreatorProgramming();
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
