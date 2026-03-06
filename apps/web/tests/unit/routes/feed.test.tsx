import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";

// ── Hoisted Mocks ──

const { mockFormatRelativeDate, mockUseLoaderData } = vi.hoisted(() => ({
  mockFormatRelativeDate: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
      useLoaderData: mockUseLoaderData,
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
                  "$contentId",
                  (params as Record<string, string>).contentId!,
                )
              : (to as string),
          className,
        },
        children as React.ReactNode,
      ),
  };
});

vi.mock("../../../src/lib/format.js", () => ({
  formatRelativeDate: mockFormatRelativeDate,
}));

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

// ── Component Under Test ──

let FeedPage: () => React.ReactElement;

beforeAll(async () => {
  const mod = await import("../../../src/routes/feed.js");
  FeedPage = (mod.Route as unknown as { component: () => React.ReactElement }).component;
});

// ── Test Lifecycle ──

beforeEach(() => {
  mockFormatRelativeDate.mockReturnValue("2h ago");
  mockUseLoaderData.mockReturnValue({
    items: [
      makeMockFeedItem({ id: "c1", title: "Post One" }),
      makeMockFeedItem({ id: "c2", title: "Post Two" }),
    ],
    nextCursor: null,
  });

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              makeMockFeedItem({ id: "c1", title: "Post One" }),
              makeMockFeedItem({ id: "c2", title: "Post Two" }),
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

describe("FeedPage", () => {
  it("renders content cards from loader data without fetching", () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    render(<FeedPage />);

    expect(screen.getByText("Post One")).toBeInTheDocument();
    expect(screen.getByText("Post Two")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows empty state when loader returns no content", () => {
    mockUseLoaderData.mockReturnValue({ items: [], nextCursor: null });
    vi.stubGlobal("fetch", vi.fn());

    render(<FeedPage />);

    expect(screen.getByText("No content found.")).toBeInTheDocument();
  });

  it("renders filter bar with All / Video / Audio / Written buttons", () => {
    render(<FeedPage />);

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Audio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Written" })).toBeInTheDocument();
  });

  it("fetches filtered content when a filter is clicked", async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [makeMockFeedItem({ id: "v1", type: "video", title: "Video Post" })],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<FeedPage />);

    // Initial render uses loader data, no fetch yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Click "Video" filter — triggers client-side fetch
    await user.click(screen.getByRole("button", { name: "Video" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Verify the call includes type=video
    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).toContain("type=video");
  });

  it("shows 'Load more' button when nextCursor is present", () => {
    mockUseLoaderData.mockReturnValue({
      items: [makeMockFeedItem({ id: "c1" })],
      nextCursor: "eyJjdXJzb3IiOiAiYWJjIn0",
    });

    render(<FeedPage />);

    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("hides 'Load more' button when nextCursor is null (last page)", () => {
    render(<FeedPage />);

    expect(screen.getByText("Post One")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("appends items when 'Load more' is clicked", async () => {
    const user = userEvent.setup();
    mockUseLoaderData.mockReturnValue({
      items: [makeMockFeedItem({ id: "c1", title: "First" })],
      nextCursor: "cursor-page-2",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              items: [makeMockFeedItem({ id: "c2", title: "Second" })],
              nextCursor: null,
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<FeedPage />);

    expect(screen.getByText("First")).toBeInTheDocument();

    // Click load more
    await user.click(screen.getByRole("button", { name: "Load more" }));

    // Wait for second page to append
    await waitFor(() => {
      expect(screen.getByText("Second")).toBeInTheDocument();
    });

    // First page items still present
    expect(screen.getByText("First")).toBeInTheDocument();

    // Load more button is gone (last page)
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("content cards link to /content/:id", () => {
    render(<FeedPage />);

    const links = screen.getAllByRole("link");
    expect(links.some((link) => link.getAttribute("href") === "/content/c1")).toBe(true);
  });
});
