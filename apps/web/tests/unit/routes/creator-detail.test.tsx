import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCreatorListItem } from "../../helpers/creator-fixtures.js";
import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { makeMockPlan, makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";
import { makeMockMerchProduct } from "../../helpers/merch-fixtures.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockFormatRelativeDate,
  mockUseSession,
  mockFetchPlans,
  mockFetchMySubscriptions,
  mockFetchProducts,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockFormatRelativeDate: vi.fn(),
  mockUseSession: vi.fn(),
  mockFetchPlans: vi.fn(),
  mockFetchMySubscriptions: vi.fn(),
  mockFetchProducts: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
      useLoaderData: mockUseLoaderData,
    }),
    useNavigate: () => vi.fn(),
    Link: ({
      to,
      params,
      search,
      children,
      className,
    }: Record<string, unknown>) => {
      let href = to as string;
      if (typeof params === "object" && params !== null) {
        const p = params as Record<string, string>;
        if (p.contentId) {
          href = href.replace("$contentId", p.contentId);
        }
        if (p.creatorId) {
          href = href.replace("$creatorId", p.creatorId);
        }
        if (p.handle) {
          href = href.replace("$handle", p.handle);
        }
      }
      if (typeof search === "object" && search !== null) {
        const s = search as Record<string, string>;
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(s)) {
          searchParams.set(key, value);
        }
        href = `${href}?${searchParams.toString()}`;
      }
      return React.createElement(
        "a",
        { href, className },
        children as React.ReactNode,
      );
    },
  };
});

vi.mock("../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/format.js")>();
  return {
    ...actual,
    formatRelativeDate: mockFormatRelativeDate,
  };
});

vi.mock("../../../src/lib/auth.js", () => ({
  useSession: mockUseSession,
}));

vi.mock("../../../src/lib/subscription.js", () => ({
  fetchPlans: mockFetchPlans,
  fetchMySubscriptions: mockFetchMySubscriptions,
}));

vi.mock("../../../src/lib/merch.js", () => ({
  fetchProducts: mockFetchProducts,
}));

// ── Component Under Test ──

let CreatorDetailPage: () => React.ReactElement;

beforeAll(async () => {
  const mod = await import("../../../src/routes/creators/$creatorId.js");
  CreatorDetailPage = (
    mod.Route as unknown as { component: () => React.ReactElement }
  ).component;
});

// ── Test Lifecycle ──

