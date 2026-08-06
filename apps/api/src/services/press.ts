import { eq } from "drizzle-orm";

import { ok, DEFAULT_PRESS_CONTENT } from "@snc/shared";
import type { AppError, PressConfigPatch, PressContent, Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorPressConfigs } from "../db/schema/creator.schema.js";

// ── Private Helpers ──

/** Read a creator's press config, falling back to defaults when no row exists. */
const readPressConfig = async (creatorId: string): Promise<PressContent> => {
  const [row] = await db
    .select()
    .from(creatorPressConfigs)
    .where(eq(creatorPressConfigs.creatorId, creatorId))
    .limit(1);
  if (!row) return DEFAULT_PRESS_CONTENT;
  return row.content;
};

// ── Public API ──

/** Read a creator's press config (defaults when unset). */
export const getPressConfig = async (
  creatorId: string,
): Promise<Result<PressContent, AppError>> => ok(await readPressConfig(creatorId));

/** Upsert a creator's press config with a partial patch. */
export const upsertPressConfig = async (
  creatorId: string,
  patch: PressConfigPatch,
): Promise<Result<PressContent, AppError>> => {
  const current = await readPressConfig(creatorId);
  const next = { ...current, ...patch } as PressContent;

  await db
    .insert(creatorPressConfigs)
    .values({ creatorId, content: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: creatorPressConfigs.creatorId,
      set: { content: next, updatedAt: new Date() },
    });

  return ok(next);
};
