import { randomBytes } from "node:crypto";

import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

const logger = rootLogger.child({ service: "streaming-connect" });

// ── Types ──

export interface ConnectStartResult {
  authorizationUrl: string;
  state: string;
}

export interface StreamingCredentials {
  platform: "twitch" | "youtube";
  rtmpUrl: string;
  streamKey: string;
}

// ── CSRF State Store ──

interface StateEntry {
  userId: string;
  creatorId: string;
  platform: "twitch" | "youtube";
  expiresAt: number;
}

const stateStore = new Map<string, StateEntry>();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Private Helpers ──

/** Build the OAuth redirect URI for a given streaming platform. */
const buildRedirectUri = (platform: "twitch" | "youtube"): string =>
  `${config.BETTER_AUTH_URL}/api/streaming/connect/${platform}/callback`;

// ── Twitch ──

/**
 * Generate a Twitch OAuth authorization URL for streaming connect.
 * Returns the URL and a CSRF state token stored in memory.
 */
export function startTwitchConnect(
  userId: string,
  creatorId: string,
): Result<ConnectStartResult> {
  if (!config.TWITCH_CLIENT_ID) {
    return err(new AppError("TWITCH_NOT_CONFIGURED", "Twitch is not configured", 503));
  }

  const state = randomBytes(32).toString("hex");
  stateStore.set(state, {
    userId,
    creatorId,
    platform: "twitch",
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: config.TWITCH_CLIENT_ID,
    redirect_uri: buildRedirectUri("twitch"),
    response_type: "code",
    scope: "channel:read:stream_key user:read:email",
    state,
  });

  const authorizationUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  return ok({ authorizationUrl, state });
}

/**
 * Handle the Twitch OAuth callback: validate state, exchange code for token,
 * fetch user info and stream key. Returns RTMP URL and stream key.
 */
