import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";

import type { AuthEnv } from "../middleware/auth-env.js";

import { db } from "../db/connection.js";
import { creatorMembers, creatorProfiles } from "../db/schema/creator.schema.js";
import { requireAuth } from "../middleware/require-auth.js";

// ── Schemas ──

const MyCreatorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  handle: z.string().nullable(),
  role: z.string(),
  avatarUrl: z.string().nullable(),
});

const MyCreatorsResponse = z.object({
  creators: z.array(MyCreatorSchema),
});

// ── Public API ──

/** List creators the authenticated user is a member of. */
export const meCreatorsRoutes = new Hono<AuthEnv>();

meCreatorsRoutes.use("*", requireAuth);

meCreatorsRoutes.get(
  "/",
  describeRoute({
    description: "List creators the current user is a member of, with their membership role",
    tags: ["me"],
    responses: {
      200: {
        description: "List of creators with membership info",
        content: { "application/json": { schema: resolver(MyCreatorsResponse) } },
      },
    },
  }),
  async (c) => {
    const user = c.get("user");

    const rows = await db
      .select({
        id: creatorProfiles.id,
        displayName: creatorProfiles.displayName,
        handle: creatorProfiles.handle,
        role: creatorMembers.role,
        avatarKey: creatorProfiles.avatarKey,
      })
      .from(creatorMembers)
      .innerJoin(creatorProfiles, eq(creatorMembers.creatorId, creatorProfiles.id))
      .where(eq(creatorMembers.userId, user.id));

    const creators = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      handle: row.handle,
      role: row.role,
      avatarUrl: row.avatarKey ? `/api/creators/${row.id}/avatar` : null,
    }));

    return c.json({ creators });
  },
);
