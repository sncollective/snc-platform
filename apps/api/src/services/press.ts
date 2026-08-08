import { eq } from "drizzle-orm";

import {
  DEFAULT_PRESS_CONTENT,
  PressContentSchema,
  ok,
} from "@snc/shared";
import type { AppError, PressConfigPatch, PressContent, Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorPressConfigs } from "../db/schema/creator.schema.js";

// ── Private Helpers ──

/** Lazily normalize a parsed v1 press document toward the v2 surface shape. */
export const normalizePressContent = (content: PressContent): PressContent => {
  const gallery = content.gallery.length
    ? content.gallery
    : content.photos.map((key) => ({ key, alt: "", credit: null }));

  const highlights = content.highlights.length
    ? content.highlights
    : [
        ...(content.standoutTrack
          ? [
              {
                eyebrow: "Standout track",
                title: content.standoutTrack.title,
                metric: content.standoutTrack.streamsLabel,
                url: content.standoutTrack.url,
              },
            ]
          : []),
        ...content.releases.map((release) => ({
          eyebrow: `New release${release.catalogNumber ? ` · ${release.catalogNumber}` : ""}`,
          title: release.title,
          coverArt: release.artKey
            ? { key: release.artKey, alt: "", credit: null }
            : null,
        })),
      ];

  return { ...content, gallery, highlights };
};

/** Read and parse a creator's press config, then normalize legacy fields on demand. */
const readPressConfig = async (creatorId: string): Promise<PressContent> => {
  const [row] = await db
    .select()
    .from(creatorPressConfigs)
    .where(eq(creatorPressConfigs.creatorId, creatorId))
    .limit(1);
  const content = row
    ? PressContentSchema.parse(row.content)
    : PressContentSchema.parse(DEFAULT_PRESS_CONTENT);
  return normalizePressContent(content);
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
