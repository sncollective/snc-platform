import { sql } from "drizzle-orm";
import { NotFoundError, err, ok } from "@snc/shared";
import type { Result } from "@snc/shared";

import { db } from "../../db/connection.js";
import { poolContentScope } from "../editorial-config.js";
import type { PoolScope } from "../editorial-config.js";

/**
 * Resolve the content-pool scope a channel draws from, derived from the
 * channel's ownership row — never from caller input.
 *
 * Creator-owned channels resolve to `{ creatorId }`; platform/admin channels
 * resolve to `{ allCreators: true }`. Missing channels fail closed.
 */
export const resolvePoolScope = async (
  channelId: string,
): Promise<Result<PoolScope, NotFoundError>> => {
  const rows = (await db.execute(sql`
    SELECT ownership, creator_id AS "creatorId"
    FROM channels
    WHERE id = ${channelId}
  `)) as Array<{ ownership: string; creatorId: string | null }>;

  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) {
    return err(new NotFoundError("Channel not found"));
  }
  return ok(poolContentScope(row));
};
