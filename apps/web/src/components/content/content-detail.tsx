import type React from "react";
import type { FeedItem } from "@snc/shared";

import { VideoDetail } from "./video-detail.js";
import { AudioDetail } from "./audio-detail.js";
import { WrittenDetail } from "./written-detail.js";
import styles from "./content-detail.module.css";

// ── Public Types ──

export interface ContentDetailProps {
  readonly item: FeedItem;
}

// ── Private Helpers ──

function isContentLocked(item: FeedItem): boolean {
  return item.visibility === "subscribers" && item.mediaUrl === null && item.body === null;
}

// ── Public API ──

export function ContentDetail({ item }: ContentDetailProps): React.ReactElement {
  const locked = isContentLocked(item);

  return (
    <article className={styles.detailPage}>
      {item.type === "video" && <VideoDetail item={item} locked={locked} />}
      {item.type === "audio" && <AudioDetail item={item} locked={locked} />}
      {item.type === "written" && <WrittenDetail item={item} locked={locked} />}
    </article>
  );
}
