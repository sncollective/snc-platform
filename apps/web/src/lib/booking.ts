import type {
  BookingWithService,
  CreateBookingRequest,
} from "@snc/shared";

import { apiMutate } from "./fetch-utils.js";

// ── Public API ──

/**
 * Submit a booking request.
 * Returns the created booking with nested service data.
 */
export async function createBooking(
  data: CreateBookingRequest,
): Promise<BookingWithService> {
  const result = await apiMutate<{ booking: BookingWithService }>(
    "/api/bookings",
    { body: data },
  );
  return result.booking;
}
