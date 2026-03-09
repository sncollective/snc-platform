// ── Constants ──

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── Types ──

export interface MonthlyDataItem {
  month: string;
  actualCo2Kg: number;
  projectedCo2Kg: number;
  offsetCo2Kg: number;
}

export interface ChartLines {
  months: string[];
  actualUse: number[];
  projectedUse: number[];
  offsets: number[];
  net: number[];
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

export function formatMonthLabel(month: string): string {
  const [year = "", m = ""] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${year}`;
}

export function formatMonthShort(month: string): string {
  const [year = "", m = ""] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} '${year.slice(2)}`;
}

// ── Chart Line Computation ──

export function computeChartLines(data: MonthlyDataItem[]): ChartLines {
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
