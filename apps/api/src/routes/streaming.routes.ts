import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { StreamStatusSchema, type StreamStatus } from "@snc/shared";

import { getStreamStatus, type SrsStreamStatus } from "../services/srs.js";
import { config } from "../config.js";
import {
  ERROR_400,
  ERROR_403,
  ERROR_502,
  ERROR_503,
} from "../lib/openapi-errors.js";

// ── Private Helpers ──

const toStreamStatus = (srs: SrsStreamStatus): StreamStatus => ({
  isLive: srs.isLive,
  viewerCount: srs.viewerCount,
  lastLiveAt: null,
  hlsUrl: srs.hlsUrl,
});

// ── Callback Schemas ──

const SrsOnPublishSchema = z.object({
  action: z.literal("on_publish"),
  client_id: z.string(),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  stream: z.string(),
  param: z.string().optional().default(""),
});

// ── Private Helpers ──

const extractStreamKey = (param: string): string | null => {
  const match = param.match(/[?&]key=([^&]*)/);
  return match ? match[1] : null;
};

// ── Public API ──

export const streamingRoutes = new Hono();

// ── Status Endpoint ──

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

// ── SRS Callback: on_publish ──

streamingRoutes.post(
  "/callbacks/on-publish",
  describeRoute({
    description:
      "SRS on_publish callback — validates stream key before allowing publish",
    tags: ["streaming-callbacks"],
    responses: {
      200: { description: "Publish allowed" },
      400: ERROR_400,
      403: ERROR_403,
    },
  }),
  validator("json", SrsOnPublishSchema),
  (c) => {
    const body = c.req.valid("json" as never) as z.infer<
      typeof SrsOnPublishSchema
    >;
    const streamKey = extractStreamKey(body.param);
    const expectedKey = config.SRS_STREAM_KEY;

    if (!expectedKey) {
      return c.json({ code: 0 }, 200);
    }

    if (!streamKey || streamKey !== expectedKey) {
      return c.json({ code: 1 }, 403);
    }

    return c.json({ code: 0 }, 200);
  },
);
