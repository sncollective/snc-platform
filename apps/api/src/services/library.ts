import { createHash, randomUUID } from "node:crypto";

import { imageSize } from "image-size";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import {
  AppError,
  ContentAssetSchema,
  MAX_FILE_SIZES,
  ValidationError,
  err,
  ok,
} from "@snc/shared";
import type {
  ContentAsset,
  ContentAssetList,
  Result,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { contentAssets } from "../db/schema/library.schema.js";
import { toISO } from "../lib/response-helpers.js";
import { storage } from "../storage/index.js";

const TYPE_TO_EXT = { jpg: "jpg", png: "png", webp: "webp" } as const;
const TYPE_TO_MIME = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
type DetectedType = keyof typeof TYPE_TO_EXT;

const PAGE_LIMIT = 50;
const MAX_LIMIT = 100;

/** Derive the content-addressable key from sha256 and detected image format. */
export const deriveLibraryKey = (sha256: string, type: DetectedType): string =>
  `library/${sha256.slice(0, 2)}/${sha256}.${TYPE_TO_EXT[type]}`;

/** Convert a database registration to the shared API representation. */
export const toContentAsset = (
  row: typeof contentAssets.$inferSelect,
): ContentAsset => ({
  id: row.id,
  ownerCreatorId: row.ownerCreatorId,
  sha256: row.sha256,
  storageKey: row.storageKey,
  mimeType: ContentAssetSchema.shape.mimeType.parse(row.mimeType),
  size: row.size,
  width: row.width,
  height: row.height,
  originalFilename: row.originalFilename,
  createdAt: toISO(row.createdAt),
});

const asServiceError = (cause: unknown): AppError => {
  if (cause instanceof AppError) return cause;
  return new AppError(
    "LIBRARY_ERROR",
    cause instanceof Error ? cause.message : "Library operation failed",
    500,
  );
};

/** Storage adapters normalize missing objects to NOT_FOUND. */
const isNotFoundStorageError = (cause: unknown): boolean => {
  if (!cause || typeof cause !== "object") return false;
  const candidate = cause as { code?: unknown; name?: unknown };
  return (
    candidate.code === "NOT_FOUND" ||
    candidate.code === "NoSuchKey" ||
    candidate.name === "NotFoundError" ||
    candidate.name === "NoSuchKey"
  );
};

const detectImage = (
  bytes: Uint8Array,
): Result<{ type: DetectedType; width: number | null; height: number | null }, AppError> => {
  try {
    const detected = imageSize(bytes);
    if (
      (detected.type !== "jpg" && detected.type !== "png" && detected.type !== "webp") ||
      !detected.type
    ) {
      return err(new ValidationError("Unsupported or unrecognized image format"));
    }
    return ok({
      type: detected.type,
      width: detected.width ?? null,
      height: detected.height ?? null,
    });
  } catch {
    return err(new ValidationError("Unsupported or unrecognized image format"));
  }
};

/** Register an image and store its bytes once under a content-addressed key. */
export const uploadLibraryAsset = async (
  creatorId: string,
  file: {
    name?: string;
    declaredType: string;
    size: number;
    bytes: Uint8Array;
  },
): Promise<Result<{ asset: ContentAsset; deduped: boolean }, AppError>> => {
  // The declared MIME is intentionally not used for identity or storage metadata.
  void file.declaredType;

  if (file.size > MAX_FILE_SIZES.image || file.bytes.byteLength > MAX_FILE_SIZES.image) {
    return err(new ValidationError(`File size exceeds the ${MAX_FILE_SIZES.image} byte limit`));
  }

  const detectedResult = detectImage(file.bytes);
  if (!detectedResult.ok) return detectedResult;
  const { type, width, height } = detectedResult.value;
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const storageKey = deriveLibraryKey(sha256, type);
  const mimeType = TYPE_TO_MIME[type];

  try {
    const [existing] = await db
      .select()
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.ownerCreatorId, creatorId),
          eq(contentAssets.sha256, sha256),
          isNull(contentAssets.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      return ok({ asset: toContentAsset(existing), deduped: true });
    }

    const headResult = await storage.head(storageKey);
    let blobExists = false;
    if (headResult.ok) {
      blobExists = true;
    } else if (!isNotFoundStorageError(headResult.error)) {
      return err(headResult.error);
    }

    if (!blobExists) {
      const uploadResult = await storage.upload(
        storageKey,
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(file.bytes);
            controller.close();
          },
        }),
        { contentType: mimeType, contentLength: file.bytes.byteLength },
      );
      if (!uploadResult.ok) return err(uploadResult.error);
    }

    const inserted = await db
      .insert(contentAssets)
      .values({
        id: randomUUID(),
        ownerCreatorId: creatorId,
        sha256,
        storageKey,
        mimeType,
        size: file.bytes.byteLength,
        width,
        height,
        originalFilename: file.name ?? null,
      })
      .onConflictDoNothing({
        target: [contentAssets.ownerCreatorId, contentAssets.sha256],
      })
      .returning();

    const row = inserted[0];
    if (row) {
      return ok({ asset: toContentAsset(row), deduped: blobExists });
    }

    // A concurrent upload won the unique index. Return its active registration.
    const [winner] = await db
      .select()
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.ownerCreatorId, creatorId),
          eq(contentAssets.sha256, sha256),
          isNull(contentAssets.deletedAt),
        ),
      )
      .limit(1);
    if (!winner) {
      return err(new AppError("LIBRARY_CONFLICT", "Asset registration is unavailable", 409));
    }
    return ok({ asset: toContentAsset(winner), deduped: true });
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

