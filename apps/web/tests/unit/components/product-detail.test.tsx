import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  makeMockMerchProductDetail,
} from "../../helpers/merch-fixtures.js";

// ── Hoisted Mocks ──

const { mockFormatPrice, mockCreateMerchCheckout, mockVariantSelector, mockNavigateExternal } =
  vi.hoisted(() => ({
    mockFormatPrice: vi.fn(),
    mockCreateMerchCheckout: vi.fn(),
    mockVariantSelector: vi.fn(),
    mockNavigateExternal: vi.fn(),
  }));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
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
                  /\$(\w+)/g,
                  (_, key: string) =>
                    (params as Record<string, string>)[key] ?? "",
                )
              : (to as string),
          className,
        },
        children as React.ReactNode,
      ),
  };
});

vi.mock("../../../src/lib/format.js", () => ({
  formatPrice: mockFormatPrice,
}));

vi.mock("../../../src/lib/merch.js", () => ({
  createMerchCheckout: mockCreateMerchCheckout,
}));

vi.mock("../../../src/lib/url.js", () => ({
  navigateExternal: mockNavigateExternal,
}));

vi.mock("../../../src/components/merch/variant-selector.js", () => ({
  VariantSelector: (props: Record<string, unknown>) => {
    mockVariantSelector(props);
    const variants = props.variants as Array<{
      id: string;
      title: string;
      available: boolean;
    }>;
    const onSelect = props.onSelect as (id: string) => void;
    const selectedId = props.selectedId as string;
    // Render a simplified version for testing interactions
    return (
      <div data-testid="variant-selector">
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            data-variant-id={v.id}
            data-selected={v.id === selectedId ? "true" : "false"}
            disabled={!v.available}
            onClick={() => onSelect(v.id)}
          >
            {v.title}
          </button>
        ))}
      </div>
    );
  },
}));

// ── Component Under Test ──

import { ProductDetail } from "../../../src/components/merch/product-detail.js";

// ── Lifecycle ──

beforeEach(() => {
  mockFormatPrice.mockImplementation(
    (cents: number) => `$${(cents / 100).toFixed(2)}`,
  );
  mockCreateMerchCheckout.mockResolvedValue("https://checkout.shopify.com/test");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("ProductDetail", () => {
  it("renders product title", () => {
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    expect(
      screen.getByRole("heading", { name: "Test T-Shirt" }),
    ).toBeInTheDocument();
  });

  it("renders product description", () => {
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    expect(
      screen.getByText("A high-quality test t-shirt."),
    ).toBeInTheDocument();
  });

  it("renders formatted price from first available variant", () => {
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    expect(mockFormatPrice).toHaveBeenCalledWith(2500);
    const priceElements = screen.getAllByText(/\$25\.00/);
    expect(priceElements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders main image from first image", () => {
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    const mainImage = screen.getByRole("img", { name: "Test T-Shirt" });
    expect(mainImage).toHaveAttribute(
      "src",
      "https://cdn.shopify.com/s/files/test.jpg",
    );
  });

  it("clicking thumbnail changes main image", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    await user.click(screen.getByRole("listitem", { name: "Test T-Shirt back" }));

    expect(
      screen.getByRole("img", { name: "Test T-Shirt back" }),
    ).toHaveAttribute("src", "https://cdn.shopify.com/s/files/test-back.jpg");
  });

  it("renders variant selector when multiple variants exist", () => {
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    expect(screen.getByTestId("variant-selector")).toBeInTheDocument();
    expect(mockVariantSelector).toHaveBeenCalledWith(
      expect.objectContaining({ variants: expect.any(Array) }),
    );
  });

  it("hides variant selector for single-variant products", () => {
    render(
      <ProductDetail
        product={makeMockMerchProductDetail({
          variants: [{ id: "v1", title: "One Size", price: 2500, available: true }],
        })}
      />,
    );

    expect(screen.queryByTestId("variant-selector")).toBeNull();
  });

  it("selecting a variant updates displayed price", async () => {
    const user = userEvent.setup();
    render(
      <ProductDetail
        product={makeMockMerchProductDetail({
          variants: [
            { id: "v1", title: "S", price: 2500, available: true },
            { id: "v2", title: "L", price: 3000, available: true },
          ],
        })}
      />,
    );

    expect(mockFormatPrice).toHaveBeenCalledWith(2500);

    await user.click(screen.getByText("L"));

    await waitFor(() =>
      expect(mockFormatPrice).toHaveBeenCalledWith(3000),
    );
  });

  it("Buy button calls createMerchCheckout with selected variant ID", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    await user.click(screen.getByRole("button", { name: /buy/i }));

    expect(mockCreateMerchCheckout).toHaveBeenCalledWith(
      "gid://shopify/ProductVariant/1001",
      1,
    );
  });

  it("Buy button is disabled when selected variant is unavailable", () => {
    render(
      <ProductDetail
        product={makeMockMerchProductDetail({
          variants: [
            { id: "v1", title: "Sold Out", price: 2500, available: false },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /buy/i })).toBeDisabled();
  });

  it("Buy button shows loading state during checkout", async () => {
    const user = userEvent.setup();
    mockCreateMerchCheckout.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    await user.click(screen.getByRole("button", { name: /buy/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /processing/i }),
      ).toBeDisabled(),
    );
  });

  it("creator name links to creator page when creatorId is present", () => {
    render(
      <ProductDetail
        product={makeMockMerchProductDetail({
          creatorId: "user_abc",
          creatorName: "Alice",
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "Alice" })).toHaveAttribute(
      "href",
      "/creators/user_abc",
    );
  });

  it("renders back to merch link", () => {
    render(<ProductDetail product={makeMockMerchProductDetail()} />);

    expect(
      screen.getByRole("link", { name: /back to merch/i }),
    ).toHaveAttribute("href", "/merch");
  });
});
