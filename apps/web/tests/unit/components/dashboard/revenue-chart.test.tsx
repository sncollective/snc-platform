import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { RevenueChart } from "../../../../src/components/dashboard/revenue-chart.js";
import {
  makeMockRevenueResponse,
  makeMockMonthlyRevenue,
} from "../../../helpers/dashboard-fixtures.js";

describe("RevenueChart", () => {
  it("renders one bar per month entry", () => {
    const data = [
      makeMockMonthlyRevenue({ month: 1, year: 2026, amount: 3000 }),
      makeMockMonthlyRevenue({ month: 2, year: 2026, amount: 4000 }),
      makeMockMonthlyRevenue({ month: 3, year: 2026, amount: 5000 }),
    ];
    render(<RevenueChart data={data} />);
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("renders bars for all 12 months from fixture", () => {
    const data = makeMockRevenueResponse().monthly;
    render(<RevenueChart data={data} />);
    expect(screen.getAllByRole("img")).toHaveLength(12);
  });

  it("bar heights are proportional to amounts", () => {
    const data = [
      { month: 1, year: 2026, amount: 10000 },
      { month: 2, year: 2026, amount: 5000 },
    ];
    render(<RevenueChart data={data} />);
    const bars = screen.getAllByRole("img");
    expect(bars[0]).toHaveStyle({ height: "200px" });
    expect(bars[1]).toHaveStyle({ height: "100px" });
  });

  it("non-zero amounts have minimum 2px bar height", () => {
    const data = [
      { month: 1, year: 2026, amount: 10000 },
      { month: 2, year: 2026, amount: 1 },
    ];
    render(<RevenueChart data={data} />);
    const bars = screen.getAllByRole("img");
    expect(bars[1]).toHaveStyle({ height: "2px" });
  });

  it("renders month abbreviation labels", () => {
    const data = [
      makeMockMonthlyRevenue({ month: 1, year: 2026, amount: 3000 }),
      makeMockMonthlyRevenue({ month: 6, year: 2026, amount: 4000 }),
    ];
    render(<RevenueChart data={data} />);
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Jun")).toBeInTheDocument();
  });

  it("shows empty state when all amounts are zero", () => {
    const data = [
      { month: 1, year: 2026, amount: 0 },
      { month: 2, year: 2026, amount: 0 },
    ];
    render(<RevenueChart data={data} />);
    expect(screen.getByText("No revenue data yet")).toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("shows empty state when data array is empty", () => {
    render(<RevenueChart data={[]} />);
    expect(screen.getByText("No revenue data yet")).toBeInTheDocument();
  });

  it("shows loading state with placeholder bars", () => {
    render(<RevenueChart data={[]} isLoading />);
    expect(screen.queryByText("No revenue data yet")).toBeNull();
    // 12 loading bar columns rendered inside the barRow
    const container = document.querySelector("[class*='barRow']");
    expect(container?.childElementCount).toBe(12);
  });

  it("each bar has accessible aria-label with month, year, and formatted price", () => {
    const data = [{ month: 3, year: 2026, amount: 5000 }];
    render(<RevenueChart data={data} />);
    expect(screen.getByLabelText("Mar 2026: $50.00")).toBeInTheDocument();
  });

  it("bars with zero amount in mixed data get 0px height", () => {
    const data = [
      { month: 1, year: 2026, amount: 5000 },
      { month: 2, year: 2026, amount: 0 },
    ];
    render(<RevenueChart data={data} />);
    const bars = screen.getAllByRole("img");
    expect(bars[1]).toHaveStyle({ height: "0px" });
  });
});
