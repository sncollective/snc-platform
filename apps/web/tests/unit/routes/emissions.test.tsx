import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  makeMockEmissionsBreakdown,
} from "../../helpers/emissions-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createFormatMock } from "../../helpers/format-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockFormatCo2, mockUseLoaderData } = vi.hoisted(() => ({
  mockFormatCo2: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useLoaderData: mockUseLoaderData,
  }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/format.js", () =>
  createFormatMock({ formatCo2: mockFormatCo2 }),
);

vi.mock("../../../src/components/emissions/emissions-chart.js", async () => {
  const React = await import("react");
  return {
    EmissionsChart: ({ isLoading }: Record<string, unknown>) =>
      React.createElement(
        "div",
        { "data-testid": "emissions-chart" },
        isLoading === true ? "Loading chart..." : "Chart rendered",
      ),
  };
});

vi.mock("../../../src/components/emissions/co2-equivalencies.js", async () => {
  const React = await import("react");
  return {
    Co2Equivalencies: ({ co2Kg }: Record<string, unknown>) =>
      React.createElement(
        "div",
        { "data-testid": "co2-equivalencies" },
        `Equivalencies for ${co2Kg} kg`,
      ),
  };
});

vi.mock("../../../src/components/emissions/offset-impact.js", async () => {
  const React = await import("react");
  return {
    OffsetImpact: ({ offsetCo2Kg }: Record<string, unknown>) =>
      React.createElement(
        "div",
        { "data-testid": "offset-impact" },
        `Impact for ${offsetCo2Kg} kg`,
      ),
  };
});

vi.mock("../../../src/components/emissions/scope-breakdown.js", async () => {
  const React = await import("react");
  return {
    ScopeBreakdown: () =>
      React.createElement("div", { "data-testid": "scope-breakdown" }, "Scope table"),
  };
});

vi.mock("../../../src/components/emissions/category-breakdown.js", async () => {
  const React = await import("react");
  return {
    CategoryBreakdown: () =>
      React.createElement("div", { "data-testid": "category-breakdown" }, "Category table"),
  };
});

// ── Component Under Test ──

const EmissionsPage = extractRouteComponent(() => import("../../../src/routes/emissions.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockFormatCo2.mockImplementation((kg: number) => {
    if (kg === 0) return "0 g";
    if (kg < 1) return `${(kg * 1000).toFixed(1)} g`;
    return `${kg.toFixed(1)} kg`;
  });
  mockUseLoaderData.mockReturnValue(makeMockEmissionsBreakdown());
});


// ── Tests ──

describe("EmissionsPage", () => {
  it("renders net summary hero card from loader data", () => {
    render(<EmissionsPage />);

    const summary = screen.getByTestId("net-summary");
    expect(summary).toHaveTextContent("Net Emissions");
    expect(summary).toHaveTextContent("24.0 g");
    expect(summary).toHaveTextContent("34.4 g");
    expect(summary).toHaveTextContent("10.0 g");
  });

  it("renders chart and breakdown tables", () => {
    render(<EmissionsPage />);

    expect(screen.getByTestId("emissions-chart")).toHaveTextContent(
      "Chart rendered",
    );
    expect(screen.getByTestId("scope-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("category-breakdown")).toBeInTheDocument();
  });

  it("renders CO2 equivalencies section", () => {
    render(<EmissionsPage />);

    expect(screen.getByTestId("co2-equivalencies")).toBeInTheDocument();
  });

  it("renders offset impact section", () => {
    render(<EmissionsPage />);

    expect(screen.getByTestId("offset-impact")).toBeInTheDocument();
  });

  it("renders grouped Emissions heading with subsections", () => {
    render(<EmissionsPage />);

    expect(screen.getAllByText("Emissions").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Cumulative")).toBeInTheDocument();
    expect(screen.getByText("By Scope")).toBeInTheDocument();
    expect(screen.getByText("By Category")).toBeInTheDocument();
  });

  it("hides What Does This Mean section when grossCo2Kg is 0", () => {
    mockUseLoaderData.mockReturnValue(
      makeMockEmissionsBreakdown({
        summary: {
          grossCo2Kg: 0,
          offsetCo2Kg: 0,
          netCo2Kg: 0,
          entryCount: 0,
          latestDate: "2026-03-31",
          projectedGrossCo2Kg: 0,
          doubleOffsetTargetCo2Kg: 0,
          additionalOffsetCo2Kg: 0,
        },
      }),
    );

    render(<EmissionsPage />);

    expect(screen.queryByTestId("co2-equivalencies")).toBeNull();
    expect(screen.queryByTestId("offset-impact")).toBeNull();
  });
});
