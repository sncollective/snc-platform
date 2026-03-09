import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";
import { createFormatMock } from "../../helpers/format-mock.js";

// ── Hoisted Mocks ──

const { mockFormatPrice } = vi.hoisted(() => ({
  mockFormatPrice: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/lib/format.js", () =>
  createFormatMock({ formatPrice: mockFormatPrice }),
);

// ── Import component under test (after mocks) ──

import { ProductCard } from "../../../src/components/merch/product-card.js";
import { makeMockMerchProduct } from "../../helpers/merch-fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("ProductCard", () => {
  it("renders product title and formatted price", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct();

    render(<ProductCard product={product} />);

    expect(screen.getByText("Test T-Shirt")).toBeInTheDocument();
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(mockFormatPrice).toHaveBeenCalledWith(2500);
  });

  it("renders creator name", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct({ creatorName: "Alice" });

    render(<ProductCard product={product} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("hides creator section when creatorName is null", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct({ creatorName: null });

    render(<ProductCard product={product} />);

    expect(screen.queryByText("Test Creator")).toBeNull();
  });

  it("renders product image when present", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct();

    render(<ProductCard product={product} />);

    const img = screen.getByRole("img", { name: "Test T-Shirt" });
    expect(img).toHaveAttribute(
      "src",
      "https://cdn.shopify.com/s/files/test.jpg",
    );
  });

  it("uses image altText for alt attribute", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct({
      image: { url: "https://example.com/img.jpg", altText: "Custom alt" },
    });

    render(<ProductCard product={product} />);

    expect(screen.getByRole("img", { name: "Custom alt" })).toBeInTheDocument();
  });

  it("renders placeholder when image is null", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct({ image: null });

    render(<ProductCard product={product} />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders as a link to the product detail page", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct({ handle: "cool-hoodie", creatorName: null });

    render(<ProductCard product={product} />);

    const cardLink = screen.getByRole("link");
    expect(cardLink).toHaveAttribute("href", "/merch/cool-hoodie");
  });

  it("creator name links to creator page when creatorId is set", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct({
      creatorId: "user_abc",
      creatorName: "Bob",
    });

    render(<ProductCard product={product} />);

    const creatorLink = screen.getByText("Bob").closest("a");
    expect(creatorLink).toHaveAttribute("href", "/creators/user_abc");
  });

  it("creator name is plain text when creatorId is null", () => {
    mockFormatPrice.mockReturnValue("$25.00");
    const product = makeMockMerchProduct({
      creatorId: null,
      creatorName: "Bob",
    });

    render(<ProductCard product={product} />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
    // Only the outer card link should be present, not a creator link
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
