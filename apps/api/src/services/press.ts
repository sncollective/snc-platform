import { and, eq, isNotNull, sql } from "drizzle-orm";

import {
  DEFAULT_PRESS_CONTENT,
  DraftPressContentSchema,
  PressContentSchema,
  ValidationError,
  ok,
} from "@snc/shared";
import type {
  AppError,
  DraftPressConfigPatch,
  DraftPressContent,
  PressContent,
  Result,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorPressConfigs } from "../db/schema/creator.schema.js";

// ── Private Helpers ──

type V2FieldPresence = {
  gallery: boolean;
  highlights: boolean;
};

type StoredPressConfig = {
  content: PressContent;
  draftContent: DraftPressContent | null;
};

const hasOwnField = (value: unknown, field: string): boolean =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  Object.prototype.hasOwnProperty.call(value, field);

/** Lazily normalize a parsed v1 press document toward the v2 surface shape. */
export const normalizePressContent = (
  content: PressContent,
  presence: V2FieldPresence = {
    gallery: content.gallery.length > 0,
    highlights: content.highlights.length > 0,
  },
): PressContent => {
  const gallery = presence.gallery
    ? content.gallery
    : content.photos.map((key) => ({ key, alt: "", credit: null }));

  const highlights = presence.highlights
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

const normalizeParsedContent = <T extends PressContent>(rawContent: unknown, content: T): T =>
  normalizePressContent(content, {
    gallery: hasOwnField(rawContent, "gallery"),
    highlights: hasOwnField(rawContent, "highlights"),
  }) as T;

const parseAndNormalize = (rawContent: unknown): PressContent =>
  normalizeParsedContent(
    rawContent,
    PressContentSchema.parse(rawContent ?? DEFAULT_PRESS_CONTENT),
  );

const parseAndNormalizeDraft = (rawContent: unknown): DraftPressContent =>
  normalizeParsedContent(
    rawContent,
    DraftPressContentSchema.parse(rawContent ?? DEFAULT_PRESS_CONTENT),
  );

/** Read the published and optional draft documents without exposing storage details. */
const readStoredPressConfig = async (creatorId: string): Promise<StoredPressConfig> => {
  const [row] = await db
    .select()
    .from(creatorPressConfigs)
    .where(eq(creatorPressConfigs.creatorId, creatorId))
    .limit(1);

  return {
    content: parseAndNormalize(row?.content),
    draftContent: row?.draftContent == null ? null : parseAndNormalizeDraft(row.draftContent),
  };
};

// ── Public API ──

/** Read a creator's published press config (defaults when unset). */
export const getPressConfig = async (
  creatorId: string,
): Promise<Result<PressContent, AppError>> => {
  const stored = await readStoredPressConfig(creatorId);
  return ok(stored.content);
};

/** Read the editor's effective config: draft when present, otherwise published content. */
export const getPressDraftConfig = async (
  creatorId: string,
): Promise<Result<DraftPressContent, AppError>> => {
  const stored = await readStoredPressConfig(creatorId);
  return ok(stored.draftContent ?? stored.content);
};

/** Save a partial editor patch into the draft document without changing published content. */
export const upsertPressConfig = async (
  creatorId: string,
  patch: DraftPressConfigPatch,
): Promise<Result<DraftPressContent, AppError>> => {
  const current = await getPressDraftConfig(creatorId);
  if (!current.ok) return current;
  const next = DraftPressContentSchema.parse({ ...current.value, ...patch });

  await db
    .insert(creatorPressConfigs)
    .values({
      creatorId,
      content: DEFAULT_PRESS_CONTENT,
      draftContent: next,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: creatorPressConfigs.creatorId,
      set: { draftContent: next, updatedAt: new Date() },
    });

  return ok(next);
};

/** Atomically publish the current draft and clear it. */
export const publishPressConfig = async (
  creatorId: string,
): Promise<Result<PressContent, AppError>> => {
  let published: PressContent | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(creatorPressConfigs)
      .set({
        content: sql`${creatorPressConfigs.draftContent}`,
        draftContent: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(creatorPressConfigs.creatorId, creatorId),
          isNotNull(creatorPressConfigs.draftContent),
        ),
      )
      .returning({ content: creatorPressConfigs.content });

    if (row) {
      const candidate = PressContentSchema.safeParse(row.content);
      if (!candidate.success) {
        throw new ValidationError(
          "Draft contains incomplete or invalid fields and cannot be published",
        );
      }
      published = normalizeParsedContent(row.content, candidate.data);
    }
  });

  // Publishing with no pending draft is intentionally idempotent.
  if (published) return ok(published);
  return getPressConfig(creatorId);
};

/** Discard a pending draft and leave the published document unchanged. */
export const discardPressDraft = async (
  creatorId: string,
): Promise<Result<PressContent, AppError>> => {
  await db
    .update(creatorPressConfigs)
    .set({ draftContent: null, updatedAt: new Date() })
    .where(eq(creatorPressConfigs.creatorId, creatorId));

  return getPressConfig(creatorId);
};
