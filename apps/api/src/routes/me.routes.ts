import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";

import { SessionSchema, UserSchema } from "@snc/shared";

import { auth } from "../auth/auth.js";
import { getUserRoles } from "../auth/user-roles.js";
import { db } from "../db/connection.js";
import { accounts } from "../db/schema/user.schema.js";
import { subscriptionPlans, userSubscriptions } from "../db/schema/subscription.schema.js";
import { requireAuth } from "../middleware/require-auth.js";

// ── Schemas ──

const MeAuthenticatedResponse = z.object({
  user: UserSchema,
  session: SessionSchema,
  roles: z.array(z.string()),
  isPatron: z.boolean(),
});

const MeUnauthenticatedResponse = z.object({
  user: z.null(),
});

// ── Public API ──

export const meRoutes = new Hono();

meRoutes.get(
  "/",
  describeRoute({
    description:
      "Return the current user's session enriched with roles, or { user: null } when unauthenticated",
    tags: ["me"],
    responses: {
      200: {
        description: "Current user with session and roles, or null user",
        content: {
          "application/json": {
            schema: resolver(
              z.union([MeAuthenticatedResponse, MeUnauthenticatedResponse]),
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    const sessionResult = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!sessionResult) {
      return c.json({ user: null });
    }

    const [roles, patronRow] = await Promise.all([
      getUserRoles(sessionResult.user.id),
      db
        .select({ id: userSubscriptions.id })
        .from(userSubscriptions)
        .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(
          and(
            eq(userSubscriptions.userId, sessionResult.user.id),
            eq(userSubscriptions.status, "active"),
            eq(subscriptionPlans.type, "platform"),
          ),
        )
        .limit(1),
    ]);

    const isPatron = patronRow.length > 0;

    return c.json({
      user: {
        ...sessionResult.user,
        image: sessionResult.user.image ?? null,
      },
      session: sessionResult.session,
      roles,
      isPatron,
    });
  },
);

meRoutes.get(
  "/providers",
  requireAuth,
  describeRoute({
    tags: ["me"],
    summary: "List linked account providers",
    responses: { 200: { description: "Provider list" } },
  }),
  async (c) => {
    const user = c.get("user");

    const rows = await db
      .select({ providerId: accounts.providerId })
      .from(accounts)
      .where(eq(accounts.userId, user.id));

    const providers = rows.map((r) => r.providerId);
    const hasPassword = providers.includes("credential");

    return c.json({ providers, hasPassword });
  },
);
