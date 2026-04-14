import { describe, it, expect } from "vitest";

import type { ContentResponse } from "@snc/shared";

import {
  createContent,
  deleteContent,
  updateContent,
  uploadContentFile,
} from "../../../src/lib/content.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── Fixtures ──

const MOCK_CONTENT: ContentResponse = {
  id: "content_test_001",
  creatorId: "user-1",
  slug: "test-track",
  type: "audio",
  title: "Test Track",
  body: null,
  description: "A test audio track",
  visibility: "subscribers",
  sourceType: "upload",
  thumbnailUrl: null,
  thumbnail: null,
  mediaUrl: "/storage/media/test.mp3",
  publishedAt: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  processingStatus: null,
  videoCodec: null,
  audioCodec: null,
  width: null,
  height: null,
  duration: null,
  bitrate: null,
};

// ── createContent ──

describe("createContent", () => {
  it("posts to correct URL with body and credentials", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTENT), { status: 201 }),
    );

    const result = await createContent({
      creatorId: "test_creator",
      type: "audio",
      title: "Test Track",
      visibility: "subscribers",
      sourceType: "upload",
    });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/content",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: "test_creator",
          type: "audio",
          title: "Test Track",
          visibility: "subscribers",
          sourceType: "upload",
        }),
      },
    );
    expect(result).toEqual(MOCK_CONTENT);
  });

  it("throws on 401 response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(
      createContent({ creatorId: "test_creator", type: "audio", title: "Test", visibility: "public", sourceType: "upload" }),
    ).rejects.toThrow("Unauthorized");
  });

  it("throws on 400 validation error", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Validation failed" } }),
        { status: 400 },
      ),
    );

    await expect(
      createContent({ creatorId: "test_creator", type: "audio", title: "", visibility: "public", sourceType: "upload" }),
    ).rejects.toThrow("Validation failed");
  });
});

// ── uploadContentFile ──

describe("uploadContentFile", () => {
  it("posts FormData to correct URL for media field", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTENT), { status: 200 }),
    );

    const file = new File(["audio-data"], "track.mp3", {
      type: "audio/mpeg",
    });
    const result = await uploadContentFile("content_test_001", "media", file);

    const [url, init] = getMockFetch().mock.calls[0]!;
    expect(url).toBe("/api/content/content_test_001/upload?field=media");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect(init.headers).toBeUndefined();
    expect(result).toEqual(MOCK_CONTENT);
  });

  it("posts to correct URL for thumbnail field", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTENT), { status: 200 }),
    );

    const file = new File(["img-data"], "thumb.png", { type: "image/png" });
    await uploadContentFile("content_test_001", "thumbnail", file);

    const [url] = getMockFetch().mock.calls[0]!;
    expect(url).toBe("/api/content/content_test_001/upload?field=thumbnail");
  });


  it("throws on 413 payload too large", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "File too large" } }),
        { status: 413 },
      ),
    );

    const file = new File(["big"], "huge.mp3", { type: "audio/mpeg" });
    await expect(
      uploadContentFile("content_test_001", "media", file),
    ).rejects.toThrow("File too large");
  });

  it("throws on 401 unauthenticated", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    await expect(
      uploadContentFile("content_test_001", "media", file),
    ).rejects.toThrow("Unauthorized");
  });
});

// ── updateContent ──

describe("updateContent", () => {
  it("sends PATCH to correct URL with body and credentials", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTENT), { status: 200 }),
    );

    const result = await updateContent("content_test_001", {
      title: "Updated Title",
      visibility: "subscribers",
    });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/content/content_test_001",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
          visibility: "subscribers",
        }),
      },
    );
    expect(result).toEqual(MOCK_CONTENT);
  });

  it("encodes content ID in URL", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTENT), { status: 200 }),
    );

    await updateContent("content/with/slashes", { title: "Updated" });

    const [url] = getMockFetch().mock.calls[0]!;
    expect(url).toBe("/api/content/content%2Fwith%2Fslashes");
  });

  it("throws on 403 forbidden", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Forbidden" } }),
        { status: 403 },
      ),
    );

    await expect(
      updateContent("content_test_001", { title: "Updated" }),
    ).rejects.toThrow("Forbidden");
  });
});

// ── deleteContent ──

describe("deleteContent", () => {
  it("sends DELETE to correct URL with credentials and no body", async () => {
    getMockFetch().mockResolvedValue(new Response(null, { status: 204 }));

    await deleteContent("content_test_001");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/content/content_test_001",
      {
        method: "DELETE",
        credentials: "include",
        headers: {},
      },
    );
  });

  it("encodes content ID in URL", async () => {
    getMockFetch().mockResolvedValue(new Response(null, { status: 204 }));

    await deleteContent("content/with/slashes");

    const [url] = getMockFetch().mock.calls[0]!;
    expect(url).toBe("/api/content/content%2Fwith%2Fslashes");
  });

  it("throws on 403 forbidden", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Forbidden" } }),
        { status: 403 },
      ),
    );

    await expect(deleteContent("content_test_001")).rejects.toThrow("Forbidden");
  });

  it("throws on 404 not found", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Not found" } }),
        { status: 404 },
      ),
    );

    await expect(deleteContent("content_test_001")).rejects.toThrow("Not found");
  });
});
