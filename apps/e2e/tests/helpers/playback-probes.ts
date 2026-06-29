import type { APIRequestContext, APIResponse } from "@playwright/test";

import type {
  ChannelListResponse,
  ChannelQueueStatus,
  PlayoutQueueEntry,
} from "@snc/shared";

const HLS_PART_URI_PATTERN = /URI="([^"]+)"/;

type ManifestSnapshot = {
  status: number;
  segmentUris: string[];
};

const readJson = async <T>(response: APIResponse, action: string): Promise<T> => {
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`${action} failed with ${response.status()}: ${text}`);
  }
  return JSON.parse(text) as T;
};

const absoluteSegmentUri = (rawUri: string, manifestUrl: string): string => {
  try {
    return new URL(rawUri, manifestUrl).href;
  } catch {
    return rawUri;
  }
};

/** Queue creator-owned content through the same creator-scoped route the Programming UI uses. */
export const queueCreatorContent = async (
  request: APIRequestContext,
  channelId: string,
  contentId: string,
): Promise<PlayoutQueueEntry> => {
  const response = await request.post(`/api/creator/playout/channels/${channelId}/queue/items`, {
    data: { contentId, position: 1 },
  });
  return readJson<PlayoutQueueEntry>(response, "Queue creator content");
};

/** Creator queue-status probe allowed by the e2e black-box boundary for playback pipeline proof. */
export const fetchCreatorQueueStatus = async (
  request: APIRequestContext,
  channelId: string,
): Promise<ChannelQueueStatus> => {
  const response = await request.get(`/api/creator/playout/channels/${channelId}/queue`);
  return readJson<ChannelQueueStatus>(response, "Fetch creator queue status");
};

/** Resolve the externally visible HLS URL for a channel from the public streaming status surface. */
export const fetchChannelHlsUrl = async (
  request: APIRequestContext,
  channelId: string,
): Promise<string | null> => {
  const response = await request.get("/api/streaming/status");
  const status = await readJson<ChannelListResponse>(response, "Fetch streaming status");
  const channel = status.channels.find((candidate) => candidate.id === channelId);
  return channel?.hlsUrl ?? null;
};

/**
 * Fetch a media-playlist snapshot and extract segment-like URIs.
 *
 * SRS serves a master playlist at the channel `.m3u8` URL whose body is a
 * `#EXT-X-STREAM-INF` variant list pointing at a per-ctx media playlist. This
 * helper follows that variant URI (re-fetching until the media playlist is
 * available) before parsing `#EXTINF` segment lines, so the snapshot reflects
 * real media segments rather than the master playlist's single variant entry.
 *
 * Returns an empty segment list for a not-yet-ready manifest so Playwright
 * `expect.poll` can keep retrying without treating early 404/503 responses as
 * hard failures.
 */
export const fetchHlsManifestSnapshot = async (
  request: APIRequestContext,
  manifestUrl: string,
): Promise<ManifestSnapshot> => {
  const mediaPlaylistUrl = await resolveMediaPlaylistUrl(request, manifestUrl);
  if (mediaPlaylistUrl === null) {
    // Master playlist not yet available — caller retries via expect.poll.
    return { status: 404, segmentUris: [] };
  }

  const response = await request.get(mediaPlaylistUrl);
  if (!response.ok()) {
    return { status: response.status(), segmentUris: [] };
  }

  const body = await response.text();
  const segmentUris: string[] = [];
  let nextLineIsSegment = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const partUri = line.startsWith("#EXT-X-PART")
      ? HLS_PART_URI_PATTERN.exec(line)?.[1]
      : undefined;
    if (partUri) {
      segmentUris.push(absoluteSegmentUri(partUri, mediaPlaylistUrl));
      continue;
    }

    if (line.startsWith("#EXTINF")) {
      nextLineIsSegment = true;
      continue;
    }

    if (line.startsWith("#")) continue;

    if (nextLineIsSegment) {
      segmentUris.push(absoluteSegmentUri(line, mediaPlaylistUrl));
      nextLineIsSegment = false;
    }
  }

  return { status: response.status(), segmentUris };
};

/**
 * Resolve the media-playlist URL from a manifest URL.
 *
 * A master playlist (contains `#EXT-X-STREAM-INF` followed by a variant URI)
 * is followed to its media playlist. A media playlist (contains `#EXTINF`) is
 * returned as-is. Returns null when the manifest is not yet available so the
 * caller can retry.
 */
const resolveMediaPlaylistUrl = async (
  request: APIRequestContext,
  manifestUrl: string,
): Promise<string | null> => {
  const response = await request.get(manifestUrl);
  if (!response.ok()) {
    return null;
  }

  const body = await response.text();
  let variantUri: string | null = null;
  let expectVariantUri = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXT-X-STREAM-INF")) {
      expectVariantUri = true;
      continue;
    }

    // A media playlist already carries segments — no variant to follow.
    if (line.startsWith("#EXTINF")) {
      return manifestUrl;
    }

    if (line.startsWith("#")) continue;

    if (expectVariantUri) {
      variantUri = absoluteSegmentUri(line, manifestUrl);
      break;
    }
  }

  return variantUri;
};
