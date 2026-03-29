import type { FeedItem } from "@snc/shared";

/** Human-readable badge labels for each content type. */
export const TYPE_BADGE_LABELS: Record<FeedItem["type"], string> = {
  video: "VIDEO",
  audio: "AUDIO",
  written: "POST",
};
