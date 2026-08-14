import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";
import { RouteVoiceScope } from "../../../src/lib/route-voice/route-voice.js";

// ── Hoisted Mocks ──

const { mockIsFeatureEnabled } = vi.hoisted(() => ({
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiMutate: vi.fn(),
  apiGet: vi.fn(),
  throwIfNotOk: vi.fn(),
}));

// ── Component Under Test ──

const StudioPage = extractRouteComponent(() => import("../../../src/routes/studio.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
});

// ── Tests ──

describe("StudioPage", () => {
  it("renders the studio hero heading when booking feature is enabled", () => {
    render(<StudioPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "S/NC Studio" }),
    ).toBeInTheDocument();
  });

  it("renders all 4 service section headings when booking feature is enabled", () => {
    render(<StudioPage />);

    // Use level:2 to disambiguate from the Equipment category "Recording" heading (level:3)
    expect(screen.getByRole("heading", { level: 2, name: "Recording" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Podcast Production" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Practice Space" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Venue Hire" })).toBeInTheDocument();
  });

  it("renders the Equipment section when booking feature is enabled", () => {
    render(<StudioPage />);

    expect(screen.getByRole("heading", { name: "Equipment" })).toBeInTheDocument();
  });

  it("renders the inquiry form when booking feature is enabled", () => {
    render(<StudioPage />);

    expect(screen.getByRole("heading", { name: "Get in Touch" })).toBeInTheDocument();
  });

  it("keeps the Coming Soon render inside the Studio route boundary", () => {
    mockIsFeatureEnabled.mockImplementation((flag: string) => flag !== "booking");

    render(
      <RouteVoiceScope routeDefault="studio">
        <StudioPage />
      </RouteVoiceScope>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Studio — Coming Soon" });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("[data-route]")).toHaveAttribute("data-route", "studio");
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });
});
