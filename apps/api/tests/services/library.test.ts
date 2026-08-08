import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { err, NotFoundError, ok } from "@snc/shared";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockStorageHead = vi.fn();
const mockStorageUpload = vi.fn();

const contentAssets = {
  id: "asset.id",
  creatorId: "asset.creatorId",
  blobSha256: "asset.blobSha256",
  sharing: "asset.sharing",
  deletedAt: "asset.deletedAt",
  createdAt: "asset.createdAt",
};
const contentBlobs = {
  sha256: "blob.sha256",
  storageKey: "blob.storageKey",
};
const contentAssetGrants = {
  assetId: "grant.assetId",
  granteeCreatorId: "grant.granteeCreatorId",
};
const creatorProfiles = { id: "creator.id" };
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: vi.fn(),
};

const pngBytes = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

const blob = {
  sha256: "a".repeat(64),
  storageKey: `library/aa/${"a".repeat(64)}.png`,
  mimeType: "image/png",
  size: pngBytes.byteLength,
  width: 1,
  height: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const asset = {
  id: "00000000-0000-4000-a000-000000000001",
  creatorId: "creator-1",
  blobSha256: blob.sha256,
  sharing: "private" as const,
  originalFilename: "image.png",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
};

const joined = { asset, blob, grantedAssetId: null };
const selectQueue: unknown[][] = [];
let insertedBlob = blob;
let insertedAsset = asset;
let failAssetInsert = false;

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/library.schema.js", () => ({
    contentAssets,
    contentBlobs,
    contentAssetGrants,
  }));
  vi.doMock("../../src/db/schema/creator.schema.js", () => ({ creatorProfiles }));
  vi.doMock("../../src/storage/index.js", () => ({
    storage: { head: mockStorageHead, upload: mockStorageUpload },
  }));
  return import("../../src/services/library.js");
};

beforeEach(() => {
  vi.resetAllMocks();
  selectQueue.length = 0;
  insertedBlob = blob;
  insertedAsset = asset;
  failAssetInsert = false;

  mockSelect.mockImplementation(() => ({
    from: () => ({
      innerJoin: () => ({
        leftJoin: () => ({
          where: () => ({ limit: () => Promise.resolve(selectQueue.shift() ?? []) }),
        }),
        where: () => ({ limit: () => Promise.resolve(selectQueue.shift() ?? []) }),
      }),
      where: () => ({ limit: () => Promise.resolve(selectQueue.shift() ?? []) }),
    }),
  }));

  mockInsert.mockImplementation((table) => ({
    values: () =>
      table === contentBlobs
        ? {
            onConflictDoUpdate: () => ({ returning: () => Promise.resolve([insertedBlob]) }),
          }
        : {
            onConflictDoNothing: () => ({
              returning: () =>
                failAssetInsert
                  ? Promise.reject(new Error("registration insert failed"))
                  : Promise.resolve([insertedAsset]),
            }),
          },
  }));

  mockUpdate.mockReturnValue({
    set: (values: Record<string, unknown>) => ({
      where: () => ({ returning: () => Promise.resolve([{ ...asset, ...values }]) }),
    }),
  });

  mockStorageHead.mockResolvedValue(ok({ size: 0, contentType: "image/png" }));
  mockStorageUpload.mockResolvedValue(ok({ key: blob.storageKey, size: pngBytes.byteLength }));
});

afterEach(() => {
  vi.resetModules();
});

describe("library service upload and inventory", () => {
  it("detects bytes rather than trusting a relabeled client MIME", async () => {
    selectQueue.push([]);
    mockStorageHead.mockResolvedValueOnce(err(new NotFoundError("File not found")));
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      name: "relabeled.png",
      declaredType: "image/jpeg",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result).toMatchObject({ ok: true, value: { asset: { mimeType: "image/png" } } });
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^library\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/),
      expect.any(ReadableStream),
      expect.objectContaining({ contentType: "image/png" }),
    );
  });

  it("uses one content-addressed key for identical bytes despite declared MIME relabeling", async () => {
    selectQueue.push([], []);
    mockStorageHead.mockResolvedValueOnce(err(new NotFoundError("File not found")));
    const { uploadLibraryAsset } = await setupService();
    const file = {
      name: "same-bytes.bin",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    };

    const jpegResult = await uploadLibraryAsset("creator-1", {
      ...file,
      declaredType: "image/jpeg",
    });
    const pngResult = await uploadLibraryAsset("creator-1", {
      ...file,
      declaredType: "image/png",
    });

    expect(jpegResult.ok).toBe(true);
    expect(pngResult.ok).toBe(true);
    if (!jpegResult.ok || !pngResult.ok) return;
    expect(pngResult.value.asset.storageKey).toBe(jpegResult.value.asset.storageKey);
    expect(pngResult.value.deduped).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledOnce();
  });

  it("keeps inventory when storage upload fails before registration", async () => {
    selectQueue.push([]);
    mockStorageHead.mockResolvedValueOnce(err(new NotFoundError("File not found")));
    mockStorageUpload.mockResolvedValueOnce(err(new Error("storage upload failed")));
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      declaredType: "image/png",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result).toMatchObject({ ok: false, error: { message: "storage upload failed" } });
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockInsert).toHaveBeenCalledWith(contentBlobs);
  });

  it("rejects unparseable bytes before touching storage", async () => {
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      declaredType: "image/png",
      size: 4,
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(mockStorageHead).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("propagates a non-not-found head error without uploading", async () => {
    selectQueue.push([]);
    mockStorageHead.mockResolvedValueOnce(err(new Error("backend unavailable")));
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      declaredType: "image/png",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result).toMatchObject({ ok: false, error: { message: "backend unavailable" } });
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("updates an existing live registration without a storage head", async () => {
    selectQueue.push([joined]);
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset(
      "creator-1",
      {
        declaredType: "image/jpeg",
        size: pngBytes.byteLength,
        bytes: pngBytes,
      },
      "open",
    );

    expect(result).toMatchObject({
      ok: true,
      value: { deduped: true, asset: { id: asset.id, sharing: "open" } },
    });
    expect(mockStorageHead).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("reactivates a tombstoned registration instead of conflicting", async () => {
    selectQueue.push([{ ...joined, asset: { ...asset, deletedAt: new Date() } }]);
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset(
      "creator-1",
      {
        name: "restored.png",
        declaredType: "image/png",
        size: pngBytes.byteLength,
        bytes: pngBytes,
      },
      "requestable",
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        deduped: true,
        asset: { id: asset.id, sharing: "requestable", originalFilename: "restored.png" },
      },
    });
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("records global inventory before upload so registration failure cannot orphan bytes", async () => {
    selectQueue.push([]);
    failAssetInsert = true;
    mockStorageHead.mockResolvedValueOnce(err(new NotFoundError("File not found")));
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      declaredType: "image/png",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result).toMatchObject({ ok: false, error: { message: "registration insert failed" } });
    expect(mockInsert).toHaveBeenNthCalledWith(1, contentBlobs);
    expect(mockStorageUpload).toHaveBeenCalledOnce();
    expect(mockInsert).toHaveBeenNthCalledWith(2, contentAssets);
  });
});
