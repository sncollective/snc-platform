import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockMerchProduct } from "../../helpers/merch-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createFormatMock } from "../../helpers/format-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockFormatPrice, mockUseSearch } = vi.hoisted(() => ({
  mockFormatPrice: vi.fn(),
  mockUseSearch: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useSearch: mockUseSearch,
    useNavigate: () => vi.fn(),
    extras: { useSearch: mockUseSearch },
  }),
);

vi.mock("../../../src/lib/format.js", () =>
  createFormatMock({ formatPrice: mockFormatPrice }),
);

// ── Component Under Test ──

const MerchPage = extractRouteComponent(() => import("../../../src/routes/merch/index.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockFormatPrice.mockImplementation(
    (cents: number) => `$${(cents / 100).toFixed(2)}`,
  );
  mockUseSearch.mockReturnValue({});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              makeMockMerchProduct({ handle: "tshirt-1", title: "Cool T-Shirt" }),
              makeMockMerchProduct({ handle: "hoodie-1", title: "Warm Hoodie" }),
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

describe("MerchPage", () => {
  it("renders product cards after loading", async () => {
    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByText("Cool T-Shirt")).toBeInTheDocument();
    });
    expect(screen.getByText("Warm Hoodie")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})),
    );

    render(<MerchPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows coming soon message when API returns error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: "MERCH_NOT_CONFIGURED", message: "Shopify is not configured" } }),
            { status: 503 },
          ),
        ),
      ),
    );

    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByText("Merch coming soon.")).toBeInTheDocument();
    });
  });

  it("shows empty state when no products returned", async () => {
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

    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByText("No products found.")).toBeInTheDocument();
    });
  });

  it("shows 'Load more' button when nextCursor is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              items: [makeMockMerchProduct({ handle: "tshirt-1" })],
              nextCursor: "cursor-abc",
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
    });
  });

  it("hides 'Load more' button on last page", async () => {
    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByText("Cool T-Shirt")).toBeInTheDocument();
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
              items: [makeMockMerchProduct({ handle: "tshirt-1", title: "First Shirt" })],
              nextCursor: "page-2",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: [makeMockMerchProduct({ handle: "hoodie-1", title: "Second Hoodie" })],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<MerchPage />);

    // Wait for first page
    await waitFor(() => {
      expect(screen.getByText("First Shirt")).toBeInTheDocument();
    });

    // Click load more
    await user.click(screen.getByRole("button", { name: "Load more" }));

    // Wait for second page to append
    await waitFor(() => {
      expect(screen.getByText("Second Hoodie")).toBeInTheDocument();
    });

    // First page items still present
    expect(screen.getByText("First Shirt")).toBeInTheDocument();

    // Load more button is gone (last page)
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("product cards are interactive links", async () => {
    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByText("Cool T-Shirt")).toBeInTheDocument();
    });

    const cards = screen.getAllByRole("link");
    expect(cards.some((el) => el.textContent?.includes("Cool T-Shirt"))).toBe(true);
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

    render(<MerchPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/api/merch");
    expect(url).toContain("limit=12");
  });

  it("shows success banner when ?status=success", async () => {
    mockUseSearch.mockReturnValue({ status: "success" });

    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByText(/purchase complete/i)).toBeInTheDocument();
  });

  it("shows info banner when ?status=cancel", async () => {
    mockUseSearch.mockReturnValue({ status: "cancel" });

    render(<MerchPage />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByText(/checkout was canceled/i)).toBeInTheDocument();
  });
});
