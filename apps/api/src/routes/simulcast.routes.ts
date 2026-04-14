import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import {
  CreateSimulcastDestinationSchema,
  UpdateSimulcastDestinationSchema,
} from "@snc/shared";

import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import {
  listSimulcastDestinations,
  createSimulcastDestination,
  updateSimulcastDestination,
  deleteSimulcastDestination,
} from "../services/simulcast.js";

/** Simulcast destination ID param (text, not UUID) */
const SimulcastIdParam = z.object({ id: z.string().min(1) });

/** Admin simulcast destination management (RTMP forward targets). */
export const simulcastRoutes = new Hono<AuthEnv>();

// All routes require admin role
simulcastRoutes.use("*", requireAuth, requireRole("admin"));

// ── List Destinations ──

simulcastRoutes.get(
  "/",
  describeRoute({
    description: "List all simulcast destinations",
    tags: ["simulcast"],
    responses: {
      200: { description: "Destination list" },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const result = await listSimulcastDestinations();
    if (!result.ok) throw result.error;
    return c.json({ destinations: result.value }, 200);
  },
);

// ── Create Destination ──

simulcastRoutes.post(
  "/",
  describeRoute({
    description: "Create a simulcast destination",
    tags: ["simulcast"],
    responses: {
      201: { description: "Created" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateSimulcastDestinationSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as z.infer<
      typeof CreateSimulcastDestinationSchema
    >;
    const result = await createSimulcastDestination(body);
    if (!result.ok) throw result.error;
    return c.json({ destination: result.value }, 201);
  },
);

// ── Update Destination ──

simulcastRoutes.patch(
  "/:id",
  describeRoute({
    description: "Update a simulcast destination",
    tags: ["simulcast"],
    responses: {
      200: { description: "Updated" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", SimulcastIdParam),
  validator("json", UpdateSimulcastDestinationSchema),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const body = c.req.valid("json" as never) as z.infer<
      typeof UpdateSimulcastDestinationSchema
    >;
    const result = await updateSimulcastDestination(id, body);
    if (!result.ok) throw result.error;
    return c.json({ destination: result.value }, 200);
  },
);

// ── Delete Destination ──

simulcastRoutes.delete(
  "/:id",
  describeRoute({
    description: "Delete a simulcast destination",
    tags: ["simulcast"],
    responses: {
      204: { description: "Deleted" },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", SimulcastIdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const result = await deleteSimulcastDestination(id);
    if (!result.ok) throw result.error;
    return c.body(null, 204);
  },
);
