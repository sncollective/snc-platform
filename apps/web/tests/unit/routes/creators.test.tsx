import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCreatorListItem } from "../../helpers/creator-fixtures.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
    }),
    Link: ({
      to,
      params,
      children,
      className,
    }: Record<string, unknown>) =>
      React.createElement(
        "a",
        {
          href:
            typeof params === "object" && params !== null
              ? (to as string).replace(
                  "$creatorId",
                  (params as Record<string, string>).creatorId!,
                )
              : (to as string),
          className,
        },
        children as React.ReactNode,
      ),
  };
});

// ── Component Under Test ──

let CreatorsPage: () => React.ReactElement;

beforeAll(async () => {
  const mod = await import("../../../src/routes/creators/index.js");
  CreatorsPage = (
    mod.Route as unknown as { component: () => React.ReactElement }
  ).component;
});

// ── Test Lifecycle ──

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        ),
      ),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("CreatorsPage", () => {
  it("renders creator cards after loading", async () => {
    render(<CreatorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Music")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Beats")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})),
    );

    render(<CreatorsPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no creators returned", async () => {
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

    render(<CreatorsPage />);

    await waitFor(() => {
      expect(screen.getByText("No creators found.")).toBeInTheDocument();
    });
  });

  it("renders page heading 'Creators'", async () => {
    render(<CreatorsPage />);

    expect(screen.getByRole("heading", { name: "Creators" })).toBeInTheDocument();
  });

  it("shows 'Load more' button when nextCursor is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              items: [makeMockCreatorListItem({ userId: "c1" })],
              nextCursor: "eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxIn0",
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<CreatorsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load more" }),
      ).toBeInTheDocument();
    });
  });

  it("hides 'Load more' button when nextCursor is null (last page)", async () => {
    render(<CreatorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Music")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("appends items when 'Load more' is clicked", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                makeMockCreatorListItem({
                  userId: "c1",
                  displayName: "First Creator",
                }),
              ],
              nextCursor: "cursor-page-2",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
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
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<CreatorsPage />);

    // Wait for first page
    await waitFor(() => {
      expect(screen.getByText("First Creator")).toBeInTheDocument();
    });

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

  it("fetches from correct API URL with limit=24", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<CreatorsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/api/creators");
    expect(url).toContain("limit=24");
  });

  it("sends cursor parameter on second page fetch", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [makeMockCreatorListItem({ userId: "c1" })],
              nextCursor: "abc123",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: [makeMockCreatorListItem({ userId: "c2" })],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<CreatorsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    const secondCallUrl = mockFetch.mock.calls[1]![0] as string;
    expect(secondCallUrl).toContain("cursor=abc123");
  });

  it("creator cards link to /creators/:creatorId", async () => {
    render(<CreatorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Music")).toBeInTheDocument();
    });

    const links = screen.getAllByRole("link");
    expect(
      links.some((link) => link.getAttribute("href") === "/creators/creator-1"),
    ).toBe(true);
    expect(
      links.some((link) => link.getAttribute("href") === "/creators/creator-2"),
    ).toBe(true);
  });
});
