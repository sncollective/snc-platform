import { z } from "zod";

import { createPaginationQuery } from "./pagination.js";

// ── Public Constants ──

export const BOOKING_STATUSES = ["pending", "approved", "denied"] as const;
export const MAX_PREFERRED_DATES = 5;
export const MAX_BOOKING_NOTES_LENGTH = 2000;

// ── Public Schemas ──

export const BookingStatusSchema = z.enum(BOOKING_STATUSES);

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pricingInfo: z.string(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const BookingRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  serviceId: z.string(),
  preferredDates: z.array(z.string()),
  notes: z.string(),
  status: BookingStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewNote: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const BookingWithServiceSchema = BookingRequestSchema.extend({
  service: ServiceSchema,
});

export const CreateBookingRequestSchema = z.object({
  serviceId: z.string().min(1),
  preferredDates: z.array(z.string().min(1)).min(1).max(MAX_PREFERRED_DATES),
  notes: z.string().max(MAX_BOOKING_NOTES_LENGTH).default(""),
});

export const ServicesResponseSchema = z.object({
  services: z.array(ServiceSchema),
});

const BookingPaginationQuerySchema = createPaginationQuery({ max: 50, default: 20 });

export const MyBookingsQuerySchema = BookingPaginationQuerySchema;

export const BookingResponseSchema = z.object({
  booking: BookingWithServiceSchema,
});

export const MyBookingsResponseSchema = z.object({
  items: z.array(BookingWithServiceSchema),
  nextCursor: z.string().nullable(),
});

// ── Requester info for pending bookings (dashboard view) ──

export const RequesterSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

export const PendingBookingItemSchema = BookingWithServiceSchema.extend({
  requester: RequesterSchema,
});

export const PendingBookingsQuerySchema = BookingPaginationQuerySchema;

export const PendingBookingsResponseSchema = z.object({
  items: z.array(PendingBookingItemSchema),
  nextCursor: z.string().nullable(),
});

// ── Review request (approve/deny mutation) ──

export const ReviewBookingRequestSchema = z.object({
  status: z.enum(["approved", "denied"]),
  reviewNote: z.string().max(MAX_BOOKING_NOTES_LENGTH).optional(),
});

// ── Public Types ──

export type BookingStatus = z.infer<typeof BookingStatusSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type BookingRequest = z.infer<typeof BookingRequestSchema>;
export type BookingWithService = z.infer<typeof BookingWithServiceSchema>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type ServicesResponse = z.infer<typeof ServicesResponseSchema>;
export type MyBookingsQuery = z.infer<typeof MyBookingsQuerySchema>;
export type BookingResponse = z.infer<typeof BookingResponseSchema>;
export type MyBookingsResponse = z.infer<typeof MyBookingsResponseSchema>;
export type Requester = z.infer<typeof RequesterSchema>;
export type PendingBookingItem = z.infer<typeof PendingBookingItemSchema>;
export type PendingBookingsQuery = z.infer<typeof PendingBookingsQuerySchema>;
export type PendingBookingsResponse = z.infer<typeof PendingBookingsResponseSchema>;
export type ReviewBookingRequest = z.infer<typeof ReviewBookingRequestSchema>;
