import { createHash } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  AppError,
  MAX_FILE_SIZES,
  isLibraryAssetKey,
  isOwnedPressKey,
} from "@snc/shared";
import type { DraftPressContent, PressContent } from "@snc/shared";

import { db } from "../db/connection.js";
import {
  creatorPressConfigs,
  creatorProfiles,
} from "../db/schema/creator.schema.js";
import { content } from "../db/schema/content.schema.js";
import { storage } from "../storage/index.js";
import { uploadLibraryAsset } from "./library.js";

export type ContentLibraryMigrationSummary = {
  sourceObjectsRead: number;
  registrationsProcessed: number;
  deduplicatedUploads: number;
  referencesMigrated: number;
  rowsUpdated: number;
  libraryObjectsVerified: number;
};

export type ContentLibraryMigrationReference = {
  surface: "creator-profile" | "content-thumbnail" | "press";
  rowId: string;
  field: string;
  oldKey: string;
  newKey: string;
};

export type ContentLibraryMigrationManifest = {
  version: 1;
  createdAt: string;
  creatorIds: readonly string[] | null;
  references: readonly ContentLibraryMigrationReference[];
};

export type ContentLibraryMigrationOptions = {
  /** Restrict a run to named creators; used for isolated verification. */
  creatorIds?: readonly string[];
  /** New durable file written and fsynced before any live reference changes. */
  manifestPath: string;
};

type ProfileUpdate = {
  id: string;
  field: "avatarKey" | "bannerKey";
  oldKey: string;
  newKey: string;
};

type ContentUpdate = {
  id: string;
  oldKey: string;
  newKey: string;
};

type PressUpdate = {
  creatorId: string;
  oldContent: PressContent;
  oldDraftContent: DraftPressContent | null;
  content: PressContent;
  draftContent: DraftPressContent | null;
  contentChanged: boolean;
  draftChanged: boolean;
};

const migrationError = (message: string): AppError =>
  new AppError("CONTENT_LIBRARY_MIGRATION_ERROR", message, 500);

