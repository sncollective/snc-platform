import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { describeRoute, validator } from "hono-openapi";
import { resolver } from "hono-openapi";
import { z } from "zod";

import { SSE_TOPICS, TOPIC_ACCESS, ValidationError, AppError } from "@snc/shared";
import type { SseTopic } from "@snc/shared";

import type { OptionalAuthEnv } from "../middleware/optional-auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import { createEventBus, eventBus } from "../services/event-bus.js";
import type { EventBus } from "../services/event-bus.js";
import { rootLogger } from "../logging/logger.js";
import { ERROR_400, ERROR_503 } from "../lib/openapi-errors.js";

// ── DI Types ──

/** Dependency injection interface for the SSE route factory (for testing). */
export interface SseRouteDeps {
  /** Override the event bus instance (defaults to module-level singleton). */
  bus?: EventBus;
  /** Milliseconds between heartbeats when no events arrive. Default: 25_000. */
  heartbeatMs?: number;
  /** Max lifetime of a single SSE connection in milliseconds. Default: 4h with ±15% jitter. */
  lifetimeMs?: number;
  /** Maximum concurrent connections before 503. Default: 1000. */
  maxConnections?: number;
}

// ── Query Schema ──

const TopicsQuery = z.object({
  topics: z.string().min(1),
});

// ── OpenAPI Schemas ──

const EventStreamResponse = z.string().describe("Server-Sent Events stream");

// ── Private Helpers ──

/**
 * Compute the access grants for a subscriber based on requested topics and auth context.
 * Returns { granted, denied } where denied contains known-but-insufficient-access topics.
 */
const computeGrants = (
  requestedTopics: SseTopic[],
  user: { id: string } | null,
  roles: string[],
): { granted: SseTopic[]; denied: SseTopic[] } => {
  const granted: SseTopic[] = [];
  const denied: SseTopic[] = [];

  for (const topic of requestedTopics) {
    const access = TOPIC_ACCESS[topic];
    if (access === "public") {
      granted.push(topic);
    } else if (access === "admin" && roles.includes("admin")) {
      granted.push(topic);
    } else if (access === "authenticated" && user !== null) {
      granted.push(topic);
    } else {
      denied.push(topic);
    }
  }

  return { granted, denied };
};

// ── Factory ──

/**
 * Create the SSE route handler with injected dependencies.
 * Use the exported `sseRoutes` singleton in production; inject deps in tests.
 */
export function createSseRoutes(deps?: SseRouteDeps): Hono<OptionalAuthEnv> {
  const bus = deps?.bus ?? eventBus;
  const heartbeatMs = deps?.heartbeatMs ?? 25_000;
  const lifetimeMs = deps?.lifetimeMs ?? 4 * 60 * 60 * 1_000;
  const maxConnections = deps?.maxConnections ?? 1_000;

  const app = new Hono<OptionalAuthEnv>();

  // ── GET /api/sse ──

  app.get(
    "/",
    describeRoute({
      description:
        "SSE event spine. Subscribe to platform events via a persistent Server-Sent Events stream. " +
        "Pass a comma-separated list of topic names in ?topics=. " +
        "The server sends a spine.connected handshake on connect, then streams events as they occur, " +
        "with periodic heartbeat comments. No id: field is ever sent.",
      tags: ["sse"],
      responses: {
        200: {
          description: "SSE stream (text/event-stream)",
          content: {
            "text/event-stream": { schema: resolver(EventStreamResponse) },
          },
        },
        400: ERROR_400,
        503: ERROR_503,
      },
    }),
    rateLimiter({ windowMs: 60_000, max: 30 }),
    optionalAuth,
    validator("query", TopicsQuery),
    async (c) => {
      const { topics: topicsRaw } = c.req.valid("query" as never) as z.infer<typeof TopicsQuery>;
      const user = c.get("user");
      const session = c.get("session");
      const roles = c.get("roles") ?? [];

      // Parse and deduplicate topic names from the CSV query param
      const rawTopics = [...new Set(topicsRaw.split(",").map((t) => t.trim()).filter(Boolean))];

      // Validate each topic name — unknown names → 400
      for (const name of rawTopics) {
        if (!(SSE_TOPICS as readonly string[]).includes(name)) {
          throw new ValidationError(`Unknown topic: ${name}`);
        }
      }

      const requestedTopics = rawTopics as SseTopic[];

      // Compute grants based on auth context
      const { granted, denied } = computeGrants(requestedTopics, user, roles);

      // Capacity check before allocating a subscription
      if (bus.connectionCount() >= maxConnections) {
        throw new AppError("SSE_CAPACITY", "Too many concurrent connections", 503);
      }

      // Jitter retry: 2000–5000ms, instructs the browser reconnect interval
      const jitteredRetry = Math.floor(Math.random() * 3_000) + 2_000;

      // Compute connection deadline with ±15% lifetime jitter
      const jitteredLifetime = lifetimeMs * (1 + (Math.random() * 0.3 - 0.15));
      let deadline = Date.now() + jitteredLifetime;

      // Bound by session expiry if present
      if (session) {
        const sessionExpiry = new Date(session.expiresAt).getTime();
        deadline = Math.min(deadline, sessionExpiry);
      }

      const ctx = {
        userId: user?.id ?? null,
        roles,
      };

      // Note: streamSSE sets Cache-Control: no-cache (the standard SSE value).
      // Setting no-store here has no effect because streamSSE overwrites it.
      // The no-cache value is correct for SSE per the SSE spec (prevents proxy caching).
      const sub = bus.subscribe(granted, ctx);

      return streamSSE(c, async (stream) => {
        stream.onAbort(() => {
          sub.close();
        });

        try {
          // Handshake — includes retry hint for the browser's reconnect logic
          await stream.writeSSE({
            event: "spine.connected",
            data: JSON.stringify({ granted, denied }),
            retry: jitteredRetry,
          });

          // Event loop — runs until deadline or client disconnect
          while (Date.now() < deadline) {
            const events = await sub.next(heartbeatMs);
            if (events.length === 0) {
              // Heartbeat comment — keeps the connection alive and proves Caddy flushes
              await stream.write(": heartbeat\n\n");
            } else {
              for (const event of events) {
                await stream.writeSSE({
                  event: event.type,
                  data: JSON.stringify(event),
                });
              }
            }
          }

          rootLogger.debug(
            { userId: ctx.userId, granted, deadline },
            "SSE connection reached lifetime deadline",
          );
        } finally {
          sub.close();
        }
      });
    },
  );

  return app;
}

// ── Singleton ──

/** Production SSE routes — mounted at /api/sse in app.ts. */
export const sseRoutes = createSseRoutes();
