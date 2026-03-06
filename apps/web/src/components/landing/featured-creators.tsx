import type React from "react";
import type { CreatorListResponse } from "@snc/shared";

import { CreatorCard } from "../creator/creator-card.js";
import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./featured-creators.module.css";

// ── Public API ──

interface FeaturedCreatorsProps {
  creators: CreatorListResponse["items"];
}

export function FeaturedCreators({
  creators,
}: FeaturedCreatorsProps): React.ReactElement {
  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.heading}>Featured Creators</h2>
      {creators.length === 0 ? (
        <p className={sectionStyles.loading}>
          No creators yet — be the first!
        </p>
      ) : (
        <div
          className={styles.scrollContainer}
          role="region"
          aria-label="Featured creators"
          tabIndex={0}
        >
          {creators.map((creator) => (
            <div key={creator.userId} className={styles.scrollItem}>
              <CreatorCard creator={creator} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
