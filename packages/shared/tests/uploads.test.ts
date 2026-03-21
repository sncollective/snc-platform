import { describe, it, expect } from "vitest";

import {
  SOURCE_TYPES,
  UPLOAD_PURPOSES,
  MULTIPART_THRESHOLD,
  SourceTypeSchema,
  UploadPurposeSchema,
  PresignRequestSchema,
  PresignResponseSchema,
  CreateMultipartRequestSchema,
  CreateMultipartResponseSchema,
  SignPartResponseSchema,
  CompletedPartSchema,
  CompleteMultipartRequestSchema,
  CompleteUploadRequestSchema,
  ListPartsResponseSchema,
  type SourceType,
  type UploadPurpose,
  type PresignRequest,
  type PresignResponse,
  type CreateMultipartRequest,
  type CreateMultipartResponse,
  type SignPartResponse,
  type CompletedPart,
  type CompleteMultipartRequest,
  type CompleteUploadRequest,
} from "../src/index.js";

// ── Constants ──

describe("SOURCE_TYPES", () => {
  it("contains upload and stream-recording", () => {
    expect(SOURCE_TYPES).toStrictEqual(["upload", "stream-recording"]);
  });
});

describe("UPLOAD_PURPOSES", () => {
  it("contains all expected purposes", () => {
    expect(UPLOAD_PURPOSES).toStrictEqual([
      "content-media",
      "content-thumbnail",
      "content-cover-art",
      "creator-avatar",
      "creator-banner",
    ]);
  });
});

describe("MULTIPART_THRESHOLD", () => {
  it("is 50MB", () => {
    expect(MULTIPART_THRESHOLD).toBe(50 * 1024 * 1024);
  });
});

// ── Schemas ──

describe("SourceTypeSchema", () => {
  it('accepts "upload"', () => {
    expect(SourceTypeSchema.parse("upload")).toBe("upload");
  });

  it('accepts "stream-recording"', () => {
    expect(SourceTypeSchema.parse("stream-recording")).toBe("stream-recording");
  });

  it("rejects unknown values", () => {
    expect(() => SourceTypeSchema.parse("other")).toThrow();
  });
});

describe("UploadPurposeSchema", () => {
  it.each(UPLOAD_PURPOSES)('accepts "%s"', (purpose) => {
    expect(UploadPurposeSchema.parse(purpose)).toBe(purpose);
  });

  it("rejects unknown purpose", () => {
    expect(() => UploadPurposeSchema.parse("unknown-purpose")).toThrow();
  });
});

