import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCreatorListItem } from "../../helpers/creator-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockUseLoaderData } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData }),
);

vi.mock("../../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

// ── Component Under Test ──

const CreatorsPage = extractRouteComponent(() => import("../../../src/routes/creators/index.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseLoaderData.mockReturnValue({
    items: [
      makeMockCreatorListItem({
        userId: "creator-1",
        displayName: "Alice Music",
      }),
      makeMockCreatorListItem({
        userId: "creator-2",
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
      items: [makeMockCreatorListItem({ userId: "c1" })],
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
          userId: "c1",
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
                  userId: "c2",
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
      items: [makeMockCreatorListItem({ userId: "c1" })],
      nextCursor: "abc123",
    });

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [makeMockCreatorListItem({ userId: "c2" })],
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
});
