import type React from "react";

import { computeEquivalencies } from "../../lib/co2-equivalencies.js";
import styles from "./impact-cards.module.css";

// ── Public Types ──

export interface Co2EquivalenciesProps {
  readonly co2Kg: number;
}

// ── Public API ──

export function Co2Equivalencies({
  co2Kg,
}: Co2EquivalenciesProps): React.ReactElement | null {
  const items = computeEquivalencies(co2Kg);

  if (items.length === 0) return null;

  return (
    <div className={styles.grid} data-testid="co2-equivalencies">
      {items.map((item) => (
        <div key={item.label} className={styles.card}>
          <span className={`${styles.value} ${styles.valueError}`}>{item.value}</span>
          <span className={styles.unit}>{item.unit}</span>
          <span className={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
