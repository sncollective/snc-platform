import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchContentLibraryImages,
  uploadContentLibraryImage,
} from "../../../src/lib/content-library.js";

const response = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

afterEach(() => vi.unstubAllGlobals());

describe("content library web client", () => {
  it("uploads a private image through the content-library endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ storageKey: `library/aa/${"a".repeat(64)}.jpg` }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["bytes"], "photo.jpg", { type: "image/jpeg" });

    const result = await uploadContentLibraryImage("creator/a", file);

    expect(result.storageKey).toMatch(/^library\//);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/creators/creator%2Fa/library/assets",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const form = fetchMock.mock.calls[0]![1].body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("sharing")).toBe("private");
  });

  it("marks avatar uploads for assignment without sending sharing metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ storageKey: `library/aa/${"a".repeat(64)}.jpg` }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["bytes"], "avatar.jpg", { type: "image/jpeg" });

    await uploadContentLibraryImage("creator-1", file, "avatar");

    const form = fetchMock.mock.calls[0]![1].body as FormData;
    expect(form.get("usage")).toBe("avatar");
    expect(form.get("sharing")).toBeNull();
  });

  it("passes cursor and abort signal to library browse", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await fetchContentLibraryImages("creator-1", "date|id", controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/creators/creator-1/library/assets?before=date%7Cid",
      { credentials: "include", signal: controller.signal },
    );
  });
});
