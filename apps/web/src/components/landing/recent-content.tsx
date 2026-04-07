import type React from "react";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { FeedResponse } from "@snc/shared";

import { ContentCard } from "../content/content-card.js";
import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./recent-content.module.css";

interface RecentContentProps {
  readonly items: readonly FeedResponse["items"][number][];
}

/** Render the "Fresh Drops" section with hero card + supporting grid. */
export function RecentContent({ items }: RecentContentProps): React.ReactElement {
  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.heading}>Fresh Drops</h2>
      {items.length === 0 ? (
        <div className={sectionStyles.empty}>
          <FileText size={32} aria-hidden="true" />
          <p>No content yet — check back soon!</p>
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <div className={styles.heroSlot}>
              <ContentCard item={items[0]!} />
            </div>
          )}
          {items.length > 1 && (
            <div className="content-grid">
              {items.slice(1).map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          )}
          <Link to="/feed" className={styles.viewAll}>
            View all content →
          </Link>
        </>
      )}
    </section>
  );
}
