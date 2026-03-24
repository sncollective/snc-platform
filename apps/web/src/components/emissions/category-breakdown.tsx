import type React from "react";

import { formatCo2 } from "../../lib/format.js";
import styles from "./breakdown-table.module.css";

// ── Public Types ──

export interface CategoryBreakdownProps {
  readonly data: readonly { readonly category: string; readonly co2Kg: number }[];
}

// ── Public API ──

export function CategoryBreakdown({
  data,
}: CategoryBreakdownProps): React.ReactElement {
  if (data.length === 0) {
    return <p className={styles.empty}>No category data available</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Category</th>
          <th>CO2</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.category}>
            <td>{row.category}</td>
            <td>{formatCo2(row.co2Kg)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
