import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { EmissionsChart } from "../../../../src/components/emissions/emissions-chart.js";

// computeChartLines tests have moved to tests/unit/lib/chart-math.test.ts

describe("EmissionsChart", () => {
  const makeData = (
    overrides?: Partial<{ actualCo2Kg: number; projectedCo2Kg: number; offsetCo2Kg: number }>,
  ) => [
    { month: "2026-01", actualCo2Kg: 10, projectedCo2Kg: 0, offsetCo2Kg: 0, ...overrides },
    { month: "2026-02", actualCo2Kg: 5, projectedCo2Kg: 2, offsetCo2Kg: 0, ...overrides },
  ];

  it("renders SVG with accessible aria-label", () => {
    render(<EmissionsChart data={makeData()} />);
    const svg = screen.getByRole("img");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute(
      "aria-label",
      "Cumulative emissions chart showing 2 months of data",
    );
  });

  it("renders month labels on x-axis", () => {
    render(<EmissionsChart data={makeData()} />);
    expect(screen.getByText("Jan '26")).toBeInTheDocument();
    expect(screen.getByText("Feb '26")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    render(<EmissionsChart data={[]} />);
    expect(screen.getByText("No emissions data yet")).toBeInTheDocument();
  });

  it("shows empty state when all values are zero", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 0, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 0, projectedCo2Kg: 0, offsetCo2Kg: 0 },
    ];
    render(<EmissionsChart data={data} />);
    expect(screen.getByText("No emissions data yet")).toBeInTheDocument();
  });

  it("shows loading state with placeholder elements", () => {
    render(<EmissionsChart data={[]} isLoading />);
    expect(screen.queryByText("No emissions data yet")).toBeNull();
    const container = document.querySelector("[class*='loadingArea']")!;
    expect(container.childElementCount).toBe(6);
  });

  it("renders actual polyline, projected segments, offset dots, and net segments", () => {
    render(<EmissionsChart data={makeData()} />);
    const svg = screen.getByRole("img");
    // Only the actual-use polyline remains
    const polylines = svg.querySelectorAll("polyline");
    expect(polylines).toHaveLength(1);
    // Net + projected are drawn as individual line segments
    const lineSegments = svg.querySelectorAll("line:not([class*='gridline']):not([class*='zeroLine'])");
    expect(lineSegments.length).toBeGreaterThan(0);
  });

  it("renders offset dots only at months with offset data", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 10, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 5, projectedCo2Kg: 0, offsetCo2Kg: 3 },
    ];
    render(<EmissionsChart data={data} />);
    const svg = screen.getByRole("img");
    const offsetDots = svg.querySelectorAll("[class*='offsetDot']");
    expect(offsetDots).toHaveLength(1);
  });

  it("renders projected segments only where projected data exists", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 10, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 5, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-03", actualCo2Kg: 0, projectedCo2Kg: 4, offsetCo2Kg: 0 },
    ];
    render(<EmissionsChart data={data} />);
    const svg = screen.getByRole("img");
    const projectedSegments = svg.querySelectorAll("[class*='projectedLine']");
    // Only segment between month 2 and 3 (where projectedCo2Kg > 0 on at least one endpoint)
    expect(projectedSegments).toHaveLength(1);
  });

  it("net line uses green when cumulative net is negative", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 2, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 1, projectedCo2Kg: 0, offsetCo2Kg: 5 },
    ];
    render(<EmissionsChart data={data} />);
    const svg = screen.getByRole("img");
    const netNegativeLines = svg.querySelectorAll("[class*='netLineNegative']");
    expect(netNegativeLines.length).toBeGreaterThan(0);
  });

  it("net line uses red when cumulative net is positive", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 10, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 5, projectedCo2Kg: 0, offsetCo2Kg: 0 },
    ];
    render(<EmissionsChart data={data} />);
    const svg = screen.getByRole("img");
    const netPositiveLines = svg.querySelectorAll("[class*='netLinePositive']");
    expect(netPositiveLines.length).toBeGreaterThan(0);
  });

  it("uses dashed projected net for future months", () => {
    const data = [
      { month: "2026-01", actualCo2Kg: 10, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-02", actualCo2Kg: 5, projectedCo2Kg: 0, offsetCo2Kg: 0 },
      { month: "2026-03", actualCo2Kg: 0, projectedCo2Kg: 4, offsetCo2Kg: 0 },
    ];
    render(<EmissionsChart data={data} />);
    const svg = screen.getByRole("img");
    // Segment from month 1→2 is solid net, segment from 2→3 is projected net
    const solidNet = svg.querySelectorAll("[class*='netLinePositive'], [class*='netLineNegative']");
    const projectedNet = svg.querySelectorAll("[class*='projectedNetPositive'], [class*='projectedNetNegative']");
    expect(solidNet.length).toBeGreaterThan(0);
    expect(projectedNet.length).toBeGreaterThan(0);
  });

  it("legend displays all 5 line labels", () => {
    render(<EmissionsChart data={makeData()} />);
    expect(screen.getByText("Actual Use")).toBeInTheDocument();
    expect(screen.getByText("Projected Use")).toBeInTheDocument();
    expect(screen.getByText("Offsets")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
    expect(screen.getByText("Projected Net")).toBeInTheDocument();
  });

  it("shows tooltip on dot hover", () => {
    render(<EmissionsChart data={makeData()} />);
    const svg = screen.getByRole("img");
    const dots = svg.querySelectorAll("circle");

    // No tooltip initially
    expect(svg.querySelectorAll("rect")).toHaveLength(0);

    // Hover first dot
    fireEvent.mouseEnter(dots[0]!);
    expect(svg.querySelectorAll("rect")).toHaveLength(1);

    // Leave
    fireEvent.mouseLeave(dots[0]!);
    expect(svg.querySelectorAll("rect")).toHaveLength(0);
  });
});
