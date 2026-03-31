import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq, and, desc, lt, or, asc, gt } from "drizzle-orm";

import {
  CreateBookingRequestSchema,
  ServicesResponseSchema,
  ServiceSchema,
  BookingResponseSchema,
  MyBookingsQuerySchema,
  MyBookingsResponseSchema,
  PendingBookingsQuerySchema,
  PendingBookingsResponseSchema,
  ReviewBookingRequestSchema,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@snc/shared";
import type {
  Service,
  BookingWithService,
  BookingStatus,
  MyBookingsQuery,
  PendingBookingItem,
  PendingBookingsQuery,
} from "@snc/shared";

import { db } from "../db/connection.js";
import {
  services,
  bookingRequests,
} from "../db/schema/booking.schema.js";
import { users } from "../db/schema/user.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_404,
} from "../lib/openapi-errors.js";
import { buildCursorCondition, buildPaginatedResponse, decodeCursor } from "../lib/cursor.js";
import { toISO } from "../lib/response-helpers.js";
import { getClientIp } from "../lib/request-helpers.js";
import { rootLogger } from "../logging/logger.js";
import { IdParam } from "./route-params.js";

// ── Private Types ──

type ServiceRow = typeof services.$inferSelect;
type BookingRequestRow = typeof bookingRequests.$inferSelect;
type UserRow = typeof users.$inferSelect;

// ── Private Helpers ──

/**
 * Transform a DB service row to the API response shape.
 * Converts Date timestamps to ISO strings.
 */
const toServiceResponse = (row: ServiceRow): Service => ({
  id: row.id,
  name: row.name,
  description: row.description,
  pricingInfo: row.pricingInfo,
  active: row.active,
  sortOrder: row.sortOrder,
  createdAt: toISO(row.createdAt),
  updatedAt: toISO(row.updatedAt),
});

/**
 * Transform joined booking + service DB rows to the API response shape
 * with nested service object.
 */
const toBookingWithServiceResponse = (
  booking: BookingRequestRow,
  service: ServiceRow,
): BookingWithService => ({
  id: booking.id,
  userId: booking.userId,
  serviceId: booking.serviceId,
  preferredDates: booking.preferredDates,
  notes: booking.notes,
  status: booking.status,
  reviewedBy: booking.reviewedBy ?? null,
  reviewNote: booking.reviewNote ?? null,
  createdAt: toISO(booking.createdAt),
  updatedAt: toISO(booking.updatedAt),
  service: toServiceResponse(service),
});

/**
 * Transform 3-way join result (booking + service + user) to the
 * PendingBookingItem API response shape with nested requester and service.
 */
const toPendingBookingItemResponse = (
  booking: BookingRequestRow,
  service: ServiceRow,
  user: UserRow,
): PendingBookingItem => ({
  ...toBookingWithServiceResponse(booking, service),
  requester: {
    id: user.id,
    name: user.name,
    email: user.email,
  },
});

// ── Private Constants ──

/**
 * Response schema for GET /services/:id. Wraps a single service.
 * Defined locally because it's only used by this endpoint (no shared schema
 * needed; ServicesResponseSchema wraps an array).
 */
const ServiceDetailResponseSchema = z.object({
  service: ServiceSchema,
});

// ── Public API ──

export const bookingRoutes = new Hono<AuthEnv>();

// ── Service Endpoints ──

// GET /services — List active services

bookingRoutes.get(
  "/services",
  describeRoute({
    description: "List active services sorted by sort order",
    tags: ["booking"],
    responses: {
      200: {
        description: "List of active services",
        content: {
          "application/json": { schema: resolver(ServicesResponseSchema) },
        },
      },
    },
  }),
  optionalAuth,
  async (c) => {
    const rows = await db
      .select()
      .from(services)
      .where(eq(services.active, true))
      .orderBy(asc(services.sortOrder), asc(services.createdAt));

    return c.json({ services: rows.map(toServiceResponse) });
  },
);

// GET /services/:id — Get single service

bookingRoutes.get(
  "/services/:id",
  describeRoute({
    description: "Get a single active service by ID",
    tags: ["booking"],
    responses: {
      200: {
        description: "Service detail",
        content: {
          "application/json": {
            schema: resolver(ServiceDetailResponseSchema),
          },
        },
      },
      404: ERROR_404,
    },
  }),
  optionalAuth,
  validator("param", IdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };

    const [row] = await db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.active, true)));

    if (!row) {
      throw new NotFoundError("Service not found");
    }

    return c.json({ service: toServiceResponse(row) });
  },
);

// ── Booking Endpoints ──

// POST /bookings — Submit booking request

