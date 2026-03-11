import type React from "react";
import { Link } from "@tanstack/react-router";
import type { FeedResponse } from "@snc/shared";

import { ContentCard } from "../content/content-card.js";
import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./recent-content.module.css";

// ── Public API ──

interface RecentContentProps {
  readonly items: FeedResponse["items"];
}

export function RecentContent({
  items,
}: RecentContentProps): React.ReactElement {
  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.heading}>Recent Content</h2>
      {items.length === 0 ? (
        <p className={sectionStyles.loading}>
          No content yet — check back soon!
        </p>
      ) : (
        <>
          <div className="content-grid">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
          <Link to="/feed" className={styles.viewAll}>
            View all content →
          </Link>
        </>
      )}
    </section>
  );
}
