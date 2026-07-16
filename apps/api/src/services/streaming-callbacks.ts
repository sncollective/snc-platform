import { createHash, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { config } from "../config.js";
import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { channels, streamSessions } from "../db/schema/streaming.schema.js";
import { rootLogger } from "../logging/logger.js";
import { dispatchNotification } from "./notification-dispatch.js";
import { getActiveSimulcastUrls } from "./simulcast.js";
import { lookupCreatorByKeyHash } from "./stream-keys.js";
import {
  ensureLiveChannelWithChat,
  extractStreamKey,
  teardownLiveChannel,
} from "./stream-lifecycle.js";
import { closeSession, openSession } from "./stream-sessions.js";

// ── Callback Schemas ──

export const SrsOnPublishSchema = z.object({
  action: z.literal("on_publish"),
  client_id: z.string(),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  stream: z.string(),
  param: z.string().optional().default(""),
});

export const SrsOnUnpublishSchema = z.object({
  action: z.literal("on_unpublish"),
  client_id: z.string(),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  stream: z.string(),
  param: z.string().optional().default(""),
});

export const SrsOnForwardSchema = z.object({
  action: z.literal("on_forward"),
  server_id: z.string(),
  client_id: z.string(),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  tcUrl: z.string(),
  stream: z.string(),
  param: z.string().optional().default(""),
});

type SrsOnPublish = z.infer<typeof SrsOnPublishSchema>;
type SrsOnUnpublish = z.infer<typeof SrsOnUnpublishSchema>;
type SrsOnForward = z.infer<typeof SrsOnForwardSchema>;

type SrsCallbackResponse =
  | { readonly status: 200; readonly body: { readonly code: 0; readonly data?: { readonly urls: string[] } } }
  | { readonly status: 403; readonly body: { readonly code: 1 } };

const SAFE_SRS_CALLBACK_PAYLOAD_FIELDS = [
  "action",
  "client_id",
  "ip",
  "vhost",
  "app",
  "stream",
  "stream_id",
] as const;

/** Keep audit metadata from SRS callbacks while dropping `param`, which carries RTMP stream keys. */
const redactSrsCallbackPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const safePayload: Record<string, unknown> = {};
  for (const field of SAFE_SRS_CALLBACK_PAYLOAD_FIELDS) {
    if (payload[field] !== undefined) {
      safePayload[field] = payload[field];
    }
  }
  return safePayload;
};

/** Check if a stream name belongs to an active playout or broadcast channel (never forward these). */
const isPlayoutStream = async (streamName: string): Promise<boolean> => {
  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.srsStreamName, streamName),
        eq(channels.isActive, true),
      ),
    );
  return channel !== undefined;
};

