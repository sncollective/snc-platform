import { useState } from "react";
import type React from "react";

import type { ChartLines, MonthlyDataItem } from "../../lib/chart-math.js";
import {
  computeChartLines,
  formatCo2AxisLabel,
  formatMonthLabel,
  formatMonthShort,
  niceTicks,
} from "../../lib/chart-math.js";

import styles from "./emissions-chart.module.css";

export type { MonthlyDataItem, ChartLines } from "../../lib/chart-math.js";
export { computeChartLines } from "../../lib/chart-math.js";

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

export interface EmissionsChartProps {
  readonly data: readonly MonthlyDataItem[];
  readonly isLoading?: boolean;
}

// ── Legend Items ──

const LEGEND_ITEMS = [
  { label: "Actual Use", className: "actualSwatch" },
  { label: "Projected Use", className: "projectedSwatch" },
  { label: "Offsets", className: "offsetSwatch" },
  { label: "Net", className: "netSwatch" },
  { label: "Projected Net", className: "projectedNetSwatch" },
] as const;

// ── Sub-component Props ──

interface ChartGridlinesProps {
  readonly gridValues: readonly number[];
  readonly yForValue: (value: number) => number;
  readonly showZeroLine: boolean;
  readonly zeroY: number;
}

interface ChartDataLinesProps {
  readonly data: readonly MonthlyDataItem[];
  readonly lines: ChartLines;
  readonly xForIndex: (i: number) => number;
  readonly yForValue: (value: number) => number;
  readonly makePolyline: (values: number[]) => string;
  readonly lastActualIndex: number;
  readonly netSegments: readonly React.ReactElement[];
  readonly labelInterval: number;
  readonly onActivate: (i: number) => void;
  readonly onDeactivate: () => void;
}

interface ChartTooltipProps {
  readonly lines: ChartLines;
  readonly activeIndex: number;
  readonly xForIndex: (i: number) => number;
  readonly yForValue: (value: number) => number;
}

// ── Presentational Sub-components ──

/** Render horizontal gridlines with y-axis labels, plus the zero baseline when the range spans negative values. */
function ChartGridlines({
  gridValues,
  yForValue,
  showZeroLine,
  zeroY,
}: ChartGridlinesProps): React.ReactElement {
  return (
    <>
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
              {formatCo2AxisLabel(v)}
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
    </>
  );
}

/** Render the plotted data: actual-use polyline, projected segments, offset dots, net segments, hover/focus targets, and x-axis labels. */
function ChartDataLines({
  data,
  lines,
  xForIndex,
  yForValue,
  makePolyline,
  lastActualIndex,
  netSegments,
  labelInterval,
  onActivate,
  onDeactivate,
}: ChartDataLinesProps): React.ReactElement {
  return (
    <>
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
              {formatCo2AxisLabel(-lines.offsets[i]!)}
            </text>
          </g>
        );
      })}

      {/* Net line (segments colored by sign) */}
      {netSegments}

      {/* Hover/focus targets (invisible circles along net line) */}
      {lines.net.map((v, i) => {
        const monthLabel = formatMonthLabel(lines.months[i]!);
        const dotAriaLabel = `${monthLabel}: Actual ${formatCo2AxisLabel(lines.actualUse[i]!)}, Projected ${formatCo2AxisLabel(lines.projectedUse[i]!)}, Offsets ${formatCo2AxisLabel(lines.offsets[i]!)}, Net ${formatCo2AxisLabel(v)}`;
        return (
          <circle
            key={lines.months[i]!}
            className={styles.dot}
            cx={xForIndex(i)}
            cy={yForValue(v)}
            r={DOT_RADIUS}
            tabIndex={0}
            role="button"
            aria-label={dotAriaLabel}
            onMouseEnter={() => onActivate(i)}
            onMouseLeave={() => onDeactivate()}
            onFocus={() => onActivate(i)}
            onBlur={() => onDeactivate()}
          />
        );
      })}

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
    </>
  );
}

/** Render the hover/focus tooltip for the active data point. */
function ChartTooltip({
  lines,
  activeIndex,
  xForIndex,
  yForValue,
}: ChartTooltipProps): React.ReactElement {
  return (
    <g>
      <rect
        className={styles.tooltipBg}
        x={xForIndex(activeIndex) - 70}
        y={Math.max(5, yForValue(lines.net[activeIndex]!) - 70)}
        width={140}
        height={60}
        rx={4}
      />
      <text
        className={styles.tooltipText}
        x={xForIndex(activeIndex)}
        y={Math.max(5, yForValue(lines.net[activeIndex]!) - 70) + 14}
        textAnchor="middle"
      >
        {formatMonthLabel(lines.months[activeIndex]!)}
      </text>
      <text
        className={styles.tooltipText}
        x={xForIndex(activeIndex)}
        y={Math.max(5, yForValue(lines.net[activeIndex]!) - 70) + 26}
        textAnchor="middle"
      >
        Actual: {formatCo2AxisLabel(lines.actualUse[activeIndex]!)}
      </text>
      <text
        className={styles.tooltipText}
        x={xForIndex(activeIndex)}
        y={Math.max(5, yForValue(lines.net[activeIndex]!) - 70) + 38}
        textAnchor="middle"
      >
        Projected: {formatCo2AxisLabel(lines.projectedUse[activeIndex]!)}
      </text>
      <text
        className={styles.tooltipText}
        x={xForIndex(activeIndex)}
        y={Math.max(5, yForValue(lines.net[activeIndex]!) - 70) + 50}
        textAnchor="middle"
      >
        Offsets: {formatCo2AxisLabel(lines.offsets[activeIndex]!)} | Net: {formatCo2AxisLabel(lines.net[activeIndex]!)}
      </text>
    </g>
  );
}

/** Render the chart legend (one swatch + label per line series). */
function ChartLegend(): React.ReactElement {
  return (
    <div className={styles.legend}>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className={styles.legendItem}>
          <span className={styles[item.className]!} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ── Public API ──

/** SVG line chart showing cumulative CO2 emissions over time with actual use, projected use, offset, and net lines. Includes hover/focus tooltips, an ARIA live region for screen readers, a legend, and loading/empty states. */
export function EmissionsChart({
  data,
  isLoading,
}: EmissionsChartProps): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
        <ChartGridlines
          gridValues={gridValues}
          yForValue={yForValue}
          showZeroLine={showZeroLine}
          zeroY={zeroY}
        />

        <ChartDataLines
          data={data}
          lines={lines}
          xForIndex={xForIndex}
          yForValue={yForValue}
          makePolyline={makePolyline}
          lastActualIndex={lastActualIndex}
          netSegments={netSegments}
          labelInterval={labelInterval}
          onActivate={setActiveIndex}
          onDeactivate={() => setActiveIndex(null)}
        />

        {/* Tooltip */}
        {activeIndex !== null && (
          <ChartTooltip
            lines={lines}
            activeIndex={activeIndex}
            xForIndex={xForIndex}
            yForValue={yForValue}
          />
        )}
      </svg>

      {/* ARIA live region — outside SVG for reliable screen-reader support */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {activeIndex !== null
          ? `${formatMonthLabel(lines.months[activeIndex]!)}: Actual ${formatCo2AxisLabel(lines.actualUse[activeIndex]!)}, Projected ${formatCo2AxisLabel(lines.projectedUse[activeIndex]!)}, Offsets ${formatCo2AxisLabel(lines.offsets[activeIndex]!)}, Net ${formatCo2AxisLabel(lines.net[activeIndex]!)}`
          : ""}
      </div>

      <ChartLegend />
    </div>
  );
}
