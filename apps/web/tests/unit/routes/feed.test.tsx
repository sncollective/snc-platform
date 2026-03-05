import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";

// ── Hoisted Mocks ──

const { mockFormatRelativeDate } = vi.hoisted(() => ({
  mockFormatRelativeDate: vi.fn(),
}));

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

// ── Component Under Test ──

let FeedPage: () => React.ReactElement;

beforeAll(async () => {
  const mod = await import("../../../src/routes/feed.js");
  FeedPage = (mod.Route as unknown as { component: () => React.ReactElement }).component;
});

// ── Test Lifecycle ──

beforeEach(() => {
  mockFormatRelativeDate.mockReturnValue("2h ago");
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
  it("renders content cards after loading", async () => {
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Post One")).toBeInTheDocument();
    });
    expect(screen.getByText("Post Two")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    // Mock fetch to never resolve
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})),
    );

    render(<FeedPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no content returned", async () => {
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

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("No content found.")).toBeInTheDocument();
    });
  });

  it("renders filter bar with All / Video / Audio / Written buttons", async () => {
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    });
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

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Click "Video" filter
    await user.click(screen.getByRole("button", { name: "Video" }));

    await waitFor(() => {
      // Filter change triggers a new fetch
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Verify the second call includes type=video
    const secondCallUrl = mockFetch.mock.calls[1]![0] as string;
    expect(secondCallUrl).toContain("type=video");
  });

  it("shows 'Load more' button when nextCursor is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              items: [makeMockFeedItem({ id: "c1" })],
              nextCursor: "eyJjdXJzb3IiOiAiYWJjIn0",
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
    });
  });

  it("hides 'Load more' button when nextCursor is null (last page)", async () => {
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Post One")).toBeInTheDocument();
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
              items: [makeMockFeedItem({ id: "c1", title: "First" })],
              nextCursor: "cursor-page-2",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: [makeMockFeedItem({ id: "c2", title: "Second" })],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<FeedPage />);

    // Wait for first page
    await waitFor(() => {
      expect(screen.getByText("First")).toBeInTheDocument();
    });

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

  it("fetches from correct API URL with limit=12", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<FeedPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/api/content");
    expect(url).toContain("limit=12");
  });

  it("content cards link to /content/:id", async () => {
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Post One")).toBeInTheDocument();
    });

    // ContentCard wraps in a Link which our mock renders as <a>
    const links = screen.getAllByRole("link");
    expect(links.some((link) => link.getAttribute("href") === "/content/c1")).toBe(true);
  });
});
