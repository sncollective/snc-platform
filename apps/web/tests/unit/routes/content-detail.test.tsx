import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockUseLoaderData, mockIsFeatureEnabled, mockContentDetail } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockContentDetail: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/components/content/content-detail.js", async () => {
  const React = await import("react");
  return {
    ContentDetail: (props: Record<string, unknown>) => {
      mockContentDetail(props);
      const item = props.item as { title: string };
      return React.createElement("div", { "data-testid": "content-detail" }, item.title);
    },
  };
});

// ── Component Under Test ──

const ContentDetailPage = extractRouteComponent(() => import("../../../src/routes/content/$contentId.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockUseLoaderData.mockReturnValue({
    item: makeMockFeedItem({ id: "c1", title: "Test Post" }),
    plans: [],
  });
});

// ── Tests ──

describe("ContentDetailPage", () => {
  it("renders ContentDetail component with loader data", () => {
    render(<ContentDetailPage />);

    expect(screen.getByTestId("content-detail")).toBeInTheDocument();
    expect(screen.getByText("Test Post")).toBeInTheDocument();
  });

  it("renders Coming Soon when content feature is disabled", () => {
    mockIsFeatureEnabled.mockImplementation((flag: string) => flag !== "content");
    mockUseLoaderData.mockReturnValue({ item: null, plans: [] });

    render(<ContentDetailPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Content — Coming Soon" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });
});
