import { useState } from "react";
import type React from "react";

import styles from "./emissions-chart.module.css";

// ── Constants ──

const CHART_WIDTH = 800;
const CHART_HEIGHT = 280;
const PADDING = { top: 20, right: 30, bottom: 55, left: 55 };
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;
const DOT_RADIUS = 3;
const GRIDLINE_COUNT = 4;
const LOADING_PLACEHOLDER_COUNT = 6;

// ── Public Types ──

export interface MonthlyDataItem {
  month: string;
  actualCo2Kg: number;
  projectedCo2Kg: number;
  offsetCo2Kg: number;
}

export interface EmissionsChartProps {
  readonly data: MonthlyDataItem[];
  readonly isLoading?: boolean;
}

// ── Private Helpers ──

function formatCo2Kg(kg: number): string {
  if (kg === 0) return "0 kg";
  if (Math.abs(kg) < 0.1) return `${kg.toFixed(3)} kg`;
  if (Math.abs(kg) < 10) return `${kg.toFixed(1)} kg`;
  return `${Math.round(kg)} kg`;
}

function formatMonthLabel(month: string): string {
  const [year = "", m = ""] = month.split("-");
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${MONTHS[Number(m) - 1] ?? ""} ${year}`;
}

function formatMonthShort(month: string): string {
  const [year = "", m = ""] = month.split("-");
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${MONTHS[Number(m) - 1] ?? ""} '${year.slice(2)}`;
}

interface ChartLines {
  months: string[];
  actualUse: number[];
  projectedUse: number[];
  offsets: number[];
  net: number[];
}

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

