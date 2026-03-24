import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import { StreamStatusSchema, type StreamStatus } from "@snc/shared";

import { getStreamStatus } from "../services/owncast.js";
import { ERROR_502, ERROR_503 } from "../lib/openapi-errors.js";

// ── Private Helpers ──

const toStreamStatus = (owncast: {
  online: boolean;
  viewerCount: number;
  lastConnectTime: string | null;
  lastDisconnectTime: string | null;
}): StreamStatus => ({
  isLive: owncast.online,
  viewerCount: owncast.viewerCount,
  lastLiveAt: owncast.online
    ? owncast.lastConnectTime
    : owncast.lastDisconnectTime,
});

// ── Public API ──

export const streamingRoutes = new Hono();

streamingRoutes.get(
  "/status",
  describeRoute({
    description: "Get current live stream status",
    tags: ["streaming"],
    responses: {
      200: {
        description: "Current stream status",
        content: {
          "application/json": { schema: resolver(StreamStatusSchema) },
        },
      },
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  async (c) => {
    const result = await getStreamStatus();
    if (!result.ok) throw result.error;

    return c.json(toStreamStatus(result.value));
  },
);
