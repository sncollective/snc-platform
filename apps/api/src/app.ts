import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";
import { z } from "zod";

import { features } from "./config.js";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { authRoutes } from "./routes/auth.routes.js";
import { meRoutes } from "./routes/me.routes.js";
import { contentRoutes } from "./routes/content.routes.js";
import { creatorRoutes } from "./routes/creator.routes.js";
import { subscriptionRoutes } from "./routes/subscription.routes.js";
import { webhookRoutes } from "./routes/webhook.routes.js";
import { merchRoutes } from "./routes/merch.routes.js";
import { bookingRoutes } from "./routes/booking.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { emissionsRoutes } from "./routes/emissions.routes.js";

// ── Schemas ──

const HealthResponse = z.object({
  status: z.literal("ok"),
});

// ── App ──

export const app = new Hono();

// ── Middleware ──

app.use("*", corsMiddleware);
app.use("*", secureHeaders());
app.use("/api/auth/*", rateLimiter({ windowMs: 60_000, max: 10 }));
app.onError(errorHandler);

// ── Routes ──

app.get(
  "/health",
  describeRoute({
    description: "Health check endpoint",
    tags: ["system"],
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": { schema: resolver(HealthResponse) },
        },
      },
    },
  }),
  (c) => c.json({ status: "ok" as const }),
);

// Always-on routes (auth, me)
app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);

// Feature-gated routes
if (features.content) app.route("/api/content", contentRoutes);
if (features.creator) app.route("/api/creators", creatorRoutes);
if (features.subscription) {
  app.route("/api/subscriptions", subscriptionRoutes);
  app.route("/api/webhooks", webhookRoutes);
}
if (features.merch) app.route("/api/merch", merchRoutes);
if (features.booking) app.route("/api", bookingRoutes);
if (features.dashboard) app.route("/api/dashboard", dashboardRoutes);
if (features.admin) app.route("/api/admin", adminRoutes);
if (features.emissions) app.route("/api/emissions", emissionsRoutes);

// ── OpenAPI (non-production only) ──

if (process.env.NODE_ENV !== "production") {
  app.get(
    "/api/openapi.json",
    openAPIRouteHandler(app, {
      documentation: {
        info: {
          title: "S/NC API",
          version: "1.0.0",
          description: "S/NC content platform API",
        },
        servers: [
          { url: "http://localhost:3000", description: "Local development" },
        ],
      },
    }),
  );

  app.get(
    "/api/docs",
    Scalar({
      url: "/api/openapi.json",
      pageTitle: "S/NC API Reference",
    }),
  );
}
