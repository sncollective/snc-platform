import type React from "react";

import { formatCo2 } from "../../lib/format.js";
import styles from "./breakdown-table.module.css";

// ── Constants ──

const SCOPE_LABELS: Record<number, string> = {
  1: "Direct",
  2: "Energy",
  3: "Value Chain",
};

// ── Public Types ──

export interface ScopeBreakdownProps {
  readonly data: { scope: number; co2Kg: number }[];
}

// ── Public API ──

export function ScopeBreakdown({
  data,
}: ScopeBreakdownProps): React.ReactElement {
  if (data.length === 0) {
    return <p className={styles.empty}>No scope data available</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Scope</th>
          <th>CO2</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.scope}>
            <td>Scope {row.scope} ({SCOPE_LABELS[row.scope] ?? "Unknown"})</td>
            <td>{formatCo2(row.co2Kg)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
