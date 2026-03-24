import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import {
  PlansQuerySchema,
  PlansResponseSchema,
  SubscriptionPlanSchema,
  CheckoutRequestSchema,
  CheckoutResponseSchema,
  CancelRequestSchema,
  UserSubscriptionWithPlanSchema,
  MySubscriptionsResponseSchema,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@snc/shared";
import type {
  SubscriptionPlan,
  PlansQuery,
  UserSubscriptionWithPlan,
  PlanType,
  PlanInterval,
  SubscriptionStatus,
} from "@snc/shared";

import { db } from "../db/connection.js";
import {
  subscriptionPlans,
  userSubscriptions,
} from "../db/schema/subscription.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_404,
  ERROR_502,
  ERROR_503,
} from "../lib/openapi-errors.js";
import {
  getOrCreateCustomer,
  createCheckoutSession,
  cancelSubscriptionAtPeriodEnd,
} from "../services/stripe.js";
import { getFrontendBaseUrl } from "../lib/route-utils.js";

// ── Private Types ──

type PlanRow = typeof subscriptionPlans.$inferSelect;
type SubscriptionRow = typeof userSubscriptions.$inferSelect;

// ── Private Helpers ──

/**
 * Transform a DB plan row to the API response shape.
 * Converts Date timestamps to ISO strings.
 */
const toPlanResponse = (row: PlanRow): SubscriptionPlan => ({
  id: row.id,
  name: row.name,
  type: row.type as PlanType,
  creatorId: row.creatorId ?? null,
  price: row.price,
  interval: row.interval as PlanInterval,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Transform a subscription DB row + plan DB row into the API response shape
 * with nested plan object. Used by POST /cancel and GET /mine.
 */
const toSubscriptionWithPlanResponse = (
  sub: SubscriptionRow,
  plan: PlanRow,
): UserSubscriptionWithPlan => ({
  id: sub.id,
  userId: sub.userId,
  planId: sub.planId,
  status: sub.status as SubscriptionStatus,
  currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
  cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  createdAt: sub.createdAt.toISOString(),
  updatedAt: sub.updatedAt.toISOString(),
  plan: toPlanResponse(plan),
});

// ── Private Constants ──

/**
 * Response schema for the cancel endpoint. Wraps a single subscription with
 * its nested plan. Defined locally because it's only used by POST /cancel
 * (following the UploadQuerySchema pattern in content.routes.ts).
 */
const CancelResponseSchema = z.object({
  subscription: UserSubscriptionWithPlanSchema,
});

// ── Public API ──

export const subscriptionRoutes = new Hono<AuthEnv>();

// GET /plans — List available plans

subscriptionRoutes.get(
  "/plans",
  describeRoute({
    description: "List available subscription plans",
    tags: ["subscriptions"],
    responses: {
      200: {
        description: "List of active subscription plans",
        content: {
          "application/json": { schema: resolver(PlansResponseSchema) },
        },
      },
      400: ERROR_400,
    },
  }),
  validator("query", PlansQuerySchema),
  async (c) => {
    const { creatorId, type } =
      c.req.valid("query" as never) as PlansQuery;

    // Build WHERE conditions: always filter active plans
    const conditions = [eq(subscriptionPlans.active, true)];

    if (type) {
      conditions.push(eq(subscriptionPlans.type, type));
    }

    if (creatorId) {
      conditions.push(eq(subscriptionPlans.creatorId, creatorId));
    }

    const rows = await db
      .select()
      .from(subscriptionPlans)
      .where(and(...conditions));

    const plans = rows.map(toPlanResponse);

    return c.json({ plans });
  },
);

// POST /checkout — Create Stripe Checkout session

subscriptionRoutes.post(
  "/checkout",
  requireAuth,
  describeRoute({
    description: "Create a Stripe Checkout session for a subscription plan",
    tags: ["subscriptions"],
    responses: {
      200: {
        description: "Checkout session created",
        content: {
          "application/json": { schema: resolver(CheckoutResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  validator("json", CheckoutRequestSchema),
  async (c) => {
    const { planId } = c.req.valid("json");
    const user = c.get("user");

    // Validate plan exists and is active
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.id, planId),
          eq(subscriptionPlans.active, true),
        ),
      );

    if (!plan) {
      throw new ValidationError("Plan not found or inactive");
    }

    // Get or create Stripe customer
    const customerResult = await getOrCreateCustomer(user.id, user.email);
    if (!customerResult.ok) {
      throw customerResult.error;
    }

    // Build success/cancel redirect URLs
    const baseUrl = getFrontendBaseUrl();
    const successUrl = `${baseUrl}/checkout/success`;
    const cancelUrl = `${baseUrl}/checkout/cancel`;

    // Create checkout session
    const sessionResult = await createCheckoutSession({
      customerId: customerResult.value,
      planStripePriceId: plan.stripePriceId,
      userId: user.id,
      planId: plan.id,
      successUrl,
      cancelUrl,
    });

    if (!sessionResult.ok) {
      throw sessionResult.error;
    }

    return c.json({ checkoutUrl: sessionResult.value });
  },
);

// POST /cancel — Cancel a subscription

subscriptionRoutes.post(
  "/cancel",
  requireAuth,
  describeRoute({
    description: "Cancel an active subscription at the end of the billing period",
    tags: ["subscriptions"],
    responses: {
      200: {
        description: "Subscription marked for cancellation",
        content: {
          "application/json": { schema: resolver(CancelResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  validator("json", CancelRequestSchema),
  async (c) => {
    const { subscriptionId } = c.req.valid("json");
    const user = c.get("user");

    // Look up subscription
    const [sub] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.id, subscriptionId));

    if (!sub) {
      throw new NotFoundError("Subscription not found");
    }

    // Ownership check
    if (sub.userId !== user.id) {
      throw new ForbiddenError("Not the subscription owner");
    }

    // Status check: must be active and not already canceling
    if (sub.status !== "active") {
      throw new ValidationError("Subscription is not active");
    }

    if (sub.cancelAtPeriodEnd) {
      throw new ValidationError(
        "Subscription is already set to cancel at period end",
      );
    }

    // Cancel on Stripe
    const cancelResult = await cancelSubscriptionAtPeriodEnd(
      sub.stripeSubscriptionId,
    );
    if (!cancelResult.ok) {
      throw cancelResult.error;
    }

    // Update local DB
    const [updated] = await db
      .update(userSubscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(userSubscriptions.id, subscriptionId))
      .returning();

    // Get plan for response
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, sub.planId));

    if (!plan) {
      throw new NotFoundError("Subscription plan not found");
    }

    return c.json({
      subscription: toSubscriptionWithPlanResponse(updated!, plan),
    });
  },
);

// GET /mine — List user's subscriptions

subscriptionRoutes.get(
  "/mine",
  requireAuth,
  describeRoute({
    description: "List the authenticated user's subscriptions with plan details",
    tags: ["subscriptions"],
    responses: {
      200: {
        description: "User's subscriptions with nested plan details",
        content: {
          "application/json": {
            schema: resolver(MySubscriptionsResponseSchema),
          },
        },
      },
      401: ERROR_401,
    },
  }),
  async (c) => {
    const user = c.get("user");

    const rows = await db
      .select()
      .from(userSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(userSubscriptions.planId, subscriptionPlans.id),
      )
      .where(eq(userSubscriptions.userId, user.id));

    const subscriptions = rows.map((row) =>
      toSubscriptionWithPlanResponse(
        row.user_subscriptions,
        row.subscription_plans,
      ),
    );

    return c.json({ subscriptions });
  },
);
