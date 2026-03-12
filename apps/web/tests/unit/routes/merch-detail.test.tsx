import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockMerchProductDetail } from "../../helpers/merch-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockUseLoaderData, mockProductDetail, mockIsFeatureEnabled } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockProductDetail: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData }),
);

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/components/merch/product-detail.js", () => ({
  ProductDetail: (props: Record<string, unknown>) => {
    mockProductDetail(props);
    const product = props.product as { title: string; handle: string };
    return <div data-testid="product-detail">{product.title}</div>;
  },
}));

// ── Component Under Test ──

const MerchDetailPage = extractRouteComponent(() => import("../../../src/routes/merch/$handle.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  const mockProduct = makeMockMerchProductDetail();
  mockUseLoaderData.mockReturnValue(mockProduct);
});

// ── Tests ──

describe("MerchDetailPage", () => {
  it("renders ProductDetail component with loader data", () => {
    render(<MerchDetailPage />);

    expect(screen.getByTestId("product-detail")).toBeInTheDocument();
    expect(mockProductDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({ handle: "test-tshirt" }),
      }),
    );
  });

  it("displays product title from loader data", () => {
    render(<MerchDetailPage />);

    expect(screen.getByText("Test T-Shirt")).toBeInTheDocument();
  });

  it("passes full product detail object to ProductDetail", () => {
    const product = makeMockMerchProductDetail({
      title: "Custom Product",
      handle: "custom-handle",
    });
    mockUseLoaderData.mockReturnValue(product);

    render(<MerchDetailPage />);

    expect(mockProductDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          title: "Custom Product",
          handle: "custom-handle",
          description: expect.any(String),
          variants: expect.any(Array),
          images: expect.any(Array),
        }),
      }),
    );
  });

  it("renders Coming Soon when merch feature is disabled", () => {
    mockIsFeatureEnabled.mockImplementation((flag: string) => flag !== "merch");
    mockUseLoaderData.mockReturnValue(null);

    render(<MerchDetailPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Merch — Coming Soon" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });
});
