import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  fetchRevenue,
  fetchSubscribers,
  fetchBookingSummary,
  fetchPendingBookings,
  reviewBooking,
} from "../../../src/lib/dashboard.js";
import {
  makeMockRevenueResponse,
  makeMockSubscriberSummary,
  makeMockBookingSummary,
  makeMockPendingBookingItem,
} from "../../helpers/dashboard-fixtures.js";
import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";

// ── Test Lifecycle ──

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── fetchRevenue ──

describe("fetchRevenue", () => {
  it("fetches from correct URL with credentials", async () => {
    const revenue = makeMockRevenueResponse();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(revenue), { status: 200 }),
    );

    const result = await fetchRevenue();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dashboard/revenue",
      { credentials: "include" },
    );
    expect(result).toEqual(revenue);
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Forbidden" } }),
        { status: 403 },
      ),
    );

    await expect(fetchRevenue()).rejects.toThrow("Forbidden");
  });
});

// ── fetchSubscribers ──

describe("fetchSubscribers", () => {
  it("fetches from correct URL with credentials", async () => {
    const subscribers = makeMockSubscriberSummary();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(subscribers), { status: 200 }),
    );

    const result = await fetchSubscribers();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dashboard/subscribers",
      { credentials: "include" },
    );
    expect(result).toEqual(subscribers);
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Forbidden" } }),
        { status: 403 },
      ),
    );

    await expect(fetchSubscribers()).rejects.toThrow("Forbidden");
  });
});

// ── fetchBookingSummary ──

describe("fetchBookingSummary", () => {
  it("fetches from correct URL with credentials", async () => {
    const summary = makeMockBookingSummary();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(summary), { status: 200 }),
    );

    const result = await fetchBookingSummary();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dashboard/bookings",
      { credentials: "include" },
    );
    expect(result).toEqual(summary);
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(fetchBookingSummary()).rejects.toThrow("Unauthorized");
  });
});

// ── fetchPendingBookings ──

describe("fetchPendingBookings", () => {
  it("fetches from correct URL without params", async () => {
    const item = makeMockPendingBookingItem();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ items: [item], nextCursor: null }),
        { status: 200 },
      ),
    );

    const result = await fetchPendingBookings();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/bookings/pending",
      { credentials: "include" },
    );
    expect(result.items).toEqual([item]);
    expect(result.nextCursor).toBeNull();
  });

  it("includes cursor and limit query params", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], nextCursor: null }),
        { status: 200 },
      ),
    );

    await fetchPendingBookings({ cursor: "abc123", limit: 10 });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("cursor=abc123");
    expect(calledUrl).toContain("limit=10");
  });

  it("includes only provided params", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], nextCursor: null }),
        { status: 200 },
      ),
    );

    await fetchPendingBookings({ limit: 5 });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).not.toContain("cursor");
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(fetchPendingBookings()).rejects.toThrow("Unauthorized");
  });
});

// ── reviewBooking ──

describe("reviewBooking", () => {
  it("sends PATCH with correct JSON body and credentials", async () => {
    const booking = makeMockBookingWithService({
      id: "bk_001",
      status: "approved",
    });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 200 }),
    );

    const result = await reviewBooking("bk_001", { status: "approved" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/bookings/bk_001/review",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      },
    );
    expect(result).toEqual(booking);
  });

  it("sends deny with review note", async () => {
    const booking = makeMockBookingWithService({
      id: "bk_002",
      status: "denied",
      reviewNote: "Studio unavailable",
    });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 200 }),
    );

    const result = await reviewBooking("bk_002", {
      status: "denied",
      reviewNote: "Studio unavailable",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/bookings/bk_002/review",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "denied",
          reviewNote: "Studio unavailable",
        }),
      },
    );
    expect(result).toEqual(booking);
  });

  it("encodes special characters in booking ID", async () => {
    const booking = makeMockBookingWithService();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 200 }),
    );

    await reviewBooking("bk/special id", { status: "approved" });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("bk%2Fspecial%20id");
  });

  it("throws on 404 response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Booking not found" } }),
        { status: 404 },
      ),
    );

    await expect(
      reviewBooking("nonexistent", { status: "approved" }),
    ).rejects.toThrow("Booking not found");
  });

  it("throws on 400 response for already reviewed booking", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Booking has already been reviewed" },
        }),
        { status: 400 },
      ),
    );

    await expect(
      reviewBooking("bk_reviewed", { status: "approved" }),
    ).rejects.toThrow("Booking has already been reviewed");
  });
});
