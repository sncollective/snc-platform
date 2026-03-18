import { describe, it, expect } from "vitest";

import type { ContentResponse } from "@snc/shared";

import {
  createContent,
  uploadContentFile,
} from "../../../src/lib/content.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── Fixtures ──

const MOCK_CONTENT: ContentResponse = {
  id: "content_test_001",
  creatorId: "user-1",
  type: "audio",
  title: "Test Track",
  body: null,
  description: "A test audio track",
  visibility: "subscribers",
  thumbnailUrl: null,
  mediaUrl: "/storage/media/test.mp3",
  coverArtUrl: null,
  publishedAt: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
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
      createContent({ creatorId: "test_creator", type: "audio", title: "Test", visibility: "public" }),
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
      createContent({ creatorId: "test_creator", type: "audio", title: "", visibility: "public" }),
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

  it("posts to correct URL for coverArt field", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTENT), { status: 200 }),
    );

    const file = new File(["img-data"], "cover.jpg", { type: "image/jpeg" });
    await uploadContentFile("content_test_001", "coverArt", file);

    const [url] = getMockFetch().mock.calls[0]!;
    expect(url).toBe("/api/content/content_test_001/upload?field=coverArt");
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
