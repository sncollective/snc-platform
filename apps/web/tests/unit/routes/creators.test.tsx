import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCreatorListItem, makeMockCreatorProfileResponse } from "../../helpers/creator-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockUseLoaderData, mockIsFeatureEnabled, mockFetchAuthState, mockNavigate, mockCreateCreatorEntity } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockFetchAuthState: vi.fn(),
  mockNavigate: vi.fn(),
  mockCreateCreatorEntity: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData, useNavigate: () => mockNavigate }),
);

vi.mock("../../../src/lib/creator.js", () => ({
  createCreatorEntity: mockCreateCreatorEntity,
}));

vi.mock("../../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/lib/auth.js", () => ({
  fetchAuthState: mockFetchAuthState,
  useSession: vi.fn(() => ({ data: null })),
  useAuthExtras: vi.fn(() => ({ roles: [], isPatron: false })),
  hasRole: vi.fn(),
}));

// ── Component Under Test ──

const CreatorsPage = extractRouteComponent(() => import("../../../src/routes/creators/index.js"));

// ── Private Constants (mirrored from route) ──

const VIEW_MODE_KEY = "snc-creators-view-mode";

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockFetchAuthState.mockResolvedValue({ user: null, roles: [], isPatron: false });
  mockCreateCreatorEntity.mockResolvedValue(makeMockCreatorProfileResponse());
  mockNavigate.mockReset();
  localStorage.removeItem(VIEW_MODE_KEY);
  mockUseLoaderData.mockReturnValue({
    items: [
      makeMockCreatorListItem({
        id: "creator-1",
        displayName: "Alice Music",
      }),
      makeMockCreatorListItem({
        id: "creator-2",
        displayName: "Bob Beats",
      }),
    ],
    nextCursor: null,
  });

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { status: 200 },
        ),
      ),
    ),
  );
});

// ── Tests ──

describe("CreatorsPage", () => {
  it("renders creator cards from loader data without fetching", () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    render(<CreatorsPage />);

    expect(screen.getByText("Alice Music")).toBeInTheDocument();
    expect(screen.getByText("Bob Beats")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows empty state when loader returns no creators", () => {
    mockUseLoaderData.mockReturnValue({ items: [], nextCursor: null });

    render(<CreatorsPage />);

    expect(screen.getByText("No creators found.")).toBeInTheDocument();
  });

  it("renders page heading 'Creators'", () => {
    render(<CreatorsPage />);

    expect(screen.getByRole("heading", { name: "Creators" })).toBeInTheDocument();
  });

  it("shows 'Load more' button when nextCursor is present", () => {
    mockUseLoaderData.mockReturnValue({
      items: [makeMockCreatorListItem({ id: "c1" })],
      nextCursor: "eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxIn0",
    });

    render(<CreatorsPage />);

    expect(
      screen.getByRole("button", { name: "Load more" }),
    ).toBeInTheDocument();
  });

  it("hides 'Load more' button when nextCursor is null (last page)", () => {
    render(<CreatorsPage />);

    expect(screen.getByText("Alice Music")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("appends items when 'Load more' is clicked", async () => {
    const user = userEvent.setup();
    mockUseLoaderData.mockReturnValue({
      items: [
        makeMockCreatorListItem({
          id: "c1",
          displayName: "First Creator",
        }),
      ],
      nextCursor: "cursor-page-2",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                makeMockCreatorListItem({
                  id: "c2",
                  displayName: "Second Creator",
                }),
              ],
              nextCursor: null,
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<CreatorsPage />);

    expect(screen.getByText("First Creator")).toBeInTheDocument();

    // Click load more
    await user.click(screen.getByRole("button", { name: "Load more" }));

    // Wait for second page to append
    await waitFor(() => {
      expect(screen.getByText("Second Creator")).toBeInTheDocument();
    });

    // First page items still present
    expect(screen.getByText("First Creator")).toBeInTheDocument();

    // Load more button is gone (last page)
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("sends cursor parameter on load-more fetch", async () => {
    const user = userEvent.setup();
    mockUseLoaderData.mockReturnValue({
      items: [makeMockCreatorListItem({ id: "c1" })],
      nextCursor: "abc123",
    });

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [makeMockCreatorListItem({ id: "c2" })],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<CreatorsPage />);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("cursor=abc123");
  });

  it("creator cards link to /creators/:creatorId", () => {
    render(<CreatorsPage />);

    const links = screen.getAllByRole("link");
    expect(
      links.some((link) => link.getAttribute("href") === "/creators/creator-1"),
    ).toBe(true);
    expect(
      links.some((link) => link.getAttribute("href") === "/creators/creator-2"),
    ).toBe(true);
  });

  it("renders view toggle for stakeholder users", async () => {
    mockFetchAuthState.mockResolvedValue({ user: { id: "u1" }, roles: ["stakeholder"], isPatron: false });
    render(<CreatorsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Grid view" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "List view" })).toBeInTheDocument();
    });
  });

  it("does not render view toggle for non-stakeholder users", () => {
    render(<CreatorsPage />);
    expect(screen.queryByRole("button", { name: "Grid view" })).toBeNull();
    expect(screen.queryByRole("button", { name: "List view" })).toBeNull();
  });

  it("persists view mode to localStorage when toggled", async () => {
    const user = userEvent.setup();
    mockFetchAuthState.mockResolvedValue({ user: { id: "u1" }, roles: ["stakeholder"], isPatron: false });
    render(<CreatorsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "List view" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "List view" }));
    expect(localStorage.getItem("snc-creators-view-mode")).toBe("list");
  });

  it("restores list view from localStorage", () => {
    localStorage.setItem("snc-creators-view-mode", "list");
    render(<CreatorsPage />);
    // In list mode, the container will use listLayout class instead of content-grid
    const container = document.querySelector('[class*="listLayout"]');
    expect(container).not.toBeNull();
  });

  it("shows New Creator button for admin users", async () => {
    mockFetchAuthState.mockResolvedValue({ user: { id: "u1" }, roles: ["admin"], isPatron: false });
    render(<CreatorsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Creator" })).toBeInTheDocument();
    });
  });

  it("does not show New Creator button for non-stakeholder users", () => {
    render(<CreatorsPage />);
    expect(screen.queryByRole("button", { name: "New Creator" })).toBeNull();
  });

  it("shows CreateCreatorForm when New Creator is clicked", async () => {
    const user = userEvent.setup();
    mockFetchAuthState.mockResolvedValue({ user: { id: "u1" }, roles: ["stakeholder"], isPatron: false });
    render(<CreatorsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Creator" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "New Creator" }));
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Handle (optional)")).toBeInTheDocument();
  });

  it("hides form when Cancel is clicked", async () => {
    const user = userEvent.setup();
    mockFetchAuthState.mockResolvedValue({ user: { id: "u1" }, roles: ["stakeholder"], isPatron: false });
    render(<CreatorsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Creator" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "New Creator" }));
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Display Name")).toBeNull();
  });

  it("navigates to creator manage page on successful creation", async () => {
    const user = userEvent.setup();
    const profile = makeMockCreatorProfileResponse({ id: "creator-new-123" });
    mockCreateCreatorEntity.mockResolvedValue(profile);
    mockFetchAuthState.mockResolvedValue({ user: { id: "u1" }, roles: ["stakeholder"], isPatron: false });
    render(<CreatorsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Creator" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "New Creator" }));
    await user.type(screen.getByLabelText("Display Name"), "My New Band");
    await user.click(screen.getByRole("button", { name: "Create Creator" }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/creators/$creatorId/manage",
        params: { creatorId: "creator-new-123" },
      });
    });
  });
});
