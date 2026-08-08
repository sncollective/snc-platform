import { createHash, randomUUID } from "node:crypto";

import { imageSize } from "image-size";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import {
  AppError,
  ContentAssetSchema,
  MAX_FILE_SIZES,
  NotFoundError,
  ValidationError,
  err,
  ok,
} from "@snc/shared";
import type {
  ContentAsset,
  ContentAssetList,
  ContentAssetSharing,
  ContentAssetUseStatus,
  Result,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import {
  contentAssetGrants,
  contentAssets,
  contentBlobs,
} from "../db/schema/library.schema.js";
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

export type LibraryActor = {
  /** Creator whose library/use context is being evaluated. */
  creatorId: string;
  /** Platform admins can browse and use every live registration. */
  isAdmin: boolean;
};

type JoinedAssetRow = {
  asset: typeof contentAssets.$inferSelect;
  blob: typeof contentBlobs.$inferSelect;
  grantedAssetId: string | null;
};

/** Derive the content-addressable key from sha256 and detected image format. */
export const deriveLibraryKey = (sha256: string, type: DetectedType): string =>
  `library/${sha256.slice(0, 2)}/${sha256}.${TYPE_TO_EXT[type]}`;

const useStatusFor = (
  actor: LibraryActor,
  row: Pick<JoinedAssetRow, "asset" | "grantedAssetId">,
): ContentAssetUseStatus => {
  if (actor.isAdmin) return "admin";
  if (row.asset.creatorId === actor.creatorId) return "own";
  if (row.asset.sharing === "open") return "open";
  if (row.grantedAssetId) return "granted";
  return "requestable-needs-grant";
};

/** Convert a joined registration/blob row to the shared API representation. */
export const toContentAsset = (
  row: JoinedAssetRow,
  actor: LibraryActor,
): ContentAsset => {
  const useStatus = useStatusFor(actor, row);
  return {
    id: row.asset.id,
    creatorId: row.asset.creatorId,
    blobSha256: row.asset.blobSha256,
    sharing: row.asset.sharing,
    originalFilename: row.asset.originalFilename,
    createdAt: toISO(row.asset.createdAt),
    storageKey: row.blob.storageKey,
    mimeType: ContentAssetSchema.shape.mimeType.parse(row.blob.mimeType),
    size: row.blob.size,
    width: row.blob.width,
    height: row.blob.height,
    canUse: useStatus !== "requestable-needs-grant",
    useStatus,
  };
};

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
  return candidate.code === "NOT_FOUND" || candidate.name === "NotFoundError";
};