beforeEach(() => {
  vi.clearAllMocks();
  mockFormatRelativeDate.mockReturnValue("2h ago");
  mockUseSession.mockReturnValue({ data: { user: { id: "user-1" } } });
  mockFetchPlans.mockResolvedValue([]);
  mockFetchMySubscriptions.mockResolvedValue([]);
  mockFetchProducts.mockResolvedValue({ items: [], nextCursor: null });
  mockUseLoaderData.mockReturnValue(
    makeMockCreatorListItem({
      userId: "creator-1",
      displayName: "Alice Music",
      bio: "I make ambient music and soundscapes.",
      bannerUrl: "/api/creators/creator-1/banner",
      avatarUrl: "/api/creators/creator-1/avatar",
      contentCount: 5,
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              makeMockFeedItem({
                id: "c1",
                title: "Track One",
                creatorId: "creator-1",
                creatorName: "Alice Music",
                type: "audio",
              }),
              makeMockFeedItem({
                id: "c2",
                title: "Video Post",
                creatorId: "creator-1",
                creatorName: "Alice Music",
                type: "video",
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

describe("CreatorDetailPage", () => {
  it("renders creator header with display name", async () => {
    render(<CreatorDetailPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Alice Music" }),
    ).toBeInTheDocument();
  });

  it("renders creator bio", async () => {
    render(<CreatorDetailPage />);

    expect(
      screen.getByText("I make ambient music and soundscapes."),
    ).toBeInTheDocument();
  });

  it("renders banner image", async () => {
    render(<CreatorDetailPage />);

    const banner = screen.getByRole("img", { name: "Alice Music banner" });
    expect(banner).toBeInTheDocument();
  });

  it("renders avatar image", async () => {
    render(<CreatorDetailPage />);

    const avatar = screen.getByRole("img", { name: "Alice Music avatar" });
    expect(avatar).toBeInTheDocument();
  });

  it("renders content section with filter bar", async () => {
    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "All" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Audio" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Written" }),
    ).toBeInTheDocument();
  });

  it("renders content cards after loading", async () => {
    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Track One")).toBeInTheDocument();
    });
    expect(screen.getByText("Video Post")).toBeInTheDocument();
  });

  it("fetches content with creatorId parameter", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/api/content");
    expect(url).toContain("creatorId=creator-1");
    expect(url).toContain("limit=12");
  });

  it("fetches filtered content when a filter is clicked", async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              makeMockFeedItem({
                id: "v1",
                type: "video",
                title: "Filtered Video",
              }),
            ],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Video" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    const secondCallUrl = mockFetch.mock.calls[1]![0] as string;
    expect(secondCallUrl).toContain("type=video");
    expect(secondCallUrl).toContain("creatorId=creator-1");
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

    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load more" }),
      ).toBeInTheDocument();
    });
  });

  it("hides 'Load more' button when nextCursor is null", async () => {
    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Track One")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("renders social links section when creator has links", async () => {
    mockUseLoaderData.mockReturnValue(
      makeMockCreatorListItem({
        userId: "creator-1",
        displayName: "Alice Music",
        socialLinks: [
          { platform: "bandcamp", url: "https://alice.bandcamp.com" },
          { platform: "spotify", url: "https://open.spotify.com/artist/alice" },
        ],
      }),
    );

    render(<CreatorDetailPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Links" }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    const socialLinks = links.filter(
      (l) =>
        l.getAttribute("href") === "https://alice.bandcamp.com" ||
        l.getAttribute("href") === "https://open.spotify.com/artist/alice",
    );
    expect(socialLinks).toHaveLength(2);
  });

  it("hides social links section when creator has no links", async () => {
    mockUseLoaderData.mockReturnValue(
      makeMockCreatorListItem({
        userId: "creator-1",
        displayName: "Alice Music",
        socialLinks: [],
      }),
    );

    render(<CreatorDetailPage />);

    // Content heading renders but Links heading does not
    await waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { level: 2, name: "Links" }),
    ).toBeNull();
  });

  it("does not render 'Coming soon' placeholder", async () => {
    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
    expect(screen.queryByText("Coming soon")).toBeNull();
  });

  it("shows merch section when creator has products", async () => {
    mockFetchProducts.mockResolvedValue({
      items: [
        makeMockMerchProduct({ handle: "tshirt-1", title: "Cool T-Shirt" }),
        makeMockMerchProduct({ handle: "hoodie-1", title: "Warm Hoodie" }),
      ],
      nextCursor: null,
    });

    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Cool T-Shirt")).toBeInTheDocument();
    });
    expect(screen.getByText("Warm Hoodie")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Merch" }),
    ).toBeInTheDocument();
  });

  it("hides merch section when creator has no products", async () => {
    mockFetchProducts.mockResolvedValue({ items: [], nextCursor: null });

    render(<CreatorDetailPage />);

    // Wait for component to settle (content section loads)
    await waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { level: 2, name: "Merch" }),
    ).toBeNull();
  });

  it("hides merch section on fetch failure", async () => {
    mockFetchProducts.mockRejectedValue(new Error("Network error"));

    render(<CreatorDetailPage />);

    // Wait for component to settle
    await waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { level: 2, name: "Merch" }),
    ).toBeNull();
  });

  it("fetches merch products with creatorId and limit 6", async () => {
    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(mockFetchProducts).toHaveBeenCalledWith({
        creatorId: "creator-1",
        limit: 6,
      });
    });
  });

  it("renders 'View all merch' link to merch page with creatorId", async () => {
    mockFetchProducts.mockResolvedValue({
      items: [
        makeMockMerchProduct({ handle: "tshirt-1", title: "Cool T-Shirt" }),
      ],
      nextCursor: null,
    });

    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Cool T-Shirt")).toBeInTheDocument();
    });

    const viewAllLink = screen.getByText("View all merch");
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink.closest("a")).toHaveAttribute(
      "href",
      "/merch?creatorId=creator-1",
    );
  });

  it("shows empty state when creator has no content", async () => {
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

    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("No content yet.")).toBeInTheDocument();
    });
  });

  // ── New tests: subscription integration ──

  it("fetches creator plans on mount", async () => {
    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(mockFetchPlans).toHaveBeenCalledWith({ creatorId: "creator-1" });
    });
  });

  it("fetches user subscriptions when authenticated", async () => {
    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(mockFetchMySubscriptions).toHaveBeenCalled();
    });
  });

  it("does not fetch subscriptions when not authenticated", async () => {
    mockUseSession.mockReturnValue({ data: null });
    render(<CreatorDetailPage />);

    // Wait for plans to load (confirming component rendered)
    await waitFor(() => {
      expect(mockFetchPlans).toHaveBeenCalled();
    });
    expect(mockFetchMySubscriptions).not.toHaveBeenCalled();
  });

  it("passes plans and isSubscribed to CreatorHeader", async () => {
    const testPlan = makeMockPlan({
      id: "plan-creator-1",
      type: "creator",
      creatorId: "creator-1",
    });
    mockFetchPlans.mockResolvedValue([testPlan]);
    mockFetchMySubscriptions.mockResolvedValue([
      makeMockUserSubscription({
        status: "active",
        plan: { ...testPlan },
      }),
    ]);

    render(<CreatorDetailPage />);

    // When subscribed, the "Subscribed" badge should appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /subscribed/i })).toBeInTheDocument();
    });
  });

  it("shows subscribe button when plans exist and user is not subscribed", async () => {
    mockFetchPlans.mockResolvedValue([
      makeMockPlan({ type: "creator", creatorId: "creator-1" }),
    ]);
    mockFetchMySubscriptions.mockResolvedValue([]);

    render(<CreatorDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
    });
  });

  it("hides subscribe button when creator has no plans", async () => {
    mockFetchPlans.mockResolvedValue([]);

    render(<CreatorDetailPage />);

    // Wait for component to settle
    await waitFor(() => {
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /subscribe/i })).toBeNull();
  });
});
