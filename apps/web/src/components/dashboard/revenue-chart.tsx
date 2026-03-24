import type React from "react";
import type { MonthlyRevenue } from "@snc/shared";

import { formatPrice } from "../../lib/format.js";
import { MONTH_LABELS } from "../../lib/chart-math.js";
import styles from "./revenue-chart.module.css";

// ── Constants ──

const MAX_BAR_HEIGHT = 200; // px — matches CSS .barRow height
const MIN_BAR_HEIGHT = 2;   // px — minimum for non-zero amounts
const LOADING_PLACEHOLDER_COUNT = 12;
const LOADING_HEIGHTS = [60, 80, 45, 90, 70, 55, 85, 65, 75, 50, 95, 40]; // percentage of max

// ── Public Types ──

export interface RevenueChartProps {
  readonly data: readonly MonthlyRevenue[];
  readonly isLoading?: boolean;
}

// ── Public API ──

export function RevenueChart({
  data,
  isLoading,
}: RevenueChartProps): React.ReactElement {
  if (isLoading === true) {
    return (
      <div className={styles.container}>
        <div className={styles.barRow}>
          {Array.from({ length: LOADING_PLACEHOLDER_COUNT }, (_, i) => (
            <div
              key={i}
              className={styles.barColumn}
            >
              <div
                className={styles.loadingBar}
                style={{ height: `${LOADING_HEIGHTS[i]}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxAmount = data.length === 0 ? 0 : Math.max(...data.map((d) => d.amount));

  if (data.length === 0 || maxAmount === 0) {
    return <div className={styles.empty}>No revenue data yet</div>;
  }

  function getBarHeight(amount: number): number {
    if (maxAmount === 0) return 0;
    if (amount === 0) return 0;
    const proportional = (amount / maxAmount) * MAX_BAR_HEIGHT;
    return Math.max(proportional, MIN_BAR_HEIGHT);
  }

  return (
    <div className={styles.container}>
      <div className={styles.barRow}>
        {data.map((entry) => (
          <div key={`${entry.year}-${entry.month}`} className={styles.barColumn}>
            <div
              className={styles.bar}
              style={{ height: `${getBarHeight(entry.amount)}px` }}
              role="img"
              aria-label={`${MONTH_LABELS[entry.month - 1]} ${entry.year}: ${formatPrice(entry.amount)}`}
            >
              <span className={styles.tooltip}>
                {formatPrice(entry.amount)}
              </span>
            </div>
            <span className={styles.monthLabel}>
              {MONTH_LABELS[entry.month - 1]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
