import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockMyCreatorItem } from "../../helpers/creator-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createAuthMock } from "../../helpers/auth-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockUseLoaderData, mockFetchAuthStateServer } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockFetchAuthStateServer: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData }),
);

vi.mock("../../../src/lib/auth.js", () => createAuthMock());

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
  fetchAuthStateServer: mockFetchAuthStateServer,
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

// ── Component Under Test ──

const MyCreatorsPage = extractRouteComponent(
  () => import("../../../src/routes/creators/mine.js"),
);

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseLoaderData.mockReturnValue({ items: [] });
  mockFetchAuthStateServer.mockResolvedValue({
    user: { id: "user_test123" },
    roles: ["stakeholder"],
  });
});

// ── Tests ──

describe("MyCreatorsPage", () => {
  it("shows empty state when no creators", () => {
    mockUseLoaderData.mockReturnValue({ items: [] });

    render(<MyCreatorsPage />);

    expect(
      screen.getByText("You don't have any creator pages yet."),
    ).toBeInTheDocument();
  });

  it("renders MyCreatorCard for each creator", () => {
    mockUseLoaderData.mockReturnValue({
      items: [
        makeMockMyCreatorItem({ id: "creator-1", displayName: "Alice Music" }),
        makeMockMyCreatorItem({ id: "creator-2", displayName: "Bob Beats" }),
      ],
    });

    render(<MyCreatorsPage />);

    expect(screen.getByText("Alice Music")).toBeInTheDocument();
    expect(screen.getByText("Bob Beats")).toBeInTheDocument();
  });

  it("renders heading 'My Creators'", () => {
    render(<MyCreatorsPage />);

    expect(screen.getByRole("heading", { name: "My Creators" })).toBeInTheDocument();
  });

  it("each card shows the user's role badge", () => {
    mockUseLoaderData.mockReturnValue({
      items: [
        makeMockMyCreatorItem({ id: "creator-1", memberRole: "owner" }),
        makeMockMyCreatorItem({ id: "creator-2", displayName: "Bob Beats", memberRole: "editor" }),
      ],
    });

    render(<MyCreatorsPage />);

    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("editor")).toBeInTheDocument();
  });

  it("each card has a Manage link", () => {
    mockUseLoaderData.mockReturnValue({
      items: [
        makeMockMyCreatorItem({ id: "creator-1", displayName: "Alice Music" }),
      ],
    });

    render(<MyCreatorsPage />);

    const manageLinks = screen.getAllByRole("link", { name: "Manage" });
    expect(manageLinks).toHaveLength(1);
    expect(manageLinks[0]).toHaveAttribute("href", "/creators/creator-1/manage");
  });

  it("browse creators link is shown in empty state", () => {
    mockUseLoaderData.mockReturnValue({ items: [] });

    render(<MyCreatorsPage />);

    expect(screen.getByRole("link", { name: "Browse creators" })).toHaveAttribute(
      "href",
      "/creators",
    );
  });
});
