import type React from "react";

import { clsx } from "clsx/lite";

import { computeOffsetImpact } from "../../lib/offset-impact.js";
import styles from "./impact-cards.module.css";

// ── Public Types ──

export interface OffsetImpactProps {
  readonly offsetCo2Kg: number;
}

// ── Public API ──

export function OffsetImpact({
  offsetCo2Kg,
}: OffsetImpactProps): React.ReactElement | null {
  const cards = computeOffsetImpact(offsetCo2Kg);

  if (cards.length === 0) return null;

  return (
    <div className={styles.grid} data-testid="offset-impact">
      {cards.map((card) => (
        <div key={card.label} className={styles.card}>
          <span className={clsx(styles.value, styles.valueSuccess)}>{card.value}</span>
          <span className={styles.unit}>{card.unit}</span>
          <span className={styles.label}>{card.label}</span>
        </div>
      ))}
    </div>
  );
}
