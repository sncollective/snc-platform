import { describe, it, expect, afterEach, vi } from "vitest";
import { makeTestConfig } from "../helpers/test-constants.js";

// ── Tests ──

describe("createStorageProvider", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("returns a StorageProvider for STORAGE_TYPE 'local'", async () => {
    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("../../src/config.js", () => ({
      config: {
        STORAGE_TYPE: "local",
        STORAGE_LOCAL_DIR: "/tmp/snc-test-factory",
      },
    }));

    const { createStorageProvider } = await import(
      "../../src/storage/index.js"
    );

    const provider = createStorageProvider(
      makeTestConfig({ STORAGE_LOCAL_DIR: "/tmp/snc-test-factory" }),
    );

    expect(provider).toBeDefined();
    expect(provider.upload).toBeTypeOf("function");
    expect(provider.download).toBeTypeOf("function");
    expect(provider.delete).toBeTypeOf("function");
    expect(provider.getSignedUrl).toBeTypeOf("function");
    expect(provider.head).toBeTypeOf("function");
    expect(provider.getPresignedUploadUrl).toBeTypeOf("function");
  });

  it("storage singleton is exported and has StorageProvider methods", async () => {
    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("../../src/config.js", () => ({
      config: {
        STORAGE_TYPE: "local",
        STORAGE_LOCAL_DIR: "/tmp/snc-test-singleton",
      },
    }));

    const { storage } = await import("../../src/storage/index.js");

    expect(storage).toBeDefined();
    expect(storage.upload).toBeTypeOf("function");
    expect(storage.download).toBeTypeOf("function");
    expect(storage.delete).toBeTypeOf("function");
    expect(storage.getSignedUrl).toBeTypeOf("function");
    expect(storage.head).toBeTypeOf("function");
    expect(storage.getPresignedUploadUrl).toBeTypeOf("function");
  });

  it("s3Multipart is null when STORAGE_TYPE is 'local'", async () => {
    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("../../src/config.js", () => ({
      config: {
        STORAGE_TYPE: "local",
        STORAGE_LOCAL_DIR: "/tmp/snc-test-multipart",
      },
    }));

    const { s3Multipart } = await import("../../src/storage/index.js");

    expect(s3Multipart).toBeNull();
  });

  it("returns S3 provider when STORAGE_TYPE is 's3'", async () => {
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: function MockS3Client() { return { send: vi.fn() }; },
      PutObjectCommand: vi.fn(),
      GetObjectCommand: vi.fn(),
      DeleteObjectCommand: vi.fn(),
      HeadObjectCommand: vi.fn(),
    }));

    vi.doMock("../../src/config.js", () => ({
      config: makeTestConfig({
        STORAGE_TYPE: "s3",
        S3_ENDPOINT: "https://s3.example.com",
        S3_BUCKET: "test-bucket",
        S3_ACCESS_KEY_ID: "test-key-id",
        S3_SECRET_ACCESS_KEY: "test-secret-key",
        S3_REGION: "garage",
      }),
    }));

    const { createStorageProvider } = await import("../../src/storage/index.js");

    const provider = createStorageProvider(
      makeTestConfig({
        STORAGE_TYPE: "s3",
        S3_ENDPOINT: "https://s3.example.com",
        S3_BUCKET: "test-bucket",
        S3_ACCESS_KEY_ID: "test-key-id",
        S3_SECRET_ACCESS_KEY: "test-secret-key",
      }),
    );

    expect(provider).toBeDefined();
    expect(provider.upload).toBeTypeOf("function");
    expect(provider.head).toBeTypeOf("function");
    expect(provider.getPresignedUploadUrl).toBeTypeOf("function");
  });

  it("returns multipart service when STORAGE_TYPE is 's3'", async () => {
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: function MockS3Client() { return { send: vi.fn() }; },
      PutObjectCommand: vi.fn(),
      GetObjectCommand: vi.fn(),
      DeleteObjectCommand: vi.fn(),
      HeadObjectCommand: vi.fn(),
    }));

    vi.doMock("../../src/config.js", () => ({
      config: makeTestConfig({
        STORAGE_TYPE: "s3",
        S3_ENDPOINT: "https://s3.example.com",
        S3_BUCKET: "test-bucket",
        S3_ACCESS_KEY_ID: "test-key-id",
        S3_SECRET_ACCESS_KEY: "test-secret-key",
        S3_REGION: "garage",
      }),
    }));

    const { s3Multipart } = await import("../../src/storage/index.js");

    expect(s3Multipart).not.toBeNull();
    if (s3Multipart) {
      expect(s3Multipart.createMultipartUpload).toBeTypeOf("function");
      expect(s3Multipart.signPart).toBeTypeOf("function");
      expect(s3Multipart.completeMultipartUpload).toBeTypeOf("function");
      expect(s3Multipart.abortMultipartUpload).toBeTypeOf("function");
      expect(s3Multipart.listParts).toBeTypeOf("function");
    }
  });

  it("throws on missing S3 env vars when STORAGE_TYPE is 's3'", async () => {
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: function MockS3Client() { return { send: vi.fn() }; },
    }));

    vi.doMock("../../src/config.js", () => ({
      config: makeTestConfig({
        STORAGE_TYPE: "s3",
        // Missing S3_ENDPOINT, S3_BUCKET, etc.
        S3_ENDPOINT: undefined,
        S3_BUCKET: undefined,
        S3_ACCESS_KEY_ID: undefined,
        S3_SECRET_ACCESS_KEY: undefined,
      }),
    }));

    // The module-level singleton initialization throws when imported with
    // STORAGE_TYPE: "s3" but missing required env vars.
    await expect(import("../../src/storage/index.js")).rejects.toThrow(
      "S3 storage requires",
    );
  });
});