describe("PresignRequestSchema", () => {
  const valid = {
    purpose: "content-media",
    resourceId: "content-abc",
    filename: "video.mp4",
    contentType: "video/mp4",
    size: 1024,
  };

  it("parses valid input", () => {
    expect(PresignRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing purpose", () => {
    const { purpose: _, ...rest } = valid;
    expect(() => PresignRequestSchema.parse(rest)).toThrow();
  });

  it("rejects empty resourceId", () => {
    expect(() => PresignRequestSchema.parse({ ...valid, resourceId: "" })).toThrow();
  });

  it("rejects filename longer than 255 chars", () => {
    expect(() =>
      PresignRequestSchema.parse({ ...valid, filename: "a".repeat(256) }),
    ).toThrow();
  });

  it("rejects negative size", () => {
    expect(() => PresignRequestSchema.parse({ ...valid, size: -1 })).toThrow();
  });

  it("rejects zero size", () => {
    expect(() => PresignRequestSchema.parse({ ...valid, size: 0 })).toThrow();
  });
});

describe("PresignResponseSchema", () => {
  const valid = {
    url: "https://example.com/presigned",
    key: "content/abc/media/video.mp4",
    method: "PUT" as const,
  };

  it("parses valid response", () => {
    expect(PresignResponseSchema.parse(valid)).toEqual(valid);
  });

  it("rejects method other than PUT", () => {
    expect(() => PresignResponseSchema.parse({ ...valid, method: "POST" })).toThrow();
  });
});

describe("CreateMultipartRequestSchema", () => {
  const valid = {
    purpose: "content-media",
    resourceId: "content-abc",
    filename: "big-video.mp4",
    contentType: "video/mp4",
    size: 100 * 1024 * 1024,
  };

  it("parses valid input", () => {
    expect(CreateMultipartRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing fields", () => {
    expect(() => CreateMultipartRequestSchema.parse({})).toThrow();
  });
});

describe("CreateMultipartResponseSchema", () => {
  it("parses valid response", () => {
    const valid = { uploadId: "upload-id-123", key: "content/abc/media/video.mp4" };
    expect(CreateMultipartResponseSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing uploadId", () => {
    expect(() =>
      CreateMultipartResponseSchema.parse({ key: "content/abc/media/video.mp4" }),
    ).toThrow();
  });
});

describe("SignPartResponseSchema", () => {
  it("parses valid response", () => {
    const valid = { url: "https://example.com/part-presigned" };
    expect(SignPartResponseSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing url", () => {
    expect(() => SignPartResponseSchema.parse({})).toThrow();
  });
});

describe("CompletedPartSchema", () => {
  const valid = { PartNumber: 1, ETag: '"abc123"' };

  it("parses valid completed part", () => {
    expect(CompletedPartSchema.parse(valid)).toEqual(valid);
  });

  it("rejects zero PartNumber", () => {
    expect(() => CompletedPartSchema.parse({ ...valid, PartNumber: 0 })).toThrow();
  });

  it("rejects empty ETag", () => {
    expect(() => CompletedPartSchema.parse({ ...valid, ETag: "" })).toThrow();
  });
});

describe("CompleteMultipartRequestSchema", () => {
  const valid = {
    key: "content/abc/media/video.mp4",
    parts: [{ PartNumber: 1, ETag: '"abc123"' }],
  };

  it("parses valid input", () => {
    expect(CompleteMultipartRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects empty parts array", () => {
    expect(() =>
      CompleteMultipartRequestSchema.parse({ ...valid, parts: [] }),
    ).toThrow();
  });

  it("rejects empty key", () => {
    expect(() =>
      CompleteMultipartRequestSchema.parse({ ...valid, key: "" }),
    ).toThrow();
  });
});

describe("CompleteUploadRequestSchema", () => {
  const valid = {
    key: "content/abc/media/video.mp4",
    purpose: "content-media",
    resourceId: "content-abc",
  };

  it("parses valid input", () => {
    expect(CompleteUploadRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects empty key", () => {
    expect(() =>
      CompleteUploadRequestSchema.parse({ ...valid, key: "" }),
    ).toThrow();
  });

  it("rejects invalid purpose", () => {
    expect(() =>
      CompleteUploadRequestSchema.parse({ ...valid, purpose: "not-a-purpose" }),
    ).toThrow();
  });
});

describe("ListPartsResponseSchema", () => {
  it("parses empty array", () => {
    expect(ListPartsResponseSchema.parse([])).toEqual([]);
  });

  it("parses valid parts list", () => {
    const valid = [{ PartNumber: 1, Size: 5242880, ETag: '"abc123"' }];
    expect(ListPartsResponseSchema.parse(valid)).toEqual(valid);
  });
});

// ── Type exports ──

describe("type exports", () => {
  it("SourceType can be used as a type", () => {
    const st: SourceType = "upload";
    expect(st).toBe("upload");
  });

  it("UploadPurpose can be used as a type", () => {
    const up: UploadPurpose = "content-media";
    expect(up).toBe("content-media");
  });

  it("PresignRequest type is correctly inferred", () => {
    const req: PresignRequest = {
      purpose: "content-media",
      resourceId: "abc",
      filename: "file.mp4",
      contentType: "video/mp4",
      size: 1024,
    };
    expect(req.purpose).toBe("content-media");
  });

  it("PresignResponse type is correctly inferred", () => {
    const res: PresignResponse = {
      url: "https://example.com/presigned",
      key: "content/abc/media/file.mp4",
      method: "PUT",
    };
    expect(res.method).toBe("PUT");
  });

  it("CreateMultipartRequest type is correctly inferred", () => {
    const req: CreateMultipartRequest = {
      purpose: "content-media",
      resourceId: "abc",
      filename: "file.mp4",
      contentType: "video/mp4",
      size: 1024,
    };
    expect(req.purpose).toBe("content-media");
  });

  it("CreateMultipartResponse type is correctly inferred", () => {
    const res: CreateMultipartResponse = { uploadId: "id-123", key: "key" };
    expect(res.uploadId).toBe("id-123");
  });

  it("SignPartResponse type is correctly inferred", () => {
    const res: SignPartResponse = { url: "https://example.com" };
    expect(res.url).toBe("https://example.com");
  });

  it("CompletedPart type is correctly inferred", () => {
    const part: CompletedPart = { PartNumber: 1, ETag: '"abc"' };
    expect(part.PartNumber).toBe(1);
  });

  it("CompleteMultipartRequest type is correctly inferred", () => {
    const req: CompleteMultipartRequest = {
      key: "some/key",
      parts: [{ PartNumber: 1, ETag: '"abc"' }],
    };
    expect(req.parts).toHaveLength(1);
  });

  it("CompleteUploadRequest type is correctly inferred", () => {
    const req: CompleteUploadRequest = {
      key: "some/key",
      purpose: "content-media",
      resourceId: "abc",
    };
    expect(req.resourceId).toBe("abc");
  });
});
