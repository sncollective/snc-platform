import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { eq, count } from "drizzle-orm";

import {
  RevenueResponseSchema,
  SubscriberSummarySchema,
  BookingSummarySchema,
} from "@snc/shared";
import type { MonthlyRevenue } from "@snc/shared";

import { db } from "../db/connection.js";
import { userSubscriptions } from "../db/schema/subscription.schema.js";
import { bookingRequests } from "../db/schema/booking.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_401, ERROR_403, ERROR_502, ERROR_503 } from "./openapi-errors.js";
import { getMonthlyRevenue } from "../services/revenue.js";

// ── Public API ──

export const dashboardRoutes = new Hono<AuthEnv>();

dashboardRoutes.get(
  "/revenue",
  requireAuth,
  requireRole("cooperative-member"),
  describeRoute({
    description: "Monthly revenue from Stripe invoices (last 12 months)",
    tags: ["dashboard"],
    responses: {
      200: {
        description: "Revenue breakdown",
        content: {
          "application/json": { schema: resolver(RevenueResponseSchema) },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  async (c) => {
    const result = await getMonthlyRevenue(12);
    if (!result.ok) {
      throw result.error;
    }

    const monthly = result.value;
    const now = new Date();
    const currentMonthKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`;
    const currentEntry = monthly.find(
      (m: MonthlyRevenue) => `${m.year}-${m.month}` === currentMonthKey,
    );
    const currentMonth = currentEntry?.amount ?? 0;

    return c.json({ currentMonth, monthly });
  },
);

dashboardRoutes.get(
  "/subscribers",
  requireAuth,
  requireRole("cooperative-member"),
  describeRoute({
    description: "Active subscriber count",
    tags: ["dashboard"],
    responses: {
      200: {
        description: "Subscriber summary",
        content: {
          "application/json": { schema: resolver(SubscriberSummarySchema) },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const [row] = await db
      .select({ count: count() })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.status, "active"));

    return c.json({ active: row?.count ?? 0 });
  },
);

dashboardRoutes.get(
  "/bookings",
  requireAuth,
  requireRole("cooperative-member"),
  describeRoute({
    description: "Pending and total booking request counts",
    tags: ["dashboard"],
    responses: {
      200: {
        description: "Booking summary",
        content: {
          "application/json": { schema: resolver(BookingSummarySchema) },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  async (c) => {
    const [[totalRow], [pendingRow]] = await Promise.all([
      db.select({ count: count() }).from(bookingRequests),
      db
        .select({ count: count() })
        .from(bookingRequests)
        .where(eq(bookingRequests.status, "pending")),
    ]);

    return c.json({
      pending: pendingRow?.count ?? 0,
      total: totalRow?.count ?? 0,
    });
  },
);
