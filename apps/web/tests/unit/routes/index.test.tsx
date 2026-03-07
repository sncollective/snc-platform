import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRoute } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockUseLoaderData } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData, useNavigate: () => vi.fn() }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/components/landing/hero-section.js", async () => {
  const React = await import("react");
  return {
    HeroSection: () =>
      React.createElement("section", { "data-testid": "hero-section" }, "Hero"),
  };
});

vi.mock("../../../src/components/landing/featured-creators.js", async () => {
  const React = await import("react");
  return {
    FeaturedCreators: () =>
      React.createElement(
        "section",
        { "data-testid": "featured-creators" },
        "Creators",
      ),
  };
});

vi.mock("../../../src/components/landing/recent-content.js", async () => {
  const React = await import("react");
  return {
    RecentContent: () =>
      React.createElement(
        "section",
        { "data-testid": "recent-content" },
        "Content",
      ),
  };
});

vi.mock("../../../src/components/landing/landing-pricing.js", async () => {
  const React = await import("react");
  return {
    LandingPricing: () =>
      React.createElement(
        "section",
        { "data-testid": "landing-pricing" },
        "Pricing",
      ),
  };
});

// ── Component Under Test ──

const { component: LandingPage, route: RouteObject } = extractRoute(() => import("../../../src/routes/index.js"));

// ── Lifecycle ──

beforeEach(() => {
  mockUseLoaderData.mockReturnValue({
    creators: [],
    recentContent: [],
    plans: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("LandingPage", () => {
  it("renders the HeroSection", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
  });

  it("renders the FeaturedCreators section", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("featured-creators")).toBeInTheDocument();
  });

  it("renders the RecentContent section", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("recent-content")).toBeInTheDocument();
  });

  it("renders the LandingPricing section", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("landing-pricing")).toBeInTheDocument();
  });

  it("renders all four sections in correct order", () => {
    const { container } = render(<LandingPage />);
    const sections = container.querySelectorAll("section");

    expect(sections).toHaveLength(4);
    expect(sections[0]).toHaveAttribute("data-testid", "hero-section");
    expect(sections[1]).toHaveAttribute("data-testid", "featured-creators");
    expect(sections[2]).toHaveAttribute("data-testid", "recent-content");
    expect(sections[3]).toHaveAttribute("data-testid", "landing-pricing");
  });

  it("does not render a <main> tag (root layout provides it)", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector("main")).toBeNull();
  });

  it("does not render placeholder content", () => {
    render(<LandingPage />);
    expect(
      screen.queryByText("Welcome to S/NC — a worker-cooperative content platform."),
    ).toBeNull();
  });

  it("is accessible without authentication (no beforeLoad guard)", () => {
    expect(RouteObject).not.toHaveProperty("beforeLoad");
  });

  it("has a loader that pre-fetches landing data", () => {
    expect(RouteObject).toHaveProperty("loader");
  });
});
