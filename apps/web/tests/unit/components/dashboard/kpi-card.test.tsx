import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { KpiCard } from "../../../../src/components/dashboard/kpi-card.js";

describe("KpiCard", () => {
  it("renders label text", () => {
    render(<KpiCard label="Revenue This Month" value="$50.00" />);
    expect(screen.getByText("Revenue This Month")).toBeInTheDocument();
  });

  it("renders value text", () => {
    render(<KpiCard label="Revenue" value="$50.00" />);
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("renders sublabel when provided", () => {
    render(
      <KpiCard label="Revenue" value="$50.00" sublabel="from 12 subscriptions" />,
    );
    expect(screen.getByText("from 12 subscriptions")).toBeInTheDocument();
  });

  it("does not render sublabel when not provided", () => {
    render(<KpiCard label="Revenue" value="$50.00" />);
    expect(screen.queryByText("from 12 subscriptions")).toBeNull();
    // Card has exactly 2 child elements (label + value, no sublabel)
    const card = screen.getByText("Revenue").parentElement;
    expect(card?.childElementCount).toBe(2);
  });

  it("shows loading placeholder when isLoading is true", () => {
    render(<KpiCard label="Revenue" value="$50.00" isLoading />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(screen.queryByText("$50.00")).toBeNull();
  });

  it("shows label even when loading", () => {
    render(<KpiCard label="Revenue" value="$50.00" isLoading />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });
});