const detectImage = (
  bytes: Uint8Array,
): Result<{ type: DetectedType; width: number | null; height: number | null }, AppError> => {
  try {
    const detected = imageSize(bytes);
    if (detected.type !== "jpg" && detected.type !== "png" && detected.type !== "webp") {
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

const registrationOwnerCondition = (creatorId: string | null) =>
  creatorId === null
    ? isNull(contentAssets.creatorId)
    : eq(contentAssets.creatorId, creatorId);

const findRegistration = async (
  creatorId: string | null,
  blobSha256: string,
): Promise<JoinedAssetRow | undefined> => {
  const [row] = await db
    .select({
      asset: contentAssets,
      blob: contentBlobs,
      grantedAssetId: contentAssetGrants.assetId,
    })
    .from(contentAssets)
    .innerJoin(contentBlobs, eq(contentAssets.blobSha256, contentBlobs.sha256))
    .leftJoin(contentAssetGrants, eq(contentAssetGrants.assetId, contentAssets.id))
    .where(
      and(
        registrationOwnerCondition(creatorId),
        eq(contentAssets.blobSha256, blobSha256),
      ),
    )
    .limit(1);
  return row;
};

const updateRegistration = async (
  id: string,
  sharing: ContentAssetSharing,
  originalFilename: string | null,
  reactivate: boolean,
): Promise<typeof contentAssets.$inferSelect> => {
  const [updated] = await db
    .update(contentAssets)
    .set({
      sharing,
      originalFilename,
      ...(reactivate ? { deletedAt: null, createdAt: new Date() } : {}),
    })
    .where(eq(contentAssets.id, id))
    .returning();
  if (!updated) throw new AppError("LIBRARY_CONFLICT", "Asset registration is unavailable", 409);
  return updated;
};

/** Register an image and store its bytes once under a global content-addressed key. */
export const uploadLibraryAsset = async (
  creatorId: string | null,
  file: {
    name?: string;
    declaredType: string;
    size: number;
    bytes: Uint8Array;
  },
  sharing: ContentAssetSharing = "private",
): Promise<Result<{ asset: ContentAsset; deduped: boolean }, AppError>> => {
  // The declared MIME is intentionally not used for identity or storage metadata.
  void file.declaredType;

  if (file.size > MAX_FILE_SIZES.image || file.bytes.byteLength > MAX_FILE_SIZES.image) {
    return err(new ValidationError(`File size exceeds the ${MAX_FILE_SIZES.image} byte limit`));
  }

  const detectedResult = detectImage(file.bytes);
  if (!detectedResult.ok) return detectedResult;
  const { type, width, height } = detectedResult.value;
  const blobSha256 = createHash("sha256").update(file.bytes).digest("hex");
  const storageKey = deriveLibraryKey(blobSha256, type);
  const mimeType = TYPE_TO_MIME[type];
  const originalFilename = file.name ?? null;
  const actor: LibraryActor = {
    creatorId: creatorId ?? "",
    isAdmin: creatorId === null,
  };

  try {
    const existing = await findRegistration(creatorId, blobSha256);
    if (existing && existing.asset.deletedAt === null) {
      const asset = await updateRegistration(
        existing.asset.id,
        sharing,
        originalFilename,
        false,
      );
      return ok({
        asset: toContentAsset({ ...existing, asset }, actor),
        deduped: true,
      });
    }

    const headResult = await storage.head(storageKey);
    const blobExists = headResult.ok;
    if (!headResult.ok && !isNotFoundStorageError(headResult.error)) {
      return err(headResult.error);
    }

    // Inventory is committed before any upload. It therefore survives a later
    // storage or registration failure and remains enumerable by deferred GC.
    const [blob] = await db
      .insert(contentBlobs)
      .values({
        sha256: blobSha256,
        storageKey,
        mimeType,
        size: file.bytes.byteLength,
        width,
        height,
      })
      .onConflictDoUpdate({
        target: contentBlobs.sha256,
        set: {
          storageKey,
          mimeType,
          size: file.bytes.byteLength,
          width,
          height,
        },
      })
      .returning();
    if (!blob) throw new AppError("LIBRARY_CONFLICT", "Blob inventory is unavailable", 409);

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

    if (existing) {
      const asset = await updateRegistration(
        existing.asset.id,
        sharing,
        originalFilename,
        true,
      );
      return ok({
        asset: toContentAsset({ asset, blob, grantedAssetId: null }, actor),
        deduped: true,
      });
    }

    const inserted = await db
      .insert(contentAssets)
      .values({
        id: randomUUID(),
        creatorId,
        blobSha256,
        sharing,
        originalFilename,
      })
      .onConflictDoNothing()
      .returning();

    let asset = inserted[0];
    let registrationDeduped = false;
    if (!asset) {
      const winner = await findRegistration(creatorId, blobSha256);
      if (!winner) {
        throw new AppError("LIBRARY_CONFLICT", "Asset registration is unavailable", 409);
      }
      asset = await updateRegistration(winner.asset.id, sharing, originalFilename, true);
      registrationDeduped = true;
    }

    return ok({
      asset: toContentAsset({ asset, blob, grantedAssetId: null }, actor),
      deduped: blobExists || registrationDeduped,
    });
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

const normalizeLimit = (limit: number | undefined): number =>
  Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit ?? PAGE_LIMIT)));

const browseVisibility = (actor: LibraryActor) =>
  actor.isAdmin
    ? undefined
    : or(
        eq(contentAssets.creatorId, actor.creatorId),
        eq(contentAssets.sharing, "requestable"),
        eq(contentAssets.sharing, "open"),
      );

/** Browse own registrations plus the requestable/open shared pool. */
export const listLibraryAssets = async (
  actor: LibraryActor,
  opts?: { limit?: number; before?: { createdAt: Date; id: string } },
): Promise<Result<ContentAssetList, AppError>> => {
  const limit = normalizeLimit(opts?.limit);
  const conditions = [isNull(contentAssets.deletedAt)];
  const visibility = browseVisibility(actor);
  if (visibility) conditions.push(visibility);
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
      .select({
        asset: contentAssets,
        blob: contentBlobs,
        grantedAssetId: contentAssetGrants.assetId,
      })
      .from(contentAssets)
      .innerJoin(contentBlobs, eq(contentAssets.blobSha256, contentBlobs.sha256))
      .leftJoin(
        contentAssetGrants,
        and(
          eq(contentAssetGrants.assetId, contentAssets.id),
          eq(contentAssetGrants.granteeCreatorId, actor.creatorId),
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(contentAssets.createdAt), desc(contentAssets.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map((row) => toContentAsset(row, actor));
    const last = items.at(-1);
    return ok({
      items,
      nextCursor: hasMore && last ? `${last.createdAt}|${last.id}` : null,
    });
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

/** Get one own or shared-pool-visible live registration. */
export const getLibraryAsset = async (
  actor: LibraryActor,
  assetId: string,
): Promise<Result<ContentAsset, AppError>> => {
  const visibility = browseVisibility(actor);
  try {
    const [row] = await db
      .select({
        asset: contentAssets,
        blob: contentBlobs,
        grantedAssetId: contentAssetGrants.assetId,
      })
      .from(contentAssets)
      .innerJoin(contentBlobs, eq(contentAssets.blobSha256, contentBlobs.sha256))
      .leftJoin(
        contentAssetGrants,
        and(
          eq(contentAssetGrants.assetId, contentAssets.id),
          eq(contentAssetGrants.granteeCreatorId, actor.creatorId),
        ),
      )
      .where(
        and(
          eq(contentAssets.id, assetId),
          isNull(contentAssets.deletedAt),
          ...(visibility ? [visibility] : []),
        ),
      )
      .limit(1);
    if (!row) return err(new NotFoundError("Library asset not found"));
    return ok(toContentAsset(row, actor));
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

/** Tombstone only the actor's own registration; bytes and other registrations survive. */
export const deleteLibraryAsset = async (
  actor: LibraryActor,
  assetId: string,
): Promise<Result<void, AppError>> => {
  try {
    await db
      .update(contentAssets)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(contentAssets.id, assetId),
          registrationOwnerCondition(actor.isAdmin ? null : actor.creatorId),
          isNull(contentAssets.deletedAt),
        ),
      );
    return ok(undefined);
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

const findManageableAsset = async (actor: LibraryActor, assetId: string) => {
  const [asset] = await db
    .select()
    .from(contentAssets)
    .where(and(eq(contentAssets.id, assetId), isNull(contentAssets.deletedAt)))
    .limit(1);
  if (!asset || (!actor.isAdmin && asset.creatorId !== actor.creatorId)) {
    throw new NotFoundError("Library asset not found");
  }
  return asset;
};

/** Grant a creator use of a requestable asset (owner or platform admin). */
export const grantLibraryAssetUse = async (
  actor: LibraryActor,
  assetId: string,
  granteeCreatorId: string,
  grantedByUserId: string,
): Promise<Result<void, AppError>> => {
  try {
    const asset = await findManageableAsset(actor, assetId);
    if (asset.sharing !== "requestable") {
      return err(new ValidationError("Only requestable assets can be granted"));
    }
    const [grantee] = await db
      .select({ id: creatorProfiles.id })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, granteeCreatorId))
      .limit(1);
    if (!grantee) return err(new NotFoundError("Grantee creator not found"));

    await db
      .insert(contentAssetGrants)
      .values({ assetId, granteeCreatorId, grantedByUserId })
      .onConflictDoUpdate({
        target: [contentAssetGrants.assetId, contentAssetGrants.granteeCreatorId],
        set: { grantedByUserId, grantedAt: new Date() },
      });
    return ok(undefined);
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

/** Revoke a creator's use grant (owner or platform admin). */
export const revokeLibraryAssetUse = async (
  actor: LibraryActor,
  assetId: string,
  granteeCreatorId: string,
): Promise<Result<void, AppError>> => {
  try {
    await findManageableAsset(actor, assetId);
    await db
      .delete(contentAssetGrants)
      .where(
        and(
          eq(contentAssetGrants.assetId, assetId),
          eq(contentAssetGrants.granteeCreatorId, granteeCreatorId),
        ),
      );
    return ok(undefined);
  } catch (cause) {
    return err(asServiceError(cause));
  }
};

/** Determine whether an actor may reference any live registration for a blob key. */
export const canUseAsset = async (
  actor: LibraryActor,
  storageKey: string,
): Promise<boolean> => {
  const rows = await db
    .select({
      creatorId: contentAssets.creatorId,
      sharing: contentAssets.sharing,
      grantedAssetId: contentAssetGrants.assetId,
    })
    .from(contentAssets)
    .innerJoin(contentBlobs, eq(contentAssets.blobSha256, contentBlobs.sha256))
    .leftJoin(
      contentAssetGrants,
      and(
        eq(contentAssetGrants.assetId, contentAssets.id),
        eq(contentAssetGrants.granteeCreatorId, actor.creatorId),
      ),
    )
    .where(
      and(
        eq(contentBlobs.storageKey, storageKey),
        isNull(contentAssets.deletedAt),
      ),
    );

  return rows.some(
    (row) =>
      actor.isAdmin ||
      row.creatorId === actor.creatorId ||
      row.sharing === "open" ||
      (row.sharing === "requestable" && row.grantedAssetId !== null),
  );
};

/** Backward-compatible ownership primitive for current surface validators. */
export const isRegisteredLibraryAsset = async (
  ownerCreatorId: string,
  storageKey: string,
): Promise<boolean> => {
  const [row] = await db
    .select({ id: contentAssets.id })
    .from(contentAssets)
    .innerJoin(contentBlobs, eq(contentAssets.blobSha256, contentBlobs.sha256))
    .where(
      and(
        eq(contentAssets.creatorId, ownerCreatorId),
        eq(contentBlobs.storageKey, storageKey),
        isNull(contentAssets.deletedAt),
      ),
    )
    .limit(1);
  return !!row;
};
