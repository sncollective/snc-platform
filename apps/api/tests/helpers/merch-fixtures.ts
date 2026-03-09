import type { MerchProduct, MerchProductDetail, MerchVariant } from "@snc/shared";

// ── API-level Fixtures (normalized shapes returned by merch routes) ──

export const makeMockVariant = (
  overrides?: Partial<MerchVariant>,
): MerchVariant => ({
  id: "gid://shopify/ProductVariant/1001",
  title: "S / Black",
  price: 2500,
  available: true,
  ...overrides,
});

export const makeMockProduct = (
  overrides?: Partial<MerchProduct>,
): MerchProduct => ({
  handle: "test-tshirt",
  title: "Test T-Shirt",
  price: 2500,
  image: {
    url: "https://cdn.shopify.com/s/files/test.jpg",
    altText: "Test T-Shirt",
  },
  creatorName: "Test Creator",
  creatorId: "user_test123",
  ...overrides,
});

export const makeMockProductDetail = (
  overrides?: Partial<MerchProductDetail>,
): MerchProductDetail => ({
  handle: "test-tshirt",
  title: "Test T-Shirt",
  description: "A high-quality test t-shirt for unit testing.",
  images: [
    {
      url: "https://cdn.shopify.com/s/files/test.jpg",
      altText: "Test T-Shirt",
    },
  ],
  variants: [makeMockVariant()],
  price: 2500,
  image: {
    url: "https://cdn.shopify.com/s/files/test.jpg",
    altText: "Test T-Shirt",
  },
  creatorName: "Test Creator",
  creatorId: "user_test123",
  ...overrides,
});

// ── Raw Shopify GraphQL Response Shapes (for shopify.test.ts mocking fetch) ──

export const makeMockShopifyProductNode = () => ({
  id: "gid://shopify/Product/1",
  handle: "test-tshirt",
  title: "Test T-Shirt",
  description: "A high-quality test t-shirt for unit testing.",
  vendor: "Test Creator",
  tags: ["snc-creator:user_test123"],
  featuredImage: {
    url: "https://cdn.shopify.com/s/files/test.jpg",
    altText: "Test T-Shirt",
  },
  images: {
    edges: [
      {
        node: {
          url: "https://cdn.shopify.com/s/files/test.jpg",
          altText: "Test T-Shirt",
        },
      },
    ],
  },
  priceRange: {
    minVariantPrice: { amount: "25.00", currencyCode: "USD" },
  },
  variants: {
    edges: [
      {
        node: {
          id: "gid://shopify/ProductVariant/1001",
          title: "S / Black",
          price: { amount: "25.00", currencyCode: "USD" },
          availableForSale: true,
        },
      },
    ],
  },
});

export const makeMockShopifyProductsResponse = (
  nodes = [makeMockShopifyProductNode()],
  hasNextPage = false,
) => ({
  data: {
    products: {
      edges: nodes.map((node, i) => ({
        cursor: `cursor_${i}`,
        node,
      })),
      pageInfo: {
        hasNextPage,
        endCursor: hasNextPage ? "next_cursor_value" : null,
      },
    },
  },
});

export const makeMockShopifyProductByHandleResponse = (
  node = makeMockShopifyProductNode(),
) => ({
  data: {
    product: node,
  },
});

export const makeMockShopifyCartResponse = (
  checkoutUrl = "https://test-store.myshopify.com/cart/c/mock",
) => ({
  data: {
    cartCreate: {
      cart: { checkoutUrl },
      userErrors: [],
      warnings: [],
    },
  },
});

export const makeMockShopifyCartErrorResponse = (
  message = "Product variant not found",
) => ({
  data: {
    cartCreate: {
      cart: null,
      userErrors: [{ field: ["lines", "0", "merchandiseId"], message }],
      warnings: [],
    },
  },
});

export const makeMockShopifyCartWarningResponse = (
  message = "Not enough inventory",
  code = "MERCHANDISE_NOT_ENOUGH_STOCK",
) => ({
  data: {
    cartCreate: {
      cart: { checkoutUrl: "https://test-store.myshopify.com/cart/c/mock" },
      userErrors: [],
      warnings: [{ code, message }],
    },
  },
});