function niceNum(value: number, round: boolean): number {
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

function niceTicks(
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

// ── Legend Items ──

const LEGEND_ITEMS = [
  { label: "Actual Use", className: "actualSwatch" },
  { label: "Projected Use", className: "projectedSwatch" },
  { label: "Offsets", className: "offsetSwatch" },
  { label: "Net", className: "netSwatch" },
  { label: "Projected Net", className: "projectedNetSwatch" },
] as const;

// ── Public API ──

export function EmissionsChart({
  data,
  isLoading,
}: EmissionsChartProps): React.ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading === true) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingArea}>
          {Array.from({ length: LOADING_PLACEHOLDER_COUNT }, (_, i) => (
            <div key={i} className={styles.loadingBar} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className={styles.empty}>No emissions data yet</div>;
  }

  const lines = computeChartLines(data);
  const allValues = [
    ...lines.actualUse,
    ...lines.projectedUse,
    ...lines.offsets.map((v) => -v),
    ...lines.net,
  ];
  const allZero = allValues.every((v) => v === 0);

  if (allZero) {
    return <div className={styles.empty}>No emissions data yet</div>;
  }

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const ticks = niceTicks(rawMin, rawMax, GRIDLINE_COUNT + 1);

  function xForIndex(i: number): number {
    if (lines.months.length === 1) return PADDING.left + PLOT_WIDTH / 2;
    return PADDING.left + (i / (lines.months.length - 1)) * PLOT_WIDTH;
  }

  function yForValue(value: number): number {
    const ratio = (value - ticks.min) / (ticks.max - ticks.min);
    return PADDING.top + PLOT_HEIGHT * (1 - ratio);
  }

  function makePolyline(values: number[]): string {
    return values.map((v, i) => `${xForIndex(i)},${yForValue(v)}`).join(" ");
  }

  const zeroY = yForValue(0);
  const showZeroLine = ticks.min < 0;

  const gridValues: number[] = [];
  for (let v = ticks.min; v <= ticks.max + ticks.step * 0.5; v += ticks.step) {
    gridValues.push(Math.round(v * 1e10) / 1e10);
  }

  const ariaLabel = `Cumulative emissions chart showing ${lines.months.length} month${lines.months.length === 1 ? "" : "s"} of data`;

  // Find the last month with actual (non-projected) data
  let lastActualIndex = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i]!.actualCo2Kg > 0) {
      lastActualIndex = i;
      break;
    }
  }

  // Net line segments — solid for actual months, dashed for projected months
  const netSegments: React.ReactElement[] = [];
  for (let i = 0; i < lines.net.length - 1; i++) {
    const isPositive = lines.net[i + 1]! > 0;
    const isProjected = i >= lastActualIndex;
    let className: string;
    if (isProjected) {
      className = isPositive ? styles.projectedNetPositive! : styles.projectedNetNegative!;
    } else {
      className = isPositive ? styles.netLinePositive! : styles.netLineNegative!;
    }
    netSegments.push(
      <line
        key={`net-${i}`}
        className={className}
        x1={xForIndex(i)}
        y1={yForValue(lines.net[i]!)}
        x2={xForIndex(i + 1)}
        y2={yForValue(lines.net[i + 1]!)}
      />,
    );
  }

  // Show every month label up to 12; skip for larger ranges
  const labelInterval = lines.months.length > 12
    ? Math.ceil(lines.months.length / 12)
    : 1;

  return (
    <div className={styles.container}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
      >
        {/* Gridlines + Y-axis labels */}
        {gridValues.map((v) => {
          const y = yForValue(v);
          return (
            <g key={v}>
              <line
                className={styles.gridline}
                x1={PADDING.left}
                y1={y}
                x2={CHART_WIDTH - PADDING.right}
                y2={y}
              />
              <text
                className={styles.axisLabel}
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
              >
                {formatCo2Kg(v)}
              </text>
            </g>
          );
        })}

        {/* Zero line */}
        {showZeroLine && (
          <line
            className={styles.zeroLine}
            x1={PADDING.left}
            y1={zeroY}
            x2={CHART_WIDTH - PADDING.right}
            y2={zeroY}
          />
        )}

        {/* Actual Use line — only up to the last month with actual data */}
        {lastActualIndex > 0 && (
          <polyline
            className={styles.actualLine}
            points={makePolyline(lines.actualUse.slice(0, lastActualIndex + 1))}
            fill="none"
          />
        )}

        {/* Projected Use line — only segments where projected data exists */}
        {lines.months.length > 1 &&
          data.map((_, i) => {
            if (i >= data.length - 1) return null;
            if (data[i]!.projectedCo2Kg <= 0 && data[i + 1]!.projectedCo2Kg <= 0) return null;
            return (
              <line
                key={`proj-${i}`}
                className={styles.projectedLine}
                x1={xForIndex(i)}
                y1={yForValue(lines.projectedUse[i]!)}
                x2={xForIndex(i + 1)}
                y2={yForValue(lines.projectedUse[i + 1]!)}
              />
            );
          })}

        {/* Offsets — discrete dots + labels at months with offset data */}
        {data.map((d, i) => {
          if (d.offsetCo2Kg <= 0) return null;
          const cy = yForValue(-lines.offsets[i]!);
          return (
            <g key={`offset-${i}`}>
              <circle
                className={styles.offsetDot}
                cx={xForIndex(i)}
                cy={cy}
                r={4}
              />
              <text
                className={styles.offsetLabel}
                x={xForIndex(i)}
                y={cy - 8}
                textAnchor="middle"
              >
                {formatCo2Kg(-lines.offsets[i]!)}
              </text>
            </g>
          );
        })}

        {/* Net line (segments colored by sign) */}
        {netSegments}

        {/* Hover targets (invisible circles along net line) */}
        {lines.net.map((v, i) => (
          <circle
            key={lines.months[i]!}
            className={styles.dot}
            cx={xForIndex(i)}
            cy={yForValue(v)}
            r={DOT_RADIUS}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* X-axis labels — short format, slanted */}
        {lines.months.map((month, i) => {
          if (i % labelInterval !== 0 && i !== lines.months.length - 1) return null;
          return (
            <text
              key={`label-${month}`}
              className={styles.axisLabel}
              x={xForIndex(i)}
              y={PADDING.top + PLOT_HEIGHT + 14}
              textAnchor="end"
              transform={`rotate(-45, ${xForIndex(i)}, ${PADDING.top + PLOT_HEIGHT + 14})`}
            >
              {formatMonthShort(month)}
            </text>
          );
        })}

        {/* Tooltip */}
        {hoveredIndex !== null && (
          <g>
            <rect
              className={styles.tooltipBg}
              x={xForIndex(hoveredIndex) - 70}
              y={Math.max(5, yForValue(lines.net[hoveredIndex]!) - 70)}
              width={140}
              height={60}
              rx={4}
            />
            <text
              className={styles.tooltipText}
              x={xForIndex(hoveredIndex)}
              y={Math.max(5, yForValue(lines.net[hoveredIndex]!) - 70) + 14}
              textAnchor="middle"
            >
              {formatMonthLabel(lines.months[hoveredIndex]!)}
            </text>
            <text
              className={styles.tooltipText}
              x={xForIndex(hoveredIndex)}
              y={Math.max(5, yForValue(lines.net[hoveredIndex]!) - 70) + 26}
              textAnchor="middle"
            >
              Actual: {formatCo2Kg(lines.actualUse[hoveredIndex]!)}
            </text>
            <text
              className={styles.tooltipText}
              x={xForIndex(hoveredIndex)}
              y={Math.max(5, yForValue(lines.net[hoveredIndex]!) - 70) + 38}
              textAnchor="middle"
            >
              Projected: {formatCo2Kg(lines.projectedUse[hoveredIndex]!)}
            </text>
            <text
              className={styles.tooltipText}
              x={xForIndex(hoveredIndex)}
              y={Math.max(5, yForValue(lines.net[hoveredIndex]!) - 70) + 50}
              textAnchor="middle"
            >
              Offsets: {formatCo2Kg(lines.offsets[hoveredIndex]!)} | Net: {formatCo2Kg(lines.net[hoveredIndex]!)}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className={styles.legend}>
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className={styles.legendItem}>
            <span className={styles[item.className]!} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
