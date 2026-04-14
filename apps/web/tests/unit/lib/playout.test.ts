import { describe, it, expect } from "vitest";
import type { PlayoutItem, PlayoutItemListResponse, PlayoutStatus } from "@snc/shared";

import {
  fetchPlayoutItems,
  fetchPlayoutItem,
  createPlayoutItem,
  updatePlayoutItem,
  deletePlayoutItem,
  reorderPlayoutItems,
  fetchPlayoutStatus,
  skipPlayoutTrack,
  queuePlayoutItem,
  retryPlayoutIngest,
} from "../../../src/lib/playout.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Fixtures ──

function makeMockPlayoutItem(
  overrides?: Partial<PlayoutItem>,
): PlayoutItem {
  return {
    id: "item_001",
    title: "Test Film",
    year: 2024,
    director: "Jane Director",
    duration: 5400,
    sourceWidth: 1920,
    sourceHeight: 1080,
    processingStatus: "ready",
    position: 0,
    enabled: true,
    renditions: {
      source: true,
      "1080p": true,
      "720p": true,
      "480p": true,
      audio: true,
    },
    hasSubtitles: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMockPlayoutStatus(
  overrides?: Partial<PlayoutStatus>,
): PlayoutStatus {
  return {
    nowPlaying: {
      itemId: "item_001",
      title: "Test Film",
      year: 2024,
      director: "Jane Director",
      duration: 5400,
      elapsed: 120,
      remaining: 5280,
    },
    queuedItems: [],
    ...overrides,
  };
}

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── fetchPlayoutItems ──

describe("fetchPlayoutItems", () => {
  it("GETs /api/playout/items and returns the response", async () => {
    const item = makeMockPlayoutItem();
    const body: PlayoutItemListResponse = { items: [item] };
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    );

    const result = await fetchPlayoutItems();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/items",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result).toEqual(body);
  });
});

// ── fetchPlayoutItem ──

describe("fetchPlayoutItem", () => {
  it("GETs /api/playout/items/:id and returns the item", async () => {
    const item = makeMockPlayoutItem({ id: "item_abc" });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(item), { status: 200 }),
    );

    const result = await fetchPlayoutItem("item_abc");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/items/item_abc",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result).toEqual(item);
  });

  it("encodes special characters in ID", async () => {
    const item = makeMockPlayoutItem();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(item), { status: 200 }),
    );

    await fetchPlayoutItem("item/special id");

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("item%2Fspecial%20id");
  });
});

// ── createPlayoutItem ──

describe("createPlayoutItem", () => {
  it("POSTs to /api/playout/items with the item data", async () => {
    const item = makeMockPlayoutItem();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(item), { status: 201 }),
    );

    const result = await createPlayoutItem({
      title: "Test Film",
      year: 2024,
      director: "Jane Director",
    });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/items",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ title: "Test Film", year: 2024, director: "Jane Director" }),
      }),
    );
    expect(result).toEqual(item);
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Validation failed" } }),
        { status: 422 },
      ),
    );

    await expect(
      createPlayoutItem({ title: "" }),
    ).rejects.toThrow("Validation failed");
  });
});

// ── updatePlayoutItem ──

describe("updatePlayoutItem", () => {
  it("PATCHes /api/playout/items/:id with update data", async () => {
    const item = makeMockPlayoutItem({ title: "Updated" });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(item), { status: 200 }),
    );

    const result = await updatePlayoutItem("item_001", { title: "Updated" });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/items/item_001",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ title: "Updated" }),
      }),
    );
    expect(result).toEqual(item);
  });
});

// ── deletePlayoutItem ──

describe("deletePlayoutItem", () => {
  it("DELETEs /api/playout/items/:id", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await deletePlayoutItem("item_001");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/items/item_001",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("encodes special characters in ID", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await deletePlayoutItem("item/x y");

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("item%2Fx%20y");
  });
});

// ── reorderPlayoutItems ──

describe("reorderPlayoutItems", () => {
  it("PUTs to /api/playout/items/reorder with ordered IDs", async () => {
    const body: PlayoutItemListResponse = { items: [] };
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    );

    const result = await reorderPlayoutItems(["item_002", "item_001"]);

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/items/reorder",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ orderedIds: ["item_002", "item_001"] }),
      }),
    );
    expect(result).toEqual(body);
  });
});

// ── fetchPlayoutStatus ──

describe("fetchPlayoutStatus", () => {
  it("GETs /api/playout/status and returns status", async () => {
    const status = makeMockPlayoutStatus();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(status), { status: 200 }),
    );

    const result = await fetchPlayoutStatus();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/status",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result).toEqual(status);
  });

  it("returns null nowPlaying when nothing is playing", async () => {
    const status = makeMockPlayoutStatus({ nowPlaying: null });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(status), { status: 200 }),
    );

    const result = await fetchPlayoutStatus();
    expect(result.nowPlaying).toBeNull();
  });
});

// ── skipPlayoutTrack ──

describe("skipPlayoutTrack", () => {
  it("POSTs to /api/playout/skip", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await skipPlayoutTrack();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/skip",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});

// ── queuePlayoutItem ──

describe("queuePlayoutItem", () => {
  it("POSTs to /api/playout/queue/:id", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await queuePlayoutItem("item_001");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/queue/item_001",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("encodes special characters in ID", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await queuePlayoutItem("item/x y");

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("item%2Fx%20y");
  });
});

// ── retryPlayoutIngest ──

describe("retryPlayoutIngest", () => {
  it("POSTs to /api/playout/items/:id/retry", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await retryPlayoutIngest("item_001");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/playout/items/item_001/retry",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("encodes special characters in ID", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await retryPlayoutIngest("item/x y");

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("item%2Fx%20y");
  });

  it("throws on non-2xx response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Item is not in failed state" } }),
        { status: 409 },
      ),
    );

    await expect(retryPlayoutIngest("item_001")).rejects.toThrow(
      "Item is not in failed state",
    );
  });
});