export async function handleTwitchCallback(
  code: string,
  state: string,
): Promise<Result<{ credentials: StreamingCredentials; userId: string; creatorId: string }>> {
  const entry = stateStore.get(state);
  if (!entry) {
    return err(new AppError("TWITCH_INVALID_STATE", "Invalid or expired OAuth state", 400));
  }
  if (Date.now() > entry.expiresAt) {
    stateStore.delete(state);
    return err(new AppError("TWITCH_STATE_EXPIRED", "OAuth state has expired", 400));
  }
  if (entry.platform !== "twitch") {
    stateStore.delete(state);
    return err(new AppError("TWITCH_WRONG_PLATFORM", "State was issued for a different platform", 400));
  }
  stateStore.delete(state);

  const { userId, creatorId } = entry;

  if (!config.TWITCH_CLIENT_ID || !config.TWITCH_CLIENT_SECRET) {
    return err(new AppError("TWITCH_NOT_CONFIGURED", "Twitch is not configured", 503));
  }

  // Exchange code for token
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.TWITCH_CLIENT_ID,
        client_secret: config.TWITCH_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: buildRedirectUri("twitch"),
      }),
    });
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Twitch token exchange fetch failed");
    return err(new AppError("TWITCH_UNREACHABLE", "Could not reach Twitch", 502));
  }

  if (!tokenResponse.ok) {
    logger.error({ status: tokenResponse.status }, "Twitch token exchange rejected");
    return err(new AppError("TWITCH_TOKEN_FAILED", "Failed to exchange authorization code", 502));
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };

  // Fetch user info to get broadcaster_id
  let userResponse: Response;
  try {
    userResponse = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Client-Id": config.TWITCH_CLIENT_ID,
      },
    });
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Twitch user fetch failed");
    return err(new AppError("TWITCH_UNREACHABLE", "Could not reach Twitch", 502));
  }

  if (!userResponse.ok) {
    return err(new AppError("TWITCH_USER_FAILED", "Failed to fetch Twitch user info", 502));
  }

  const userData = (await userResponse.json()) as { data: Array<{ id: string }> };
  const broadcasterId = userData.data[0]?.id;

  if (!broadcasterId) {
    return err(new AppError("TWITCH_USER_FAILED", "No Twitch user found", 502));
  }

  // Fetch stream key
  let keyResponse: Response;
  try {
    keyResponse = await fetch(
      `https://api.twitch.tv/helix/streams/key?broadcaster_id=${broadcasterId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Client-Id": config.TWITCH_CLIENT_ID,
        },
      },
    );
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Twitch stream key fetch failed");
    return err(new AppError("TWITCH_UNREACHABLE", "Could not reach Twitch", 502));
  }

  if (!keyResponse.ok) {
    return err(new AppError("TWITCH_KEY_FAILED", "Failed to fetch Twitch stream key", 502));
  }

  const keyData = (await keyResponse.json()) as { data: Array<{ stream_key: string }> };
  const streamKey = keyData.data[0]?.stream_key;

  if (!streamKey) {
    return err(new AppError("TWITCH_KEY_FAILED", "No stream key returned by Twitch", 502));
  }

  logger.info({ event: "twitch_connect_success", userId, creatorId }, "Twitch streaming connect completed");

  return ok({
    credentials: {
      platform: "twitch",
      rtmpUrl: "rtmp://live.twitch.tv/app",
      streamKey,
    },
    userId,
    creatorId,
  });
}

// ── YouTube ──

/**
 * Generate a YouTube OAuth authorization URL for streaming connect.
 * Returns the URL and a CSRF state token stored in memory.
 */
export function startYouTubeConnect(
  userId: string,
  creatorId: string,
): Result<ConnectStartResult> {
  if (!config.YOUTUBE_CLIENT_ID) {
    return err(new AppError("YOUTUBE_NOT_CONFIGURED", "YouTube is not configured", 503));
  }

  const state = randomBytes(32).toString("hex");
  stateStore.set(state, {
    userId,
    creatorId,
    platform: "youtube",
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: config.YOUTUBE_CLIENT_ID,
    redirect_uri: buildRedirectUri("youtube"),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.force-ssl",
    access_type: "offline",
    state,
  });

  const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return ok({ authorizationUrl, state });
}

/**
 * Handle the YouTube OAuth callback: validate state, exchange code for token,
 * fetch live stream ingestion info. Returns RTMP URL and stream key.
 */
export async function handleYouTubeCallback(
  code: string,
  state: string,
): Promise<Result<{ credentials: StreamingCredentials; userId: string; creatorId: string }>> {
  const entry = stateStore.get(state);
  if (!entry) {
    return err(new AppError("YOUTUBE_INVALID_STATE", "Invalid or expired OAuth state", 400));
  }
  if (Date.now() > entry.expiresAt) {
    stateStore.delete(state);
    return err(new AppError("YOUTUBE_STATE_EXPIRED", "OAuth state has expired", 400));
  }
  if (entry.platform !== "youtube") {
    stateStore.delete(state);
    return err(new AppError("YOUTUBE_WRONG_PLATFORM", "State was issued for a different platform", 400));
  }
  stateStore.delete(state);

  const { userId, creatorId } = entry;

  if (!config.YOUTUBE_CLIENT_ID || !config.YOUTUBE_CLIENT_SECRET) {
    return err(new AppError("YOUTUBE_NOT_CONFIGURED", "YouTube is not configured", 503));
  }

  // Exchange code for token
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.YOUTUBE_CLIENT_ID,
        client_secret: config.YOUTUBE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: buildRedirectUri("youtube"),
      }),
    });
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "YouTube token exchange fetch failed");
    return err(new AppError("YOUTUBE_UNREACHABLE", "Could not reach YouTube", 502));
  }

  if (!tokenResponse.ok) {
    logger.error({ status: tokenResponse.status }, "YouTube token exchange rejected");
    return err(new AppError("YOUTUBE_TOKEN_FAILED", "Failed to exchange authorization code", 502));
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };

  // Fetch live stream ingestion info
  let streamsResponse: Response;
  try {
    const streamsUrl = new URL("https://www.googleapis.com/youtube/v3/liveStreams");
    streamsUrl.searchParams.set("part", "cdn");
    streamsUrl.searchParams.set("mine", "true");

    streamsResponse = await fetch(streamsUrl.toString(), {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch (e) {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "YouTube live streams fetch failed");
    return err(new AppError("YOUTUBE_UNREACHABLE", "Could not reach YouTube", 502));
  }

  if (!streamsResponse.ok) {
    return err(new AppError("YOUTUBE_STREAMS_FAILED", "Failed to fetch YouTube live streams", 502));
  }

  const streamsData = (await streamsResponse.json()) as {
    items?: Array<{
      cdn?: {
        ingestionInfo?: {
          ingestionAddress?: string;
          streamName?: string;
        };
      };
    }>;
  };

  const firstStream = streamsData.items?.[0];
  const ingestionInfo = firstStream?.cdn?.ingestionInfo;

  if (!ingestionInfo?.ingestionAddress || !ingestionInfo?.streamName) {
    return err(new AppError("YOUTUBE_NO_STREAMS", "No YouTube live streams found for this account", 404));
  }

  logger.info({ event: "youtube_connect_success", userId, creatorId }, "YouTube streaming connect completed");

  return ok({
    credentials: {
      platform: "youtube",
      rtmpUrl: ingestionInfo.ingestionAddress,
      streamKey: ingestionInfo.streamName,
    },
    userId,
    creatorId,
  });
}

// ── Maintenance ──

/**
 * Remove expired CSRF states from the in-memory store.
 * Safe to call periodically — no-op if store is empty.
 */
export function cleanExpiredStates(): void {
  const now = Date.now();
  for (const [key, entry] of stateStore.entries()) {
    if (now > entry.expiresAt) {
      stateStore.delete(key);
    }
  }
}