const readStorageBytes = async (key: string): Promise<Uint8Array> => {
  const result = await storage.download(key);
  if (!result.ok) {
    throw migrationError(`Cannot read image '${key}': ${result.error.message}`);
  }
  if (result.value.size > MAX_FILE_SIZES.image) {
    throw migrationError(
      `Image '${key}' exceeds the library's ${MAX_FILE_SIZES.image} byte limit`,
    );
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = result.value.stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_SIZES.image) {
        throw migrationError(
          `Image '${key}' exceeds the library's ${MAX_FILE_SIZES.image} byte limit`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (size !== result.value.size) {
    throw migrationError(
      `Image '${key}' changed while being read (${result.value.size} bytes expected, ${size} read)`,
    );
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const persistManifest = async (
  manifestPath: string,
  manifest: ContentLibraryMigrationManifest,
): Promise<void> => {
  try {
    await mkdir(dirname(manifestPath), { recursive: true });
    const file = await open(manifestPath, "wx");
    try {
      await file.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw migrationError(`Cannot persist rollback manifest '${manifestPath}': ${detail}`);
  }
};

const mapPressDocument = async <T extends PressContent>(
  value: T,
  creatorId: string,
  document: "content" | "draftContent",
  migrateKey: (creatorId: string, key: string) => Promise<string>,
  manifestReferences: ContentLibraryMigrationReference[],
): Promise<T> => {
  const mapKey = async (key: string, field: string): Promise<string> => {
    if (!isOwnedPressKey(key, creatorId)) return key;
    const newKey = await migrateKey(creatorId, key);
    if (newKey !== key) {
      manifestReferences.push({
        surface: "press",
        rowId: creatorId,
        field,
        oldKey: key,
        newKey,
      });
    }
    return newKey;
  };
  const mapImage = async <I extends { key: string } | null | undefined>(
    image: I,
    field: string,
  ): Promise<I> => image
    ? { ...image, key: await mapKey(image.key, field) } as I
    : image;

  return {
    ...value,
    ...(value.banner
      ? { banner: await mapImage(value.banner, `${document}.banner.key`) }
      : {}),
    ...(value.aboutPhoto
      ? { aboutPhoto: await mapImage(value.aboutPhoto, `${document}.aboutPhoto.key`) }
      : {}),
    ...(Array.isArray(value.members)
      ? {
          members: await Promise.all(
            value.members.map(async (member, index) => ({
              ...member,
              ...(member.photo
                ? {
                    photo: await mapImage(
                      member.photo,
                      `${document}.members[${index}].photo.key`,
                    ),
                  }
                : {}),
            })),
          ),
        }
      : {}),
    ...(Array.isArray(value.highlights)
      ? {
          highlights: await Promise.all(
            value.highlights.map(async (highlight, index) => ({
              ...highlight,
              ...(highlight.coverArt
                ? {
                    coverArt: await mapImage(
                      highlight.coverArt,
                      `${document}.highlights[${index}].coverArt.key`,
                    ),
                  }
                : {}),
            })),
          ),
        }
      : {}),
    ...(Array.isArray(value.photos)
      ? {
          photos: await Promise.all(
            value.photos.map((key, index) =>
              mapKey(key, `${document}.photos[${index}]`),
            ),
          ),
        }
      : {}),
    ...(Array.isArray(value.gallery)
      ? {
          gallery: await Promise.all(
            value.gallery.map((image, index) =>
              mapImage(image, `${document}.gallery[${index}].key`),
            ),
          ),
        }
      : {}),
    ...(Array.isArray(value.releases)
      ? {
          releases: await Promise.all(
            value.releases.map(async (release, index) => ({
              ...release,
              ...(release.artKey
                ? {
                    artKey: await mapKey(
                      release.artKey,
                      `${document}.releases[${index}].artKey`,
                    ),
                  }
                : {}),
            })),
          ),
        }
      : {}),
  } as T;
};

/**
 * Re-point every existing image surface to verified content-addressed bytes.
 *
 * Preparation uploads and verifies every destination before one transaction
 * changes any live reference. Legacy objects are deliberately retained as
 * rollback copies; once references move, all active surfaces share only the
 * deduplicated library object.
 */
export const migrateContentLibraryImages = async (
  options: ContentLibraryMigrationOptions,
): Promise<ContentLibraryMigrationSummary> => {
  if (!options.manifestPath.trim()) {
    throw migrationError("A rollback manifest path is required");
  }

  const creatorIds = options.creatorIds ? [...new Set(options.creatorIds)] : undefined;
  if (creatorIds?.length === 0) {
    return {
      sourceObjectsRead: 0,
      registrationsProcessed: 0,
      deduplicatedUploads: 0,
      referencesMigrated: 0,
      rowsUpdated: 0,
      libraryObjectsVerified: 0,
    };
  }

  const profileQuery = db
    .select({
      id: creatorProfiles.id,
      avatarKey: creatorProfiles.avatarKey,
      bannerKey: creatorProfiles.bannerKey,
    })
    .from(creatorProfiles);
  const contentQuery = db
    .select({
      id: content.id,
      creatorId: content.creatorId,
      thumbnailKey: content.thumbnailKey,
    })
    .from(content);
  const pressQuery = db
    .select({
      creatorId: creatorPressConfigs.creatorId,
      content: creatorPressConfigs.content,
      draftContent: creatorPressConfigs.draftContent,
    })
    .from(creatorPressConfigs);

  const [profiles, contentRows, pressRows] = await Promise.all([
    creatorIds
      ? profileQuery.where(inArray(creatorProfiles.id, creatorIds))
      : profileQuery,
    creatorIds
      ? contentQuery.where(
          and(inArray(content.creatorId, creatorIds), isNull(content.deletedAt)),
        )
      : contentQuery.where(isNull(content.deletedAt)),
    creatorIds
      ? pressQuery.where(inArray(creatorPressConfigs.creatorId, creatorIds))
      : pressQuery,
  ]);

  const sourceBytes = new Map<string, Uint8Array>();
  const resolvedKeys = new Map<string, string>();
  const verifiedLibraryKeys = new Set<string>();
  const manifestReferences: ContentLibraryMigrationReference[] = [];
  let sourceObjectsRead = 0;
  let registrationsProcessed = 0;
  let deduplicatedUploads = 0;
  let referencesMigrated = 0;

  const migrateKey = async (creatorId: string, key: string): Promise<string> => {
    if (isLibraryAssetKey(key)) return key;

    const cacheKey = `${creatorId}\0${key}`;
    const cached = resolvedKeys.get(cacheKey);
    if (cached) {
      referencesMigrated += 1;
      return cached;
    }

    let bytes = sourceBytes.get(key);
    if (!bytes) {
      bytes = await readStorageBytes(key);
      sourceBytes.set(key, bytes);
      sourceObjectsRead += 1;
    }

    const upload = await uploadLibraryAsset(creatorId, {
      name: key.split("/").at(-1) ?? "migrated-image",
      declaredType: "application/octet-stream",
      size: bytes.byteLength,
      bytes,
    });
    if (!upload.ok) {
      throw migrationError(`Cannot migrate image '${key}': ${upload.error.message}`);
    }
    registrationsProcessed += 1;
    if (upload.value.deduped) deduplicatedUploads += 1;

    const destination = await readStorageBytes(upload.value.asset.storageKey);
    const destinationHash = createHash("sha256").update(destination).digest("hex");
    if (destinationHash !== upload.value.asset.blobSha256) {
      throw migrationError(
        `Content-addressed verification failed for '${upload.value.asset.storageKey}'`,
      );
    }

    resolvedKeys.set(cacheKey, upload.value.asset.storageKey);
    verifiedLibraryKeys.add(upload.value.asset.storageKey);
    referencesMigrated += 1;
    return upload.value.asset.storageKey;
  };

  const profileUpdates: ProfileUpdate[] = [];
  for (const profile of profiles) {
    for (const field of ["avatarKey", "bannerKey"] as const) {
      const oldKey = profile[field];
      if (!oldKey || isLibraryAssetKey(oldKey)) continue;
      const newKey = await migrateKey(profile.id, oldKey);
      profileUpdates.push({ id: profile.id, field, oldKey, newKey });
      manifestReferences.push({
        surface: "creator-profile",
        rowId: profile.id,
        field,
        oldKey,
        newKey,
      });
    }
  }

  const contentUpdates: ContentUpdate[] = [];
  for (const row of contentRows) {
    if (!row.thumbnailKey || isLibraryAssetKey(row.thumbnailKey)) continue;
    const newKey = await migrateKey(row.creatorId, row.thumbnailKey);
    contentUpdates.push({ id: row.id, oldKey: row.thumbnailKey, newKey });
    manifestReferences.push({
      surface: "content-thumbnail",
      rowId: row.id,
      field: "thumbnailKey",
      oldKey: row.thumbnailKey,
      newKey,
    });
  }

  const pressUpdates: PressUpdate[] = [];
  for (const row of pressRows) {
    const beforeContentReferences = referencesMigrated;
    const nextContent = await mapPressDocument(
      row.content,
      row.creatorId,
      "content",
      migrateKey,
      manifestReferences,
    );
    const contentChanged = referencesMigrated > beforeContentReferences;

    const beforeDraftReferences = referencesMigrated;
    const nextDraft = row.draftContent === null
      ? null
      : await mapPressDocument(
          row.draftContent,
          row.creatorId,
          "draftContent",
          migrateKey,
          manifestReferences,
        );
    const draftChanged = referencesMigrated > beforeDraftReferences;

    if (contentChanged || draftChanged) {
      pressUpdates.push({
        creatorId: row.creatorId,
        oldContent: row.content,
        oldDraftContent: row.draftContent,
        content: nextContent,
        draftContent: nextDraft,
        contentChanged,
        draftChanged,
      });
    }
  }

  await persistManifest(options.manifestPath, {
    version: 1,
    createdAt: new Date().toISOString(),
    creatorIds: creatorIds ?? null,
    references: manifestReferences,
  });

  let rowsUpdated = 0;
  await db.transaction(async (tx) => {
    for (const update of profileUpdates) {
      const changed = await tx
        .update(creatorProfiles)
        .set({ [update.field]: update.newKey })
        .where(
          and(
            eq(creatorProfiles.id, update.id),
            eq(creatorProfiles[update.field], update.oldKey),
          ),
        )
        .returning({ id: creatorProfiles.id });
      if (changed.length !== 1) {
        throw migrationError(`Creator image reference changed concurrently for '${update.id}'`);
      }
      rowsUpdated += 1;
    }

    for (const update of contentUpdates) {
      const changed = await tx
        .update(content)
        .set({ thumbnailKey: update.newKey })
        .where(
          and(eq(content.id, update.id), eq(content.thumbnailKey, update.oldKey)),
        )
        .returning({ id: content.id });
      if (changed.length !== 1) {
        throw migrationError(`Content thumbnail reference changed concurrently for '${update.id}'`);
      }
      rowsUpdated += 1;
    }

    for (const update of pressUpdates) {
      const oldDraftCondition = update.oldDraftContent === null
        ? isNull(creatorPressConfigs.draftContent)
        : eq(creatorPressConfigs.draftContent, update.oldDraftContent);
      const changed = await tx
        .update(creatorPressConfigs)
        .set({
          ...(update.contentChanged ? { content: update.content } : {}),
          ...(update.draftChanged ? { draftContent: update.draftContent } : {}),
        })
        .where(
          and(
            eq(creatorPressConfigs.creatorId, update.creatorId),
            eq(creatorPressConfigs.content, update.oldContent),
            oldDraftCondition,
          ),
        )
        .returning({ creatorId: creatorPressConfigs.creatorId });
      if (changed.length !== 1) {
        throw migrationError(
          `Press image references changed concurrently for '${update.creatorId}'`,
        );
      }
      rowsUpdated += 1;
    }
  });

  return {
    sourceObjectsRead,
    registrationsProcessed,
    deduplicatedUploads,
    referencesMigrated,
    rowsUpdated,
    libraryObjectsVerified: verifiedLibraryKeys.size,
  };
};
