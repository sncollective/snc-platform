import { describe, expect, it } from "vitest";

import {
  ContentAssetSchema,
  isLibraryAssetKey,
  libraryRawPath,
} from "../src/content-library.js";

const hash = "a".repeat(64);
const key = `library/aa/${hash}.png`;

const asset = {
  id: "00000000-0000-4000-a000-000000000001",
  creatorId: "creator-1",
  blobSha256: hash,
  sharing: "requestable",
  originalFilename: "image.png",
  createdAt: "2026-01-01T00:00:00.000Z",
  storageKey: key,
  mimeType: "image/png",
  size: 12,
  width: 1,
  height: 1,
  canUse: false,
  useStatus: "requestable-needs-grant",
};

describe("content library shared contract", () => {
  it("recognizes only canonical content-addressed keys", () => {
    expect(isLibraryAssetKey(key)).toBe(true);
    expect(isLibraryAssetKey(`creators/creator-1/press/${hash}.png`)).toBe(false);
    expect(isLibraryAssetKey(`library/aa/${hash.toUpperCase()}.png`)).toBe(false);
    expect(isLibraryAssetKey(`library/a/${hash}.png`)).toBe(false);
    expect(libraryRawPath(key)).toBe(`aa/${hash}.png`);
    expect(libraryRawPath("not-a-library-key")).toBe("");
  });

  it("enforces blob, sharing, use-status, key, and MIME constraints", () => {
    expect(ContentAssetSchema.parse(asset)).toEqual(asset);
    expect(() => ContentAssetSchema.parse({ ...asset, id: "not-a-uuid" })).toThrow();
    expect(() => ContentAssetSchema.parse({ ...asset, blobSha256: "bad" })).toThrow();
    expect(() => ContentAssetSchema.parse({ ...asset, sharing: "public" })).toThrow();
    expect(() => ContentAssetSchema.parse({ ...asset, storageKey: "content/file.png" })).toThrow();
    expect(() => ContentAssetSchema.parse({ ...asset, mimeType: "image/gif" })).toThrow();
    expect(() => ContentAssetSchema.parse({ ...asset, useStatus: "pending" })).toThrow();
  });
});
