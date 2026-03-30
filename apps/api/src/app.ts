import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";
import { z } from "zod";

import { features } from "./config.js";
import { rootLogger } from "./logging/logger.js";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { requestIdMiddleware, requestLogger } from "./middleware/request-logger.js";
import { authRoutes } from "./routes/auth.routes.js";
import { meRoutes } from "./routes/me.routes.js";
import { meCreatorsRoutes } from "./routes/me-creators.routes.js";
import { contentRoutes } from "./routes/content.routes.js";
import { contentMediaRoutes } from "./routes/content-media.routes.js";
import { creatorRoutes } from "./routes/creator.routes.js";
import { creatorMediaRoutes } from "./routes/creator-media.routes.js";
import { creatorMemberRoutes } from "./routes/creator-members.routes.js";
import { subscriptionRoutes } from "./routes/subscription.routes.js";
import { webhookRoutes } from "./routes/webhook.routes.js";
import { merchRoutes } from "./routes/merch.routes.js";
import { bookingRoutes } from "./routes/booking.routes.js";
import { studioRoutes } from "./routes/studio.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { emissionsRoutes } from "./routes/emissions.routes.js";
import { calendarRoutes } from "./routes/calendar.routes.js";
import { calendarFeedRoutes } from "./routes/calendar-feed.routes.js";
import { calendarEventTypeRoutes } from "./routes/calendar-event-types.routes.js";
import { creatorEventRoutes } from "./routes/creator-events.routes.js";
import { projectRoutes } from "./routes/project.routes.js";
import { streamingRoutes } from "./routes/streaming.routes.js";
import { uploadRoutes } from "./routes/upload.routes.js";
import { initWebSocket } from "./ws.js";
// federation.routes uses @fedify/fedify which may not be installed;
// imported dynamically below so the server boots even without it.

// ── Schemas ──

const HealthResponse = z.object({
  status: z.literal("ok"),
});

// ── App ──

export const app = new Hono();

initWebSocket(app);

// ── Middleware ──

app.use("*", corsMiddleware);
app.use("*", secureHeaders());
app.use("*", requestIdMiddleware);
app.use("*", requestLogger);
const authStrictLimiter = rateLimiter({ windowMs: 60_000, max: 10 });
const authGeneralLimiter = rateLimiter({ windowMs: 60_000, max: 60 });
app.use("/api/auth/*", (c, next) => {
  const path = c.req.path;
  if (
    path.startsWith("/api/auth/sign-in") ||
    path.startsWith("/api/auth/sign-up") ||
    path.startsWith("/api/auth/email-otp") ||
    path.startsWith("/api/auth/forget-password") ||
    path.startsWith("/api/auth/reset-password")
  ) {
    return authStrictLimiter(c, next);
  }
  return authGeneralLimiter(c, next);
});
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

// Always-on routes (auth, me, uploads)
app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/me/creators", meCreatorsRoutes);
app.route("/api/uploads", uploadRoutes);

// Feature-gated routes
if (features.content) {
  app.route("/api/content", contentRoutes);
  app.route("/api/content", contentMediaRoutes);
}
if (features.creator) {
  app.route("/api/creators", creatorRoutes);
  app.route("/api/creators", creatorMediaRoutes);
  app.route("/api/creators", creatorMemberRoutes);
}
if (features.subscription) {
  app.route("/api/subscriptions", subscriptionRoutes);
  app.route("/api/webhooks", webhookRoutes);
}
if (features.merch) app.route("/api/merch", merchRoutes);
if (features.booking) app.route("/api", bookingRoutes);
if (features.booking) app.route("/api/studio", studioRoutes);
if (features.dashboard) app.route("/api/dashboard", dashboardRoutes);
if (features.admin) app.route("/api/admin", adminRoutes);
if (features.emissions) app.route("/api/emissions", emissionsRoutes);
if (features.calendar) app.route("/api/calendar", calendarRoutes);
if (features.calendar) app.route("/api/calendar", calendarFeedRoutes);
if (features.calendar) app.route("/api/calendar", calendarEventTypeRoutes);
if (features.calendar && features.creator) {
  app.route("/api/creators", creatorEventRoutes);
}
if (features.calendar) app.route("/api/projects", projectRoutes);
if (features.streaming) app.route("/api/streaming", streamingRoutes);
if (features.streaming) {
  import("./routes/chat.routes.js")
    .then(({ chatRoutes }) => app.route("/api/chat", chatRoutes))
    .catch((err) => rootLogger.error({ error: err instanceof Error ? err.message : String(err) }, "Failed to load chat routes"));
  import("./routes/playout.routes.js")
    .then(({ playoutRoutes }) => app.route("/api/playout", playoutRoutes))
    .catch((err) => rootLogger.error({ error: err instanceof Error ? err.message : String(err) }, "Failed to load playout routes"));
  import("./routes/simulcast.routes.js")
    .then(({ simulcastRoutes }) => app.route("/api/simulcast", simulcastRoutes))
    .catch((err) =>
      rootLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to load simulcast routes",
      ),
    );
}
// Federation routes mount at root (not /api/) because /.well-known/* and /ap/* paths live there
if (features.federation) {
  import("./routes/federation.routes.js")
    .then(({ federationRoutes }) => app.route("/", federationRoutes))
    .catch((err) => rootLogger.error({ error: err instanceof Error ? err.message : String(err) }, "Failed to load federation routes"));
}

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
