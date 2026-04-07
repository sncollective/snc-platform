import type React from "react";
import { Users } from "lucide-react";
import type { CreatorListResponse } from "@snc/shared";

import { CreatorCard } from "../creator/creator-card.js";
import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./featured-creators.module.css";

// ── Public API ──

interface FeaturedCreatorsProps {
  readonly creators: readonly CreatorListResponse["items"][number][];
}

/** Render the featured creators section on the landing page. */
export function FeaturedCreators({
  creators,
}: FeaturedCreatorsProps): React.ReactElement {
  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.heading}>Creators</h2>
      {creators.length === 0 ? (
        <div className={sectionStyles.empty}>
          <Users size={32} aria-hidden="true" />
          <p>No creators yet — be the first!</p>
        </div>
      ) : (
        <div
          className={styles.scrollContainer}
          role="region"
          aria-label="Creators"
          tabIndex={0}
        >
          {creators.map((creator) => (
            <div key={creator.id} className={styles.scrollItem}>
              <CreatorCard creator={creator} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
