import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { libraryRawPath } from "@snc/shared";
import type { PressContent } from "@snc/shared";

import { db } from "../../src/db/connection.js";
import { content } from "../../src/db/schema/content.schema.js";
import {
  creatorPressConfigs,
  creatorProfiles,
} from "../../src/db/schema/creator.schema.js";
import {
  contentAssets,
  contentBlobs,
} from "../../src/db/schema/library.schema.js";
import { contentMediaRoutes } from "../../src/routes/content-media.routes.js";
import { creatorMediaRoutes } from "../../src/routes/creator-media.routes.js";
import { libraryRawRoutes } from "../../src/routes/library-raw.routes.js";
import { pressRoutes } from "../../src/routes/press.routes.js";
import { migrateContentLibraryImages } from "../../src/services/content-library-migration.js";
import { storage } from "../../src/storage/index.js";

const imageBytes = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

const uploadLegacyImage = async (key: string): Promise<void> => {
  const result = await storage.upload(
    key,
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(imageBytes);
        controller.close();
      },
    }),
    { contentType: "image/png", contentLength: imageBytes.byteLength },
  );
  expect(result.ok).toBe(true);
};

const responseBytes = async (response: Response): Promise<Uint8Array> =>
  new Uint8Array(await response.arrayBuffer());

