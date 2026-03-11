import { describe, it, expect, afterEach, vi } from "vitest";
import { makeTestConfig } from "../helpers/test-constants.js";

// ── Tests ──

describe("createStorageProvider", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("returns a StorageProvider for STORAGE_TYPE 'local'", async () => {
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
  });

  it("storage singleton is exported and has StorageProvider methods", async () => {
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
  });
});
