import type React from "react";
import type { ContentType } from "@snc/shared";

import { SubscribeCta } from "./subscribe-cta.js";
import styles from "./content-footer.module.css";

// ── Public Types ──

export interface ContentFooterProps {
  readonly description: string | null;
  readonly creatorId?: string;
  readonly contentType?: ContentType;
  readonly locked?: boolean;
}

// ── Public API ──

export function ContentFooter({
  description,
  creatorId,
  contentType,
  locked,
}: ContentFooterProps): React.ReactElement | null {
  const showCta = locked === true && creatorId !== undefined && contentType !== undefined;
  const showDescription = description !== null && description !== undefined;

  if (!showCta && !showDescription) {
    return null;
  }

  return (
    <>
      {showCta && (
        <SubscribeCta creatorId={creatorId} contentType={contentType} />
      )}
      {showDescription && (
        <>
          <hr className={styles.divider} />
          <p className={styles.description}>{description}</p>
        </>
      )}
    </>
  );
}
