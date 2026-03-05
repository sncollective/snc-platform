import type React from "react";

import { formatCo2 } from "../../lib/format.js";
import { KpiCard } from "../dashboard/kpi-card.js";
import styles from "./projection-summary.module.css";

// ── Constants ──

const PIKA_COST_PER_TONNE_USD = 30;

// ── Public Types ──

export interface ProjectionSummaryProps {
  readonly projectedGrossCo2Kg: number;
  readonly offsetCo2Kg: number;
  readonly doubleOffsetTargetCo2Kg: number;
  readonly additionalOffsetCo2Kg: number;
  readonly isLoading?: boolean | undefined;
}

// ── Public API ──

export function ProjectionSummary({
  projectedGrossCo2Kg,
  offsetCo2Kg,
  doubleOffsetTargetCo2Kg,
  additionalOffsetCo2Kg,
  isLoading,
}: ProjectionSummaryProps): React.ReactElement {
  const additionalDonation =
    (additionalOffsetCo2Kg / 1000) * PIKA_COST_PER_TONNE_USD;

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>2026 Projection</h3>
      <p className={styles.description}>
        Projected full-year emissions based on Jan–Mar actuals, with a 2&times;
        offset target. Additional Pika Project donation calculated at $30 per
        tonne CO2.
      </p>
      <div className={styles.kpiRow}>
        <KpiCard
          label="Projected Gross"
          value={formatCo2(projectedGrossCo2Kg)}
          sublabel="full year estimate"
          isLoading={isLoading}
        />
        <KpiCard
          label="Current Offsets"
          value={formatCo2(offsetCo2Kg)}
          isLoading={isLoading}
        />
        <KpiCard
          label="2x Offset Target"
          value={formatCo2(doubleOffsetTargetCo2Kg)}
          isLoading={isLoading}
        />
        <KpiCard
          label="Offset Gap"
          value={formatCo2(additionalOffsetCo2Kg)}
          isLoading={isLoading}
        />
      </div>
      {!isLoading && additionalOffsetCo2Kg > 0 && (
        <p className={styles.donationNote}>
          Additional Pika Project donation needed:{" "}
          <strong>${additionalDonation.toFixed(0)}</strong>
        </p>
      )}
      {!isLoading && additionalOffsetCo2Kg === 0 && (
        <p className={styles.donationNote}>
          Current offsets already meet or exceed the 2&times; target.
        </p>
      )}
    </div>
  );
}