/** Validate an SRS publish callback, open creator sessions, and fan out go-live side effects. */
export const handleSrsOnPublish = async (
  body: SrsOnPublish,
): Promise<SrsCallbackResponse> => {
  const rawKey = extractStreamKey(body.param);

  // Playout key: Liquidsoap authenticates with a dedicated key.
  // No session or channel creation — playout channels are pre-seeded.
  const playoutKey = config.PLAYOUT_STREAM_KEY;
  if (playoutKey && rawKey) {
    const a = Buffer.from(playoutKey, "utf-8");
    const b = Buffer.from(rawKey, "utf-8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      rootLogger.info(
        { event: "stream_key_accepted", ip: body.ip, stream: body.stream, source: "playout" },
        "Playout stream key accepted",
      );
      return { status: 200, body: { code: 0 } };
    }
  }

  // Per-creator key validation
  if (!rawKey) {
    rootLogger.warn(
      {
        event: "stream_key_rejected",
        ip: body.ip,
        stream: body.stream,
        reason: "missing_key",
      },
      "Stream key rejected",
    );
    return { status: 403, body: { code: 1 } };
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const lookup = await lookupCreatorByKeyHash(keyHash);

  if (!lookup) {
    rootLogger.warn(
      {
        event: "stream_key_rejected",
        ip: body.ip,
        stream: body.stream,
        reason: "invalid_key",
      },
      "Stream key rejected",
    );
    return { status: 403, body: { code: 1 } };
  }

  rootLogger.info(
    { event: "stream_key_accepted", ip: body.ip, stream: body.stream, source: "creator", creatorId: lookup.creatorId, keyId: lookup.keyId },
    "Creator stream key accepted",
  );

  const session = await openSession({
    creatorId: lookup.creatorId,
    streamKeyId: lookup.keyId,
    srsClientId: body.client_id,
    srsStreamName: body.stream,
    callbackPayload: redactSrsCallbackPayload(body),
  });

  // Create live channel + channel chat room (best-effort — don't block SRS callback)
  if (session.ok) {
    await ensureLiveChannelWithChat(lookup.creatorId, session.value.sessionId, body.stream);

    // Fetch creator profile for notification payload
    const [profile] = await db
      .select({ displayName: creatorProfiles.displayName, handle: creatorProfiles.handle })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, lookup.creatorId));

    // Fire-and-forget go-live notification
    void dispatchNotification({
      eventType: "go_live",
      creatorId: lookup.creatorId,
      payload: {
        creatorName: profile?.displayName ?? "A creator",
        creatorId: lookup.creatorId,
        liveUrl: `${config.BETTER_AUTH_URL}/live`,
      },
    });
  }

  return { status: 200, body: { code: 0 } };
};

/** Close an SRS stream session and tear down the live channel side effects. */
export const handleSrsOnUnpublish = async (
  body: SrsOnUnpublish,
): Promise<SrsCallbackResponse> => {
  await closeSession({
    srsClientId: body.client_id,
    callbackPayload: redactSrsCallbackPayload(body),
  });

  // Deactivate live channel and close channel chat room (best-effort)
  await teardownLiveChannel(body.client_id);

  return { status: 200, body: { code: 0 } };
};

/** Resolve SRS forward destinations for creator publishes, playout publishes, or unknown streams. */
export const handleSrsOnForward = async (
  body: SrsOnForward,
): Promise<SrsCallbackResponse> => {
  // Session lookup discriminates creator publishes from Liquidsoap-originated playout publishes.
  // Creator publishes carry a validated-stream-key session row written by on_publish;
  // Liquidsoap publishes do not. Classifying by srsClientId avoids collisions with
  // live-takeover channel rows that share a stream name with the creator's publish.
  const [session] = await db
    .select({ creatorId: streamSessions.creatorId })
    .from(streamSessions)
    .where(
      and(
        eq(streamSessions.srsClientId, body.client_id),
        isNull(streamSessions.endedAt),
      ),
    );

  if (session) {
    const urls: string[] = [];
    if (config.LIQUIDSOAP_RTMP_URL) {
      urls.push(config.LIQUIDSOAP_RTMP_URL);
    }
    const creatorUrls = await getActiveSimulcastUrls(session.creatorId);
    urls.push(...creatorUrls);
    rootLogger.info(
      { event: "on_forward_creator", clientId: body.client_id, stream: body.stream, creatorId: session.creatorId, urlCount: urls.length },
      "on_forward creator branch",
    );
    return { status: 200, body: { code: 0, data: { urls } } };
  }

  // No session — Liquidsoap publishing a playout channel. Platform destinations only; no Liquidsoap URL (loop prevention).
  if (await isPlayoutStream(body.stream)) {
    const urls = await getActiveSimulcastUrls();
    rootLogger.info(
      { event: "on_forward_playout", clientId: body.client_id, stream: body.stream, urlCount: urls.length },
      "on_forward playout branch",
    );
    return { status: 200, body: { code: 0, data: { urls } } };
  }

  // Unknown publish — no session, not a known playout stream. SRS still serves native HLS.
  rootLogger.warn(
    { event: "on_forward_unknown", clientId: body.client_id, stream: body.stream },
    "on_forward received for publish with no session and no playout match",
  );
  return { status: 200, body: { code: 0, data: { urls: [] } } };
};
