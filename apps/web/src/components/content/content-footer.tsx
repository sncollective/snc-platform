import type React from "react";
import type { ContentType, SubscriptionPlan } from "@snc/shared";

import { SubscribeCta } from "./subscribe-cta.js";
import styles from "./content-footer.module.css";

// ── Public Types ──

export interface ContentFooterProps {
  readonly description: string | null;
  readonly creatorId?: string;
  readonly contentType?: ContentType;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[] | undefined;
}

// ── Public API ──

/** Render an optional description paragraph and subscribe CTA below content detail views. Returns null when neither is applicable. */
export function ContentFooter({
  description,
  creatorId,
  contentType,
  locked,
  plans,
}: ContentFooterProps): React.ReactElement | null {
  const showCta = locked === true && creatorId !== undefined && contentType !== undefined;
  const showDescription = description !== null && description !== undefined;

  if (!showCta && !showDescription) {
    return null;
  }

  return (
    <>
      {showCta && (
        <SubscribeCta contentType={contentType} plans={plans ?? []} />
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
