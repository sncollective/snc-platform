import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";

import { db } from "../../src/db/connection.js";
import { contentAssets } from "../../src/db/schema/library.schema.js";
import { creatorProfiles } from "../../src/db/schema/creator.schema.js";
import {
  deleteLibraryAsset,
  getLibraryAsset,
  isRegisteredLibraryAsset,
  listLibraryAssets,
  uploadLibraryAsset,
} from "../../src/services/library.js";
import { storage } from "../../src/storage/index.js";
import { libraryRawRoutes } from "../../src/routes/library-raw.routes.js";

const bytes = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

const creatorIds = [randomUUID(), randomUUID()];
const uploadedKeys = new Set<string>();

afterAll(async () => {
  for (const key of uploadedKeys) await storage.delete(key);
  await db.delete(creatorProfiles).where(inArray(creatorProfiles.id, creatorIds));
});

describe("content library integration", () => {
  it("deduplicates relabeled bytes across creators and keeps raw bytes after tombstone", async () => {
    await db.insert(creatorProfiles).values(
      creatorIds.map((id) => ({ id, displayName: `Library test ${id}` })),
    );

    const first = await uploadLibraryAsset(creatorIds[0]!, {
      name: "first.jpg",
      declaredType: "image/jpeg",
      size: bytes.byteLength,
      bytes,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    uploadedKeys.add(first.value.asset.storageKey);

    const second = await uploadLibraryAsset(creatorIds[1]!, {
      name: "second.png",
      declaredType: "image/png",
      size: bytes.byteLength,
      bytes,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.asset.storageKey).toBe(first.value.asset.storageKey);
    expect(second.value.deduped).toBe(true);

    const repeat = await uploadLibraryAsset(creatorIds[0]!, {
      name: "repeat.png",
      declaredType: "image/png",
      size: bytes.byteLength,
      bytes,
    });
    expect(repeat.ok).toBe(true);
    if (!repeat.ok) return;
    expect(repeat.value.deduped).toBe(true);
    expect(repeat.value.asset.id).toBe(first.value.asset.id);

    const listed = await listLibraryAssets(creatorIds[0]!);
    expect(listed).toMatchObject({ ok: true, value: { items: [first.value.asset] } });
    expect(await isRegisteredLibraryAsset(creatorIds[0]!, first.value.asset.storageKey)).toBe(true);
    expect(await isRegisteredLibraryAsset(creatorIds[1]!, first.value.asset.storageKey)).toBe(true);

    const deleted = await deleteLibraryAsset(creatorIds[0]!, first.value.asset.id);
    expect(deleted).toEqual({ ok: true, value: undefined });
    expect(await getLibraryAsset(creatorIds[0]!, first.value.asset.id)).toMatchObject({ ok: false });
    expect(await isRegisteredLibraryAsset(creatorIds[0]!, first.value.asset.storageKey)).toBe(false);

    const rawPath = first.value.asset.storageKey.slice("library/".length);
    const rawResponse = await libraryRawRoutes.request(`/raw/${rawPath}`);
    expect(rawResponse.status).toBe(200);
    expect(rawResponse.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await rawResponse.arrayBuffer())).toEqual(bytes);

    const missing = await storage.head(first.value.asset.storageKey + ".missing");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");
  });
});
