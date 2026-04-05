import type React from "react";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { FeedResponse } from "@snc/shared";

import { ContentCard } from "../content/content-card.js";
import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./recent-content.module.css";

// ── Public API ──

interface RecentContentProps {
  readonly items: readonly FeedResponse["items"][number][];
}

/** Render the recent content section on the landing page. */
export function RecentContent({
  items,
}: RecentContentProps): React.ReactElement {
  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.heading}>Recent Content</h2>
      {items.length === 0 ? (
        <div className={sectionStyles.empty}>
          <FileText size={32} aria-hidden="true" />
          <p>No content yet — check back soon!</p>
        </div>
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
