import { describe, it, expect } from "vitest";

import {
  fetchChannelQueue,
  insertQueueItem,
  removeQueueItem,
  skipChannelTrack,
  fetchChannelContent,
  searchAvailableContent,
  assignChannelContent,
  removeChannelContent,
} from "../../../src/lib/creator-playout-channels.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

function okJson(body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

// The load-bearing assertion: every creator fetcher targets the creator-scoped base
// path (`/api/creator/playout/*`), never the admin `/api/playout/*` routes. A creator
// hitting an admin route gets a 403 — these tests guard against that regression.

describe("creator-playout-channels — base path", () => {
  it("fetchChannelQueue hits the creator queue route", async () => {
    getMockFetch().mockResolvedValue(okJson({ upcoming: [] }));
    await fetchChannelQueue("ch_1");
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/queue",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("insertQueueItem POSTs a playout source to the creator queue/items route", async () => {
    getMockFetch().mockResolvedValue(okJson());
    await insertQueueItem("ch_1", { playoutItemId: "item_9" }, 1);
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/queue/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ playoutItemId: "item_9", position: 1 }),
      }),
    );
  });

  it("insertQueueItem POSTs a content source so a creator can queue their own content", async () => {
    getMockFetch().mockResolvedValue(okJson());
    await insertQueueItem("ch_1", { contentId: "content_9" });
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/queue/items",
      expect.objectContaining({
        method: "POST",
        // position omitted = end of queue; the source carries only contentId.
        body: JSON.stringify({ contentId: "content_9" }),
      }),
    );
  });

  it("removeQueueItem DELETEs the creator queue entry", async () => {
    getMockFetch().mockResolvedValue(new Response(null, { status: 204 }));
    await removeQueueItem("ch_1", "entry_3");
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/queue/items/entry_3",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("skipChannelTrack POSTs to the creator skip route", async () => {
    getMockFetch().mockResolvedValue(okJson());
    await skipChannelTrack("ch_1");
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/skip",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fetchChannelContent hits the creator content route", async () => {
    getMockFetch().mockResolvedValue(okJson({ items: [] }));
    await fetchChannelContent("ch_1");
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/content",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("searchAvailableContent hits the creator content/search route with the query", async () => {
    getMockFetch().mockResolvedValue(okJson({ items: [] }));
    await searchAvailableContent("ch_1", "nosferatu");
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/content/search?q=nosferatu",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("assignChannelContent POSTs to the creator content route", async () => {
    getMockFetch().mockResolvedValue(okJson());
    await assignChannelContent("ch_1", ["item_5"]);
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/content",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ playoutItemIds: ["item_5"], contentIds: undefined }),
      }),
    );
  });

  it("removeChannelContent DELETEs against the creator content route", async () => {
    getMockFetch().mockResolvedValue(okJson());
    await removeChannelContent("ch_1", undefined, ["content_2"]);
    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creator/playout/channels/ch_1/content",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ playoutItemIds: undefined, contentIds: ["content_2"] }),
      }),
    );
  });
});
