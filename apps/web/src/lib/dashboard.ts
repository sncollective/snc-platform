import type {
  RevenueResponse,
  SubscriberSummary,
  BookingSummary,
  ReviewBookingRequest,
  BookingWithService,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

// ── Public API ──

/** Fetch monthly revenue data for the dashboard. */
export async function fetchRevenue(): Promise<RevenueResponse> {
  return apiGet<RevenueResponse>("/api/dashboard/revenue");
}

/** Fetch subscriber count summary for the dashboard. */
export async function fetchSubscribers(): Promise<SubscriberSummary> {
  return apiGet<SubscriberSummary>("/api/dashboard/subscribers");
}

/** Fetch booking request summary for the dashboard. */
export async function fetchBookingSummary(): Promise<BookingSummary> {
  return apiGet<BookingSummary>("/api/dashboard/bookings");
}

/** Approve or deny a booking request. */
export async function reviewBooking(
  id: string,
  data: ReviewBookingRequest,
): Promise<BookingWithService> {
  const result = await apiMutate<{ booking: BookingWithService }>(
    `/api/bookings/${encodeURIComponent(id)}/review`,
    { method: "PATCH", body: data },
  );
  return result.booking;
}
