import { describe, it, expect } from "vitest";

import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
  type StorageProvider,
  type UploadMetadata,
  type UploadResult,
} from "../src/index.js";

// ── Tests ──

describe("ACCEPTED_MIME_TYPES", () => {
  it("video contains exactly the three accepted formats", () => {
    expect(ACCEPTED_MIME_TYPES.video).toStrictEqual([
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ]);
  });

  it("audio contains exactly the five accepted formats", () => {
    expect(ACCEPTED_MIME_TYPES.audio).toStrictEqual([
      "audio/mpeg",
      "audio/wav",
      "audio/flac",
      "audio/ogg",
      "audio/aac",
    ]);
  });

  it("image contains exactly the three accepted formats", () => {
    expect(ACCEPTED_MIME_TYPES.image).toStrictEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });

  it("has exactly three categories", () => {
    expect(Object.keys(ACCEPTED_MIME_TYPES)).toStrictEqual([
      "video",
      "audio",
      "image",
    ]);
  });
});

describe("MAX_FILE_SIZES", () => {
  it("video is 20 GB", () => {
    expect(MAX_FILE_SIZES.video).toBe(20 * 1024 * 1024 * 1024);
  });

  it("audio is 100 MB", () => {
    expect(MAX_FILE_SIZES.audio).toBe(100 * 1024 * 1024);
  });

  it("image is 10 MB", () => {
    expect(MAX_FILE_SIZES.image).toBe(10 * 1024 * 1024);
  });

  it("has exactly three categories", () => {
    expect(Object.keys(MAX_FILE_SIZES)).toStrictEqual([
      "video",
      "audio",
      "image",
    ]);
  });
});

// ── Type-level assertions (compile-time only) ──

const _uploadMetadataCheck: UploadMetadata = {};
const _uploadMetadataFullCheck: UploadMetadata = {
  contentType: "video/mp4",
  contentLength: 1024,
};
const _uploadResultCheck: UploadResult = { key: "test/file.txt", size: 1024 };

// Verify StorageProvider is a valid type by declaring a variable
// (not instantiating — it is an interface-like object type)
declare const _providerCheck: StorageProvider;
