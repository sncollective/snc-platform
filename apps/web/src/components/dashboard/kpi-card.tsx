import type React from "react";

import styles from "./kpi-card.module.css";

// ── Public Types ──

export interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly sublabel?: string;
  readonly isLoading?: boolean | undefined;
  readonly valueClassName?: string;
}

// ── Public API ──

export function KpiCard({
  label,
  value,
  sublabel,
  isLoading,
  valueClassName,
}: KpiCardProps): React.ReactElement {
  const valueClass = valueClassName
    ? `${styles.value} ${valueClassName}`
    : styles.value;
  return (
    <div className={styles.card}>
      <p className={styles.label}>{label}</p>
      {isLoading === true ? (
        <div className={styles.placeholder} aria-label="Loading" />
      ) : (
        <p className={valueClass}>{value}</p>
      )}
      {sublabel !== undefined && <p className={styles.sublabel}>{sublabel}</p>}
    </div>
  );
}
