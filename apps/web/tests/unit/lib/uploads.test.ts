import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted Mocks ──

const { mockApiGet, mockApiMutate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiMutate: vi.fn(),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiGet: mockApiGet,
  apiMutate: mockApiMutate,
}));

// ── Import module under test (after mocks) ──

import {
  presignUpload,
  createMultipartUpload,
  signPart,
  completeMultipartUpload,
  abortMultipartUpload,
  listParts,
  completeUpload,
  retryWithBackoff,
} from "../../../src/lib/uploads.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiMutate.mockReset();
});

// ── presignUpload ──

describe("presignUpload", () => {
  it("calls POST /api/uploads/presign with the request body", async () => {
    const response = { url: "https://s3.example.com/upload", key: "uploads/file.jpg", method: "PUT" as const };
    mockApiMutate.mockResolvedValue(response);

    const request = {
      purpose: "content-media" as const,
      resourceId: "res_123",
      filename: "video.mp4",
      contentType: "video/mp4",
      size: 1024,
    };
    const result = await presignUpload(request);

    expect(mockApiMutate).toHaveBeenCalledWith("/api/uploads/presign", {
      body: request,
    });
    expect(result).toEqual(response);
  });
});

// ── createMultipartUpload ──

describe("createMultipartUpload", () => {
  it("calls POST /api/uploads/s3/multipart with the request body", async () => {
    const response = { uploadId: "mpu_abc123", key: "uploads/large.mp4" };
    mockApiMutate.mockResolvedValue(response);

    const request = {
      purpose: "content-media" as const,
      resourceId: "res_123",
      filename: "large.mp4",
      contentType: "video/mp4",
      size: 100 * 1024 * 1024,
    };
    const result = await createMultipartUpload(request);

    expect(mockApiMutate).toHaveBeenCalledWith("/api/uploads/s3/multipart", {
      body: request,
    });
    expect(result).toEqual(response);
  });
});

// ── signPart ──

describe("signPart", () => {
  it("calls GET /api/uploads/s3/multipart/:uploadId/:partNumber with key as query param", async () => {
    const response = { url: "https://s3.example.com/part1-presigned" };
    mockApiGet.mockResolvedValue(response);

    const result = await signPart("mpu_abc123", 1, "uploads/large.mp4");

    expect(mockApiGet).toHaveBeenCalledWith(
      "/api/uploads/s3/multipart/mpu_abc123/1",
      { key: "uploads/large.mp4" },
    );
    expect(result).toEqual(response);
  });

  it("uses the correct part number in the URL", async () => {
    mockApiGet.mockResolvedValue({ url: "https://s3.example.com/part5-presigned" });

    await signPart("mpu_abc123", 5, "uploads/large.mp4");

    expect(mockApiGet).toHaveBeenCalledWith(
      "/api/uploads/s3/multipart/mpu_abc123/5",
      { key: "uploads/large.mp4" },
    );
  });
});

// ── completeMultipartUpload ──

describe("completeMultipartUpload", () => {
  it("calls POST /api/uploads/s3/multipart/:uploadId/complete with key and parts", async () => {
    mockApiMutate.mockResolvedValue(undefined);

    const parts = [
      { PartNumber: 1, ETag: "etag1" },
      { PartNumber: 2, ETag: "etag2" },
    ];
    await completeMultipartUpload("mpu_abc123", "uploads/large.mp4", parts);

    expect(mockApiMutate).toHaveBeenCalledWith(
      "/api/uploads/s3/multipart/mpu_abc123/complete",
      {
        body: { key: "uploads/large.mp4", parts },
      },
    );
  });
});

// ── abortMultipartUpload ──

describe("abortMultipartUpload", () => {
  it("calls DELETE /api/uploads/s3/multipart/:uploadId with key as query param", async () => {
    mockApiMutate.mockResolvedValue(undefined);

    await abortMultipartUpload("mpu_abc123", "uploads/large.mp4");

    expect(mockApiMutate).toHaveBeenCalledWith(
      "/api/uploads/s3/multipart/mpu_abc123?key=uploads%2Flarge.mp4",
      { method: "DELETE" },
    );
  });

  it("URL-encodes special characters in the key", async () => {
    mockApiMutate.mockResolvedValue(undefined);

    await abortMultipartUpload("mpu_abc123", "uploads/path with spaces/file.mp4");

    const calledUrl = mockApiMutate.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("key=uploads%2Fpath%20with%20spaces%2Ffile.mp4");
  });
});

// ── listParts ──

describe("listParts", () => {
  it("calls GET /api/uploads/s3/multipart/:uploadId with key as query param", async () => {
    const parts = [{ PartNumber: 1, Size: 5242880, ETag: "etag1" }];
    mockApiGet.mockResolvedValue(parts);

    const result = await listParts("mpu_abc123", "uploads/large.mp4");

    expect(mockApiGet).toHaveBeenCalledWith(
      "/api/uploads/s3/multipart/mpu_abc123",
      { key: "uploads/large.mp4" },
    );
    expect(result).toEqual(parts);
  });
});

// ── completeUpload ──

describe("completeUpload", () => {
  it("calls POST /api/uploads/complete with the request body", async () => {
    mockApiMutate.mockResolvedValue(undefined);

    const request = {
      key: "uploads/file.mp4",
      purpose: "content-media" as const,
      resourceId: "res_123",
    };
    await completeUpload(request);

    expect(mockApiMutate).toHaveBeenCalledWith("/api/uploads/complete", {
      body: request,
    });
  });
});

// ── retryWithBackoff ──

describe("retryWithBackoff", () => {
  it("returns result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await retryWithBackoff(fn, 3);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and returns result on subsequent success", async () => {
    // Replace setTimeout so retries resolve immediately without waiting
    const originalSetTimeout = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", (fn: () => void) => {
      Promise.resolve().then(fn);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    try {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("transient error"))
        .mockResolvedValue("success after retry");

      const result = await retryWithBackoff(fn, 3);

      expect(result).toBe("success after retry");
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.stubGlobal("setTimeout", originalSetTimeout);
    }
  });

  it("throws the last error after exhausting all attempts", async () => {
    // Replace setTimeout so retries resolve immediately without waiting
    const originalSetTimeout = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", (fn: () => void) => {
      Promise.resolve().then(fn);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    try {
      const fn = vi.fn().mockRejectedValue(new Error("persistent error"));

      await expect(retryWithBackoff(fn, 3)).rejects.toThrow("persistent error");
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      vi.stubGlobal("setTimeout", originalSetTimeout);
    }
  });

  it("does not retry when maxAttempts is 1", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("immediate failure"));

    await expect(retryWithBackoff(fn, 1)).rejects.toThrow("immediate failure");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
