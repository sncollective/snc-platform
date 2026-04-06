import type { ReactNode } from "react";
import { Heading } from "./heading.js";
import styles from "./empty-state.module.css";

// ── Props ──

export interface EmptyStateProps {
  /** Optional icon element (e.g., a Lucide icon). Rendered at 50% opacity. */
  icon?: ReactNode;
  /** Optional heading rendered above the message. */
  title?: string;
  /** Primary empty-state message. */
  message: string;
  /** Optional action, typically a Button or link. Rendered below the message. */
  action?: ReactNode;
  /** Additional CSS class for layout overrides. */
  className?: string;
}

// ── Component ──

/**
 * Empty state display for list/feed views. Matches the visual style of the
 * shared `.empty` class in `listing-page.module.css` — flex column, centered,
 * muted text, icon at 50% opacity.
 *
 * Migration note: call sites using `<div className={listingStyles.empty}>` can
 * migrate to this component incrementally. Migration is a follow-up task.
 */
export function EmptyState({ icon, title, message, action, className }: EmptyStateProps) {
  const combinedClassName = className ? `${styles.emptyState} ${className}` : styles.emptyState;

  return (
    <div role="status" className={combinedClassName}>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      {title && (
        <Heading level={3} size="md" className={styles.title}>
          {title}
        </Heading>
      )}
      <p className={styles.message}>{message}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
