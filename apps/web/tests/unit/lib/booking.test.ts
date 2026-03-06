import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  fetchServices,
  fetchServiceById,
  createBooking,
  fetchMyBookings,
  fetchBookingById,
} from "../../../src/lib/booking.js";
import {
  makeMockService,
  makeMockBookingWithService,
} from "../../helpers/booking-fixtures.js";

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

// ── Tests ──

describe("fetchServices", () => {
  it("fetches from correct URL with credentials", async () => {
    const service = makeMockService();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ services: [service] }), { status: 200 }),
    );

    const result = await fetchServices();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services",
      { credentials: "include" },
    );
    expect(result).toEqual([service]);
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Server error" } }),
        { status: 500 },
      ),
    );

    await expect(fetchServices()).rejects.toThrow("Server error");
  });
});

describe("fetchServiceById", () => {
  it("fetches from correct URL with service ID", async () => {
    const service = makeMockService({ id: "svc_123" });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ service }), { status: 200 }),
    );

    const result = await fetchServiceById("svc_123");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/svc_123",
      { credentials: "include" },
    );
    expect(result).toEqual(service);
  });

  it("encodes special characters in service ID", async () => {
    const service = makeMockService();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ service }), { status: 200 }),
    );

    await fetchServiceById("svc/special id");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/svc%2Fspecial%20id",
      { credentials: "include" },
    );
  });

  it("throws on 404 response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Service not found" } }),
        { status: 404 },
      ),
    );

    await expect(fetchServiceById("nonexistent")).rejects.toThrow(
      "Service not found",
    );
  });
});

describe("createBooking", () => {
  it("posts to correct URL with body and credentials", async () => {
    const booking = makeMockBookingWithService();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 201 }),
    );

    const result = await createBooking({
      serviceId: "svc_test_recording",
      preferredDates: ["2026-03-15"],
      notes: "Afternoon preferred",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/bookings",
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceId: "svc_test_recording",
          preferredDates: ["2026-03-15"],
          notes: "Afternoon preferred",
        }),
      },
    );
    expect(result).toEqual(booking);
  });

  it("throws on 401 response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(
      createBooking({
        serviceId: "svc_test",
        preferredDates: ["2026-03-15"],
        notes: "",
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("throws on 400 validation error", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Validation failed" } }),
        { status: 400 },
      ),
    );

    await expect(
      createBooking({
        serviceId: "",
        preferredDates: [],
        notes: "",
      }),
    ).rejects.toThrow("Validation failed");
  });
});

describe("fetchMyBookings", () => {
  it("fetches from correct URL without params", async () => {
    const booking = makeMockBookingWithService();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ items: [booking], nextCursor: null }),
        { status: 200 },
      ),
    );

    const result = await fetchMyBookings();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/bookings/mine",
      { credentials: "include" },
    );
    expect(result.items).toEqual([booking]);
    expect(result.nextCursor).toBeNull();
  });

  it("includes cursor and limit query params", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], nextCursor: null }),
        { status: 200 },
      ),
    );

    await fetchMyBookings({ cursor: "abc123", limit: 10 });

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

    await fetchMyBookings({ limit: 5 });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).not.toContain("cursor");
  });

  it("returns nextCursor when present", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], nextCursor: "cursor_xyz" }),
        { status: 200 },
      ),
    );

    const result = await fetchMyBookings();

    expect(result.nextCursor).toBe("cursor_xyz");
  });

  it("throws on 401 response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(fetchMyBookings()).rejects.toThrow("Unauthorized");
  });
});

describe("fetchBookingById", () => {
  it("fetches from correct URL with booking ID", async () => {
    const booking = makeMockBookingWithService({ id: "bk_abc" });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 200 }),
    );

    const result = await fetchBookingById("bk_abc");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/bookings/bk_abc",
      { credentials: "include" },
    );
    expect(result).toEqual(booking);
  });

  it("throws on 404 response", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Booking not found" } }),
        { status: 404 },
      ),
    );

    await expect(fetchBookingById("nonexistent")).rejects.toThrow(
      "Booking not found",
    );
  });

  it("throws on 403 response for non-owner", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Not the booking owner" },
        }),
        { status: 403 },
      ),
    );

    await expect(fetchBookingById("bk_other")).rejects.toThrow(
      "Not the booking owner",
    );
  });
});
