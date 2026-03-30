import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";

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
    if (!result.ok) return c.json({ error: { code: result.error.code, message: result.error.message } }, result.error.statusCode as 500);
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
    const body = c.req.valid("json" as never);
    const result = await createSimulcastDestination(body);
    if (!result.ok) return c.json({ error: { code: result.error.code, message: result.error.message } }, result.error.statusCode as 500);
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
  validator("json", UpdateSimulcastDestinationSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json" as never);
    const result = await updateSimulcastDestination(id, body);
    if (!result.ok) return c.json({ error: { code: result.error.code, message: result.error.message } }, result.error.statusCode as 404);
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
  async (c) => {
    const { id } = c.req.param();
    const result = await deleteSimulcastDestination(id);
    if (!result.ok) return c.json({ error: { code: result.error.code, message: result.error.message } }, result.error.statusCode as 404);
    return c.body(null, 204);
  },
);
