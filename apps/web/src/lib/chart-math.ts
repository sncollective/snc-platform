// ── Constants ──

export const MONTH_LABELS: readonly string[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── Types ──

export interface MonthlyDataItem {
  readonly month: string;
  readonly actualCo2Kg: number;
  readonly projectedCo2Kg: number;
  readonly offsetCo2Kg: number;
}

export interface ChartLines {
  readonly months: readonly string[];
  readonly actualUse: readonly number[];
  readonly projectedUse: readonly number[];
  readonly offsets: readonly number[];
  readonly net: readonly number[];
}

// ── Formatting Helpers ──

/**
 * Formats a CO2 kilogram value for chart axis labels and tooltips.
 * Always displays in kg with variable precision (3 decimals for tiny values,
 * 1 decimal for small, integer for large).
 *
 * For summary/card display that auto-scales between g and kg, see
 * `formatCo2` in `format.ts`.
 */
export function formatCo2AxisLabel(kg: number): string {
  if (kg === 0) return "0 kg";
  if (Math.abs(kg) < 0.1) return `${kg.toFixed(3)} kg`;
  if (Math.abs(kg) < 10) return `${kg.toFixed(1)} kg`;
  return `${Math.round(kg)} kg`;
}

/** Format a "YYYY-MM" string into "Mon YYYY" (e.g., "Jan 2026"). */
export function formatMonthLabel(month: string): string {
  const [year = "", m = ""] = month.split("-");
  return `${MONTH_LABELS[Number(m) - 1] ?? ""} ${year}`;
}

/** Format a "YYYY-MM" string into abbreviated "Mon 'YY" (e.g., "Jan '26"). */
export function formatMonthShort(month: string): string {
  const [year = "", m = ""] = month.split("-");
  return `${MONTH_LABELS[Number(m) - 1] ?? ""} '${year.slice(2)}`;
}

// ── Chart Line Computation ──

/** Compute cumulative chart lines (actual, projected, offsets, net) from monthly data. */
export function computeChartLines(data: readonly MonthlyDataItem[]): ChartLines {
  const months: string[] = [];
  const actualUse: number[] = [];
  const projectedUse: number[] = [];
  const offsets: number[] = [];
  const net: number[] = [];

  let cumActual = 0;
  let cumProjected = 0;
  let cumOffset = 0;

  for (const d of data) {
    cumActual += d.actualCo2Kg;
    cumProjected += d.actualCo2Kg + d.projectedCo2Kg;
    cumOffset += d.offsetCo2Kg;

    months.push(d.month);
    actualUse.push(cumActual);
    projectedUse.push(cumProjected);
    offsets.push(cumOffset);
    net.push(cumProjected - cumOffset);
  }

  return { months, actualUse, projectedUse, offsets, net };
}

// ── Nice Axis Ticks ──

/** Find the nearest "nice" number (1, 2, 5, or 10 scaled) for axis labeling. */
export function niceNum(value: number, round: boolean): number {
  const exp = Math.floor(Math.log10(value));
  const frac = value / 10 ** exp;
  let nice: number;
  if (round) {
    nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  } else {
    nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  }
  return nice * 10 ** exp;
}

/** Compute nice axis tick bounds and step size for the given data range. */
export function niceTicks(
  rawMin: number,
  rawMax: number,
  tickCount: number,
): { min: number; max: number; step: number } {
  if (rawMin === rawMax) {
    const fallback = rawMin === 0 ? 0.01 : Math.abs(rawMin) * 0.5;
    return niceTicks(rawMin - fallback, rawMax + fallback, tickCount);
  }
  const range = niceNum(rawMax - rawMin, false);
  const step = niceNum(range / (tickCount - 1), true);
  const niceMin = Math.floor(rawMin / step) * step;
  const niceMax = Math.ceil(rawMax / step) * step;
  return { min: niceMin, max: niceMax, step };
}
