import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { err, NotFoundError, ok } from "@snc/shared";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockStorageHead = vi.fn();
const mockStorageUpload = vi.fn();

const contentAssets = {
  ownerCreatorId: "ownerCreatorId",
  sha256: "sha256",
  storageKey: "storageKey",
  deletedAt: "deletedAt",
};
const mockDb = { select: mockSelect, insert: mockInsert };

const pngBytes = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

const row = {
  id: "00000000-0000-4000-a000-000000000001",
  ownerCreatorId: "creator-1",
  sha256: "a".repeat(64),
  storageKey: `library/aa/${"a".repeat(64)}.png`,
  mimeType: "image/png",
  size: pngBytes.byteLength,
  width: 1,
  height: 1,
  originalFilename: "image.png",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
};

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/library.schema.js", () => ({ contentAssets }));
  vi.doMock("../../src/storage/index.js", () => ({
    storage: { head: mockStorageHead, upload: mockStorageUpload },
  }));
  return import("../../src/services/library.js");
};

const selectResult = (rows: unknown[]) => {
  mockSelect.mockReturnValueOnce({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  mockStorageHead.mockResolvedValue(ok({ size: 0, contentType: "image/png" }));
  mockStorageUpload.mockResolvedValue(ok({ key: row.storageKey, size: pngBytes.byteLength }));
  mockInsert.mockReturnValue({
    values: () => ({
      onConflictDoNothing: () => ({ returning: () => Promise.resolve([row]) }),
    }),
  });
});

afterEach(() => {
  vi.resetModules();
});

describe("library service upload deduplication", () => {
  it("detects bytes rather than trusting a relabeled client MIME", async () => {
    selectResult([]);
    mockStorageHead.mockResolvedValueOnce(err(new NotFoundError("File not found")));
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      name: "relabeled.png",
      declaredType: "image/jpeg",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result).toMatchObject({ ok: true, value: { asset: { storageKey: row.storageKey } } });
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^library\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/),
      expect.any(ReadableStream),
      expect.objectContaining({ contentType: "image/png" }),
    );
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
    selectResult([]);
    mockStorageHead.mockResolvedValueOnce(err(new Error("backend unavailable")));
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      declaredType: "image/png",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result).toMatchObject({ ok: false, error: { message: "backend unavailable" } });
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("returns an existing same-creator registration without a storage head", async () => {
    selectResult([row]);
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      declaredType: "image/jpeg",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result).toMatchObject({ ok: true, value: { deduped: true, asset: { id: row.id } } });
    expect(mockStorageHead).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("recognizes the normalized adapter not-found error as an absent blob", async () => {
    selectResult([]);
    mockStorageHead.mockResolvedValueOnce(err(new NotFoundError("File not found")));
    const { uploadLibraryAsset } = await setupService();

    const result = await uploadLibraryAsset("creator-1", {
      declaredType: "image/png",
      size: pngBytes.byteLength,
      bytes: pngBytes,
    });

    expect(result.ok).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledOnce();
  });
});
