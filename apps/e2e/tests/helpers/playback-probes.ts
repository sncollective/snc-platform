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
 * Returns an empty segment list for a not-yet-ready manifest so Playwright `expect.poll`
 * can keep retrying without treating early 404/503 responses as hard failures.
 */
export const fetchHlsManifestSnapshot = async (
  request: APIRequestContext,
  manifestUrl: string,
): Promise<ManifestSnapshot> => {
  const response = await request.get(manifestUrl);
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
      segmentUris.push(absoluteSegmentUri(partUri, manifestUrl));
      continue;
    }

    if (line.startsWith("#EXTINF")) {
      nextLineIsSegment = true;
      continue;
    }

    if (line.startsWith("#")) continue;

    if (nextLineIsSegment) {
      segmentUris.push(absoluteSegmentUri(line, manifestUrl));
      nextLineIsSegment = false;
    }
  }

  return { status: response.status(), segmentUris };
};
