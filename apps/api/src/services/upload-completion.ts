import { eq } from "drizzle-orm";

import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  MAX_FILE_SIZES,
} from "@snc/shared";
import type { UploadPurpose, StorageProvider, CompleteUploadRequest } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { getBoss } from "../jobs/boss.js";
import { JOB_QUEUES } from "../jobs/queue-names.js";
import { requireCreatorPermission } from "./creator-team.js";

// ── Constants ──

export const PURPOSE_CATEGORY: Record<UploadPurpose, string> = {
  "content-media": "media",
  "content-thumbnail": "image",
  "creator-avatar": "image",
  "creator-banner": "image",
  "playout-media": "video",
};

export const PURPOSE_KEY_PREFIX: Record<UploadPurpose, string> = {
  "content-media": "content",
  "content-thumbnail": "content",
  "creator-avatar": "creators",
  "creator-banner": "creators",
  "playout-media": "playout",
};

export const PURPOSE_FIELD: Record<UploadPurpose, string> = {
  "content-media": "media",
  "content-thumbnail": "thumbnail",
  "creator-avatar": "avatar",
  "creator-banner": "banner",
  "playout-media": "source",
};

// ── Helpers ──

const RECORD_UPLOAD_DISPATCH: Record<UploadPurpose, (resourceId: string, key: string) => Promise<void>> = {
  "content-media": async (resourceId, key) => {
    await db.update(content).set({ mediaKey: key, updatedAt: new Date() }).where(eq(content.id, resourceId));
  },
  "content-thumbnail": async (resourceId, key) => {
    await db.update(content).set({ thumbnailKey: key, updatedAt: new Date() }).where(eq(content.id, resourceId));
  },
  "creator-avatar": async (resourceId, key) => {
    await db.update(creatorProfiles).set({ avatarKey: key, updatedAt: new Date() }).where(eq(creatorProfiles.id, resourceId));
  },
  "creator-banner": async (resourceId, key) => {
    await db.update(creatorProfiles).set({ bannerKey: key, updatedAt: new Date() }).where(eq(creatorProfiles.id, resourceId));
  },
  "playout-media": async (resourceId, key) => {
    await db.update(playoutItems).set({ sourceKey: key, updatedAt: new Date() }).where(eq(playoutItems.id, resourceId));
  },
};

// ── Public Exports ──

/** Params accepted by `completeUploadFlow`. */
export interface CompleteUploadFlowParams {
  body: CompleteUploadRequest;
  userId: string;
  roles: string[];
  storage: StorageProvider;
  logger: { warn: (obj: object, msg: string) => void };
  /**
   * When true, bypass the `expectedPrefix` startsWith check.
   * Useful for internal callers that have already validated the key path
   * by other means (e.g., multipart completion where the key was server-generated).
   */
  skipKeyValidation?: boolean;
}

/**
 * Verify the caller owns or has permission over the upload target resource.
 *
 * @returns `{ contentType }` when the resource is a content row (used to gate MIME validation), or `{}` for other purposes.
 * @throws {UnauthorizedError} When the caller lacks the required role or ownership.
 * @throws {NotFoundError} When the referenced resource does not exist.
 * @throws {ValidationError} When the purpose is not recognized.
 */
export const verifyOwnership = async (
  purpose: UploadPurpose,
  resourceId: string,
  userId: string,
  roles?: string[],
): Promise<{ contentType?: string }> => {
  if (purpose === "playout-media") {
    if (!roles?.includes("admin")) {
      throw new UnauthorizedError("Admin role required for playout uploads");
    }
    return {};
  }

  if (purpose.startsWith("content-")) {
    const [row] = await db
      .select({ creatorId: content.creatorId, type: content.type })
      .from(content)
      .where(eq(content.id, resourceId))
      .limit(1);
    if (!row) throw new NotFoundError("Content not found");

    await requireCreatorPermission(userId, row.creatorId, "manageContent", roles);
    return { contentType: row.type };
  }

  if (purpose.startsWith("creator-")) {
    await requireCreatorPermission(userId, resourceId, "editProfile", roles);
    return {};
  }

  throw new ValidationError("Invalid purpose");
};

/**
 * Record a completed upload by writing the storage key to the appropriate DB column.
 *
 * @throws {Error} When the purpose has no registered dispatch handler (should not occur with valid UploadPurpose values).
 */
export const recordUpload = async (
  purpose: UploadPurpose,
  resourceId: string,
  key: string,
): Promise<void> => {
  await RECORD_UPLOAD_DISPATCH[purpose](resourceId, key);
};

/**
 * Execute the full post-upload flow: validate key, verify ownership, HEAD-check size,
 * clean up old storage keys, record the upload in the DB, and queue processing jobs.
 *
 * When `skipKeyValidation` is true the expected-prefix check is bypassed — use this
 * for internal callers that have already validated the key path by other means.
 *
 * @throws {ValidationError} When the key prefix is wrong, the file is missing, or it exceeds size limits.
 * @throws {UnauthorizedError} When the caller lacks the required role or ownership.
 */
export async function completeUploadFlow(params: CompleteUploadFlowParams): Promise<{ key: string }> {
  const { body, userId, roles, storage: storageProvider, logger, skipKeyValidation } = params;

  if (!skipKeyValidation) {
    const expectedPrefix = `${PURPOSE_KEY_PREFIX[body.purpose]}/${body.resourceId}/${PURPOSE_FIELD[body.purpose]}/`;
    if (!body.key.startsWith(expectedPrefix)) {
      throw new ValidationError("Key does not match the expected upload path");
    }
  }

  await verifyOwnership(body.purpose, body.resourceId, userId, roles);

  const purposeCategory = PURPOSE_CATEGORY[body.purpose];

  const headResult = await storageProvider.head(body.key);
  if (!headResult.ok) {
    throw new ValidationError("File not found in storage — upload may have failed");
  }
  const maxSize = MAX_FILE_SIZES[purposeCategory as keyof typeof MAX_FILE_SIZES];
  if (headResult.value.size > maxSize) {
    await storageProvider.delete(body.key);
    throw new ValidationError("Uploaded file exceeds size limit");
  }

  if (body.purpose.startsWith("content-")) {
    const [existing] = await db
      .select({ mediaKey: content.mediaKey, thumbnailKey: content.thumbnailKey })
      .from(content)
      .where(eq(content.id, body.resourceId))
      .limit(1);
    const oldKey =
      body.purpose === "content-media"
        ? (existing?.mediaKey ?? null)
        : (existing?.thumbnailKey ?? null);
    if (oldKey && oldKey !== body.key) {
      const deleteResult = await storageProvider.delete(oldKey);
      if (!deleteResult.ok) {
        logger.warn({ error: deleteResult.error.message, key: oldKey }, "Failed to delete old file");
      }
    }
  }

  await recordUpload(body.purpose, body.resourceId, body.key);

  if (body.purpose === "content-media") {
    await db
      .update(content)
      .set({ processingStatus: "processing", updatedAt: new Date() })
      .where(eq(content.id, body.resourceId));

    const boss = getBoss();
    if (boss) {
      await boss.send(JOB_QUEUES.PROBE_CODEC, { contentId: body.resourceId });
    }
  }

  if (body.purpose === "playout-media") {
    await db
      .update(playoutItems)
      .set({ processingStatus: "uploading", updatedAt: new Date() })
      .where(eq(playoutItems.id, body.resourceId));

    const boss = getBoss();
    if (boss) {
      await boss.send(JOB_QUEUES.PLAYOUT_INGEST, { playoutItemId: body.resourceId });
    }
  }

  return { key: body.key };
}
