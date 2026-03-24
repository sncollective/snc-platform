import { and, eq, isNull } from "drizzle-orm";

import type { ContentResponse } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { toISO, toISOOrNull } from "./response-helpers.js";

type ContentRow = typeof content.$inferSelect;

export type { ContentRow };

export const resolveContentUrls = (row: ContentRow): ContentResponse => ({
  id: row.id,
  creatorId: row.creatorId,
  slug: row.slug ?? null,
  type: row.type,
  title: row.title,
  body: row.body ?? null,
  description: row.description ?? null,
  visibility: row.visibility,
  sourceType: row.sourceType,
  thumbnailUrl: row.thumbnailKey
    ? `/api/content/${row.id}/thumbnail`
    : null,
  mediaUrl: row.mediaKey
    ? `/api/content/${row.id}/media`
    : null,
  publishedAt: toISOOrNull(row.publishedAt),
  createdAt: toISO(row.createdAt),
  updatedAt: toISO(row.updatedAt),
});

export const findActiveContent = async (
  id: string,
): Promise<ContentRow | undefined> => {
  const rows = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), isNull(content.deletedAt)));
  return rows[0];
};