const normalizeLimit = (limit: number | undefined): number =>
  Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit ?? PAGE_LIMIT)));

/** List a creator's live registrations newest-first using keyset pagination. */
export const listLibraryAssets = async (
  creatorId: string,
  opts?: { limit?: number; before?: { createdAt: Date; id: string } },
): Promise<Result<ContentAssetList, AppError>> => {
  const limit = normalizeLimit(opts?.limit);
  const conditions = [
    eq(contentAssets.ownerCreatorId, creatorId),
    isNull(contentAssets.deletedAt),
  ];
  if (opts?.before) {
    conditions.push(
      or(
        lt(contentAssets.createdAt, opts.before.createdAt),
        and(
          eq(contentAssets.createdAt, opts.before.createdAt),
          lt(contentAssets.id, opts.before.id),
        ),
      )!,
    );
  }

  try {
    const rows = await db
      .select()
      .from(contentAssets)
      .where(and(...conditions))
      .orderBy(desc(contentAssets.createdAt), desc(contentAssets.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map(toContentAsset);
    const last = items.at(-1);
    return ok({
      items,
      nextCursor: hasMore && last ? `${last.createdAt}|${last.id}` : null,
    });
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

/** Get one live registration belonging to a creator. */
export const getLibraryAsset = async (
  creatorId: string,
  assetId: string,
): Promise<Result<ContentAsset, AppError>> => {
  try {
    const [row] = await db
      .select()
      .from(contentAssets)
      .where(
        and(
          eq(contentAssets.id, assetId),
          eq(contentAssets.ownerCreatorId, creatorId),
          isNull(contentAssets.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return err(new AppError("NOT_FOUND", "Library asset not found", 404));
    return ok(toContentAsset(row));
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

/** Soft-delete a registration while retaining the content-addressed bytes. */
export const deleteLibraryAsset = async (
  creatorId: string,
  assetId: string,
): Promise<Result<void, AppError>> => {
  try {
    await db
      .update(contentAssets)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(contentAssets.id, assetId),
          eq(contentAssets.ownerCreatorId, creatorId),
          isNull(contentAssets.deletedAt),
        ),
      );
    return ok(undefined);
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

/** Check live registration ownership for a content-addressed storage key. */
export const isRegisteredLibraryAsset = async (
  ownerCreatorId: string,
  storageKey: string,
): Promise<boolean> => {
  const [row] = await db
    .select({ id: contentAssets.id })
    .from(contentAssets)
    .where(
      and(
        eq(contentAssets.ownerCreatorId, ownerCreatorId),
        eq(contentAssets.storageKey, storageKey),
        isNull(contentAssets.deletedAt),
      ),
    )
    .limit(1);
  return !!row;
};
