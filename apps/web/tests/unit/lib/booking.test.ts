import { describe, it, expect } from "vitest";

import { createBooking } from "../../../src/lib/booking.js";
import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── Tests ──

describe("createBooking", () => {
  it("posts to correct URL with body and credentials", async () => {
    const booking = makeMockBookingWithService();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ booking }), { status: 201 }),
    );

    const result = await createBooking({
      serviceId: "svc_test_recording",
      preferredDates: ["2026-03-15"],
      notes: "Afternoon preferred",
    });

    expect(getMockFetch()).toHaveBeenCalledWith(
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
    getMockFetch().mockResolvedValue(
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
    getMockFetch().mockResolvedValue(
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
