import { describe, it, expect } from "vitest";

import {
  fetchRevenue,
  fetchSubscribers,
  fetchBookingSummary,
  reviewBooking,
} from "../../../src/lib/dashboard.js";
import {
  makeMockRevenueResponse,
  makeMockSubscriberSummary,
  makeMockBookingSummary,
} from "../../helpers/dashboard-fixtures.js";
import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── fetchRevenue ──

describe("fetchRevenue", () => {
  it("fetches from correct URL with credentials", async () => {
    const revenue = makeMockRevenueResponse();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(revenue), { status: 200 }),
    );

    const result = await fetchRevenue();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/dashboard/revenue",
      { credentials: "include" },
    );
    expect(result).toEqual(revenue);
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
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
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(subscribers), { status: 200 }),
    );

    const result = await fetchSubscribers();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/dashboard/subscribers",
      { credentials: "include" },
    );
    expect(result).toEqual(subscribers);
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
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
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(summary), { status: 200 }),
    );

    const result = await fetchBookingSummary();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/dashboard/bookings",
      { credentials: "include" },
    );
    expect(result).toEqual(summary);
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(fetchBookingSummary()).rejects.toThrow("Unauthorized");
  });
});

// ── reviewBooking ──

describe("reviewBooking", () => {
  it("sends PATCH with correct JSON body and credentials", async () => {
    const booking = makeMockBookingWithService({
      id: "bk_001",
      status: "approved",
    });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 200 }),
    );

    const result = await reviewBooking("bk_001", { status: "approved" });

    expect(getMockFetch()).toHaveBeenCalledWith(
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
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 200 }),
    );

    const result = await reviewBooking("bk_002", {
      status: "denied",
      reviewNote: "Studio unavailable",
    });

    expect(getMockFetch()).toHaveBeenCalledWith(
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
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 200 }),
    );

    await reviewBooking("bk/special id", { status: "approved" });

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("bk%2Fspecial%20id");
  });

  it("throws on 404 response", async () => {
    getMockFetch().mockResolvedValue(
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
    getMockFetch().mockResolvedValue(
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
