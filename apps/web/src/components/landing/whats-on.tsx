import type React from "react";
import { Radio } from "lucide-react";
import type { ChannelListResponse } from "@snc/shared";

import { ChannelCard } from "./channel-card.js";
import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./whats-on.module.css";

// ── Public API ──

export interface WhatsOnProps {
  readonly channels: ChannelListResponse;
}

/** Render the "What's On" channel strip on the landing page. */
export function WhatsOn({ channels }: WhatsOnProps): React.ReactElement {
  if (channels.channels.length === 0) {
    return (
      <section className={sectionStyles.section}>
        <h2 className={sectionStyles.heading}>What's On</h2>
        <div className={sectionStyles.empty}>
          <Radio size={32} aria-hidden="true" />
          <p>Nothing playing right now — check back soon!</p>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.heading}>What's On</h2>
      <div
        className={styles.channelStrip}
        role="region"
        aria-label="Streaming channels"
        tabIndex={0}
      >
        {channels.channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </div>
    </section>
  );
}