bookingRoutes.post(
  "/bookings",
  requireAuth,
  describeRoute({
    description: "Submit a booking request for a service",
    tags: ["booking"],
    responses: {
      201: {
        description: "Booking request created",
        content: {
          "application/json": { schema: resolver(BookingResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      404: ERROR_404,
    },
  }),
  validator("json", CreateBookingRequestSchema),
  async (c) => {
    const { serviceId, preferredDates, notes } = c.req.valid("json");
    const user = c.get("user");

    // Validate service exists and is active
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.active, true)));

    if (!service) {
      throw new NotFoundError("Service not found or inactive");
    }

    const id = randomUUID();
    const now = new Date();

    const [booking] = await db
      .insert(bookingRequests)
      .values({
        id,
        userId: user.id,
        serviceId,
        preferredDates,
        notes,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(
      { booking: toBookingWithServiceResponse(booking!, service) },
      201,
    );
  },
);

// GET /bookings/mine — List user's bookings

bookingRoutes.get(
  "/bookings/mine",
  requireAuth,
  describeRoute({
    description:
      "List the authenticated user's booking requests with cursor pagination",
    tags: ["booking"],
    responses: {
      200: {
        description: "Paginated list of user's bookings with service data",
        content: {
          "application/json": {
            schema: resolver(MyBookingsResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
    },
  }),
  validator("query", MyBookingsQuerySchema),
  async (c) => {
    const { limit, cursor } =
      c.req.valid("query" as never) as MyBookingsQuery;
    const user = c.get("user");

    // Build WHERE conditions
    const conditions = [eq(bookingRequests.userId, user.id)];

    // Decode cursor for keyset pagination
    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(
          bookingRequests.createdAt,
          bookingRequests.id,
          decoded,
          "desc",
        ),
      );
    }

    const rows = await db
      .select()
      .from(bookingRequests)
      .innerJoin(services, eq(bookingRequests.serviceId, services.id))
      .where(and(...conditions))
      .orderBy(desc(bookingRequests.createdAt), desc(bookingRequests.id))
      .limit(limit + 1);

    const { items: rawItems, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.booking_requests.createdAt.toISOString(),
        id: last.booking_requests.id,
      }),
    );

    const bookings = rawItems.map((row) =>
      toBookingWithServiceResponse(row.booking_requests, row.services),
    );

    return c.json({ items: bookings, nextCursor });
  },
);

// GET /bookings/pending — List pending booking requests (cooperative-member)

bookingRoutes.get(
  "/bookings/pending",
  requireAuth,
  requireRole("stakeholder"),
  describeRoute({
    description:
      "List pending booking requests with requester info (cooperative-member only)",
    tags: ["booking"],
    responses: {
      200: {
        description: "Paginated list of pending bookings with requester info",
        content: {
          "application/json": {
            schema: resolver(PendingBookingsResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("query", PendingBookingsQuerySchema),
  async (c) => {
    const { limit, cursor } =
      c.req.valid("query" as never) as PendingBookingsQuery;

    // Build WHERE conditions — always filter to pending status
    const conditions = [eq(bookingRequests.status, "pending")];

    // Decode cursor for keyset pagination (ASC order — oldest first)
    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(
          bookingRequests.createdAt,
          bookingRequests.id,
          decoded,
          "asc",
        ),
      );
    }

    // 3-way join: booking_requests + services + users
    const rows = await db
      .select()
      .from(bookingRequests)
      .innerJoin(services, eq(bookingRequests.serviceId, services.id))
      .innerJoin(users, eq(bookingRequests.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(bookingRequests.createdAt), asc(bookingRequests.id))
      .limit(limit + 1);

    const { items: rawItems, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.booking_requests.createdAt.toISOString(),
        id: last.booking_requests.id,
      }),
    );

    const items = rawItems.map((row) =>
      toPendingBookingItemResponse(
        row.booking_requests,
        row.services,
        row.users,
      ),
    );

    return c.json({ items, nextCursor });
  },
);

// GET /bookings/:id — Get single booking

bookingRoutes.get(
  "/bookings/:id",
  requireAuth,
  describeRoute({
    description: "Get a single booking request by ID (owner only)",
    tags: ["booking"],
    responses: {
      200: {
        description: "Booking request detail with service data",
        content: {
          "application/json": { schema: resolver(BookingResponseSchema) },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", IdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const user = c.get("user");

    const [row] = await db
      .select()
      .from(bookingRequests)
      .innerJoin(services, eq(bookingRequests.serviceId, services.id))
      .where(eq(bookingRequests.id, id));

    if (!row) {
      throw new NotFoundError("Booking not found");
    }

    // Ownership check
    if (row.booking_requests.userId !== user.id) {
      throw new ForbiddenError("Not the booking owner");
    }

    return c.json({
      booking: toBookingWithServiceResponse(
        row.booking_requests,
        row.services,
      ),
    });
  },
);

// PATCH /bookings/:id/review — Approve or deny a booking (cooperative-member)

bookingRoutes.patch(
  "/bookings/:id/review",
  requireAuth,
  requireRole("stakeholder", "admin"),
  describeRoute({
    description:
      "Approve or deny a booking request with optional review note (cooperative-member only)",
    tags: ["booking"],
    responses: {
      200: {
        description: "Updated booking with service data",
        content: {
          "application/json": { schema: resolver(BookingResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", IdParam),
  validator("json", ReviewBookingRequestSchema),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const user = c.get("user");
    const { status, reviewNote } = c.req.valid("json");

    // Look up booking with service join
    const [row] = await db
      .select()
      .from(bookingRequests)
      .innerJoin(services, eq(bookingRequests.serviceId, services.id))
      .where(eq(bookingRequests.id, id));

    if (!row) {
      throw new NotFoundError("Booking not found");
    }

    // Validate booking is currently pending
    if (row.booking_requests.status !== "pending") {
      throw new ValidationError("Booking has already been reviewed");
    }

    // Update booking status, reviewer, and note
    const [updated] = await db
      .update(bookingRequests)
      .set({
        status,
        reviewedBy: user.id,
        reviewNote: reviewNote ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.id, id))
      .returning();

    const logger = c.var?.logger ?? rootLogger;
    logger.info(
      {
        event: "booking_reviewed",
        actorId: user.id,
        bookingId: id,
        status,
        ip: getClientIp(c),
      },
      "Booking reviewed",
    );

    return c.json({
      booking: toBookingWithServiceResponse(updated!, row.services),
    });
  },
);
