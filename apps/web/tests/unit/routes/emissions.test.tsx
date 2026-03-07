import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import {
  makeMockEmissionsBreakdown,
} from "../../helpers/emissions-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createAuthMock } from "../../helpers/auth-mock.js";
import { createFormatMock } from "../../helpers/format-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockFormatCo2 } = vi.hoisted(() => ({
  mockFormatCo2: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: vi.fn() }),
);

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({
    fetchAuthState: vi.fn().mockResolvedValue({
      user: { id: "u1", name: "Test" },
      roles: ["subscriber"],
    }),
  }),
);

vi.mock("../../../src/lib/format.js", () =>
  createFormatMock({ formatCo2: mockFormatCo2 }),
);

vi.mock("../../../src/lib/emissions.js", () => ({
  fetchEmissionsBreakdown: vi.fn(),
}));

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
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("EmissionsPage", () => {
  it("renders net summary hero card after loading", async () => {
    const { fetchEmissionsBreakdown } = await import(
      "../../../src/lib/emissions.js"
    );
    vi.mocked(fetchEmissionsBreakdown).mockResolvedValue(
      makeMockEmissionsBreakdown(),
    );

    render(<EmissionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("net-summary")).toBeInTheDocument();
    });
    const summary = screen.getByTestId("net-summary");
    expect(summary).toHaveTextContent("Net Emissions");
    expect(summary).toHaveTextContent("0.0 kg");
    expect(summary).toHaveTextContent("34.4 g");
    expect(summary).toHaveTextContent("10.0 g");
  });

  it("renders chart and breakdown tables", async () => {
    const { fetchEmissionsBreakdown } = await import(
      "../../../src/lib/emissions.js"
    );
    vi.mocked(fetchEmissionsBreakdown).mockResolvedValue(
      makeMockEmissionsBreakdown(),
    );

    render(<EmissionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("emissions-chart")).toHaveTextContent(
        "Chart rendered",
      );
    });
    expect(screen.getByTestId("scope-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("category-breakdown")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    const { fetchEmissionsBreakdown } = await import(
      "../../../src/lib/emissions.js"
    );
    vi.mocked(fetchEmissionsBreakdown).mockRejectedValue(
      new Error("Network error"),
    );

    render(<EmissionsPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("renders CO2 equivalencies section", async () => {
    const { fetchEmissionsBreakdown } = await import(
      "../../../src/lib/emissions.js"
    );
    vi.mocked(fetchEmissionsBreakdown).mockResolvedValue(
      makeMockEmissionsBreakdown(),
    );

    render(<EmissionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("co2-equivalencies")).toBeInTheDocument();
    });
  });

  it("renders offset impact section", async () => {
    const { fetchEmissionsBreakdown } = await import(
      "../../../src/lib/emissions.js"
    );
    vi.mocked(fetchEmissionsBreakdown).mockResolvedValue(
      makeMockEmissionsBreakdown(),
    );

    render(<EmissionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("offset-impact")).toBeInTheDocument();
    });
  });

  it("renders grouped Emissions heading with subsections", async () => {
    const { fetchEmissionsBreakdown } = await import(
      "../../../src/lib/emissions.js"
    );
    vi.mocked(fetchEmissionsBreakdown).mockResolvedValue(
      makeMockEmissionsBreakdown(),
    );

    render(<EmissionsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Emissions").length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByText("Cumulative")).toBeInTheDocument();
    expect(screen.getByText("By Scope")).toBeInTheDocument();
    expect(screen.getByText("By Category")).toBeInTheDocument();
  });

});