describe("content-library surface migration", () => {
  it("atomically re-points every image surface, preserves delivery, and is idempotent", async () => {
    const creatorId = randomUUID();
    const contentId = randomUUID();
    const prefix = `migration-test/${creatorId}`;
    const oldKeys = {
      avatar: `${prefix}/avatar.png`,
      banner: `${prefix}/banner.png`,
      thumbnail: `${prefix}/thumbnail.png`,
      pressLegacy: `creators/${creatorId}/press/legacy.png`,
      pressImage: `creators/${creatorId}/press/image.png`,
    };
    const mediaKey = `${prefix}/media.wav`;
    let libraryKey: string | undefined;
    let blobSha256: string | undefined;

    // A pre-v2 JSON document intentionally omits later defaulted arrays. The
    // migration must preserve that stored shape while re-pointing its image keys.
    const published = {
      enabled: true,
      photos: [oldKeys.pressLegacy],
      banner: { key: oldKeys.pressImage, alt: "Press banner" },
    } as PressContent;
    const draft = {
      ...published,
      aboutPhoto: { key: oldKeys.pressImage, alt: "Draft about" },
    } as PressContent;

    try {
      for (const key of Object.values(oldKeys)) await uploadLegacyImage(key);

      await db.insert(creatorProfiles).values({
        id: creatorId,
        displayName: "Migration integration creator",
        avatarKey: oldKeys.avatar,
        bannerKey: oldKeys.banner,
      });
      await db.insert(content).values({
        id: contentId,
        creatorId,
        type: "audio",
        title: "Migration integration content",
        mediaKey,
        thumbnailKey: oldKeys.thumbnail,
      });
      await db.insert(creatorPressConfigs).values({
        creatorId,
        content: published,
        draftContent: draft,
      });

      const first = await migrateContentLibraryImages({ creatorIds: [creatorId] });
      expect(first).toMatchObject({
        sourceObjectsRead: 5,
        registrationsProcessed: 5,
        referencesMigrated: 8,
        rowsUpdated: 4,
        libraryObjectsVerified: 1,
      });

      const [profile] = await db
        .select()
        .from(creatorProfiles)
        .where(eq(creatorProfiles.id, creatorId));
      const [contentRow] = await db
        .select()
        .from(content)
        .where(eq(content.id, contentId));
      const [pressRow] = await db
        .select()
        .from(creatorPressConfigs)
        .where(eq(creatorPressConfigs.creatorId, creatorId));
      const registrations = await db
        .select()
        .from(contentAssets)
        .where(eq(contentAssets.creatorId, creatorId));

      expect(profile).toBeDefined();
      expect(contentRow).toBeDefined();
      expect(pressRow).toBeDefined();
      expect(registrations).toHaveLength(1);
      libraryKey = profile!.avatarKey ?? undefined;
      blobSha256 = registrations[0]!.blobSha256;
      expect(libraryKey).toMatch(/^library\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/);
      expect(profile!.bannerKey).toBe(libraryKey);
      expect(contentRow!.thumbnailKey).toBe(libraryKey);
      expect(contentRow!.mediaKey).toBe(mediaKey);
      expect(pressRow!.content.photos).toEqual([libraryKey]);
      expect(pressRow!.content.banner?.key).toBe(libraryKey);
      expect(pressRow!.draftContent?.aboutPhoto?.key).toBe(libraryKey);

      const avatarResponse = await creatorMediaRoutes.request(`/${creatorId}/avatar`);
      const bannerResponse = await creatorMediaRoutes.request(`/${creatorId}/banner`);
      const thumbnailResponse = await contentMediaRoutes.request(`/${contentId}/thumbnail`);
      expect(avatarResponse.status).toBe(200);
      expect(bannerResponse.status).toBe(200);
      expect(thumbnailResponse.status).toBe(200);
      expect(await responseBytes(avatarResponse)).toEqual(imageBytes);
      expect(await responseBytes(bannerResponse)).toEqual(imageBytes);
      expect(await responseBytes(thumbnailResponse)).toEqual(imageBytes);

      const legacyPressResponse = await pressRoutes.request(
        `/${creatorId}/press/photos/0`,
      );
      expect(legacyPressResponse.status).toBe(302);
      expect(legacyPressResponse.headers.get("location")).toBe(
        `/api/library/raw/${libraryRawPath(libraryKey!)}`,
      );
      const rawResponse = await libraryRawRoutes.request(
        `/raw/${libraryRawPath(libraryKey!)}`,
      );
      expect(rawResponse.status).toBe(200);
      expect(await responseBytes(rawResponse)).toEqual(imageBytes);

      const pressPageResponse = await pressRoutes.request(`/${creatorId}/press`);
      expect(pressPageResponse.status).toBe(200);
      const pressPage = await pressPageResponse.json() as {
        content: { banner: { key: string; src: string } | null };
      };
      expect(pressPage.content.banner?.key).toBe(libraryKey);
      expect(pressPage.content.banner?.src).toContain(libraryKey);

      const second = await migrateContentLibraryImages({ creatorIds: [creatorId] });
      expect(second).toEqual({
        sourceObjectsRead: 0,
        registrationsProcessed: 0,
        deduplicatedUploads: 0,
        referencesMigrated: 0,
        rowsUpdated: 0,
        libraryObjectsVerified: 0,
      });
      expect(await storage.head(libraryKey!)).toMatchObject({ ok: true });
    } finally {
      await db.delete(creatorPressConfigs).where(eq(creatorPressConfigs.creatorId, creatorId));
      await db.delete(content).where(eq(content.id, contentId));
      await db.delete(creatorProfiles).where(eq(creatorProfiles.id, creatorId));
      if (blobSha256) {
        await db.delete(contentBlobs).where(eq(contentBlobs.sha256, blobSha256));
      }
      for (const key of Object.values(oldKeys)) await storage.delete(key);
      if (libraryKey) await storage.delete(libraryKey);
    }
  });

  it("does not partially re-point live references when preparation fails", async () => {
    const creatorId = randomUUID();
    const avatarKey = `migration-test/${creatorId}/avatar.png`;
    const missingBannerKey = `migration-test/${creatorId}/missing-banner.png`;
    let uploadedLibraryKey: string | undefined;
    let blobSha256: string | undefined;

    try {
      await uploadLegacyImage(avatarKey);
      await db.insert(creatorProfiles).values({
        id: creatorId,
        displayName: "Migration atomicity creator",
        avatarKey,
        bannerKey: missingBannerKey,
      });

      await expect(
        migrateContentLibraryImages({ creatorIds: [creatorId] }),
      ).rejects.toMatchObject({ code: "CONTENT_LIBRARY_MIGRATION_ERROR" });

      const [profile] = await db
        .select({
          avatarKey: creatorProfiles.avatarKey,
          bannerKey: creatorProfiles.bannerKey,
        })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.id, creatorId));
      expect(profile).toEqual({ avatarKey, bannerKey: missingBannerKey });

      const [registration] = await db
        .select({
          blobSha256: contentAssets.blobSha256,
          storageKey: contentBlobs.storageKey,
        })
        .from(contentAssets)
        .innerJoin(contentBlobs, eq(contentAssets.blobSha256, contentBlobs.sha256))
        .where(eq(contentAssets.creatorId, creatorId));
      uploadedLibraryKey = registration?.storageKey;
      blobSha256 = registration?.blobSha256;
    } finally {
      await db.delete(creatorProfiles).where(eq(creatorProfiles.id, creatorId));
      if (blobSha256) {
        await db.delete(contentBlobs).where(eq(contentBlobs.sha256, blobSha256));
      }
      await storage.delete(avatarKey);
      if (uploadedLibraryKey) await storage.delete(uploadedLibraryKey);
    }
  });
});
