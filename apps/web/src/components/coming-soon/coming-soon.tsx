import { Link } from "@tanstack/react-router";
import type React from "react";
import type { FeatureFlag } from "@snc/shared";
import { FEATURE_LABELS } from "@snc/shared";

import styles from "./coming-soon.module.css";

// ── Public Types ──

export interface ComingSoonProps {
  readonly feature: FeatureFlag;
}

// ── Public API ──

export function ComingSoon({ feature }: ComingSoonProps): React.ReactElement {
  const { name, description } = FEATURE_LABELS[feature];

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{name} — Coming Soon</h1>
      <p className={styles.description}>{description}</p>
      <Link to="/" className={styles.backLink}>
        Back to Home
      </Link>
    </div>
  );
}
