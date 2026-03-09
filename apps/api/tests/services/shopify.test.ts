import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  TEST_CONFIG,
  TEST_SHOPIFY_STORE_DOMAIN,
  TEST_SHOPIFY_STOREFRONT_TOKEN,
  makeTestConfig,
} from "../helpers/test-constants.js";
import {
  makeMockShopifyProductNode,
  makeMockShopifyProductsResponse,
  makeMockShopifyProductByHandleResponse,
  makeMockShopifyCartResponse,
  makeMockShopifyCartErrorResponse,
  makeMockShopifyCartWarningResponse,
} from "../helpers/merch-fixtures.js";

// ── Mock State ──

const mockFetch = vi.fn();

// ── Helper: Build a resolved fetch response ──

const mockFetchResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

// ── Setup Factories ──

/** Setup with Shopify configured (TEST_CONFIG has Shopify values). */
const setupShopifyService = async () => {
  vi.stubGlobal("fetch", mockFetch);

  vi.doMock("../../src/config.js", () => ({
    config: TEST_CONFIG,
  }));

  return await import("../../src/services/shopify.js");
};

/** Setup with Shopify NOT configured (env vars undefined). */
const setupUnconfiguredShopifyService = async () => {
  vi.stubGlobal("fetch", mockFetch);

  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({
      SHOPIFY_STORE_DOMAIN: undefined,
      SHOPIFY_STOREFRONT_TOKEN: undefined,
    }),
  }));

  return await import("../../src/services/shopify.js");
};

// ── Lifecycle ──

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

// ── Tests ──

describe("shopify service", () => {
  describe("getProducts", () => {
    it("returns product list with pageInfo on success", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse()),
      );

      const { getProducts } = await setupShopifyService();
      const result = await getProducts();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.products).toHaveLength(1);
        expect(result.value.products[0]?.handle).toBe("test-tshirt");
        expect(result.value.pageInfo.hasNextPage).toBe(false);
      }
    });

    it("returns empty list when Shopify returns no products", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse([], false)),
      );

      const { getProducts } = await setupShopifyService();
      const result = await getProducts();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.products).toEqual([]);
      }
    });

    it("constructs tag filter when creatorId provided", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse()),
      );

      const { getProducts } = await setupShopifyService();
      await getProducts({ creatorId: "user_abc" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        variables: { query?: string };
      };
      expect(body.variables.query).toBe("tag:snc-creator:user_abc");
    });

    it("passes cursor as after variable when provided", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse()),
      );

      const { getProducts } = await setupShopifyService();
      await getProducts({ after: "cursor_xyz" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        variables: { after?: string };
      };
      expect(body.variables.after).toBe("cursor_xyz");
    });

    it("passes first variable with default 12", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse()),
      );

      const { getProducts } = await setupShopifyService();
      await getProducts();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        variables: { first: number };
      };
      expect(body.variables.first).toBe(12);
    });

    it("passes custom first variable", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse()),
      );

      const { getProducts } = await setupShopifyService();
      await getProducts({ first: 6 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        variables: { first: number };
      };
      expect(body.variables.first).toBe(6);
    });

    it("returns err with 503 when Shopify not configured", async () => {
      const { getProducts } = await setupUnconfiguredShopifyService();
      const result = await getProducts();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("MERCH_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
    });

    it("returns err with 502 on network error", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      const { getProducts } = await setupShopifyService();
      const result = await getProducts();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SHOPIFY_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("returns err with 502 on GraphQL errors", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse({ errors: [{ message: "Query error" }] }),
      );

      const { getProducts } = await setupShopifyService();
      const result = await getProducts();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SHOPIFY_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("sets X-Shopify-Storefront-Access-Token header", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse()),
      );

      const { getProducts } = await setupShopifyService();
      await getProducts();

      const headers = mockFetch.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["X-Shopify-Storefront-Access-Token"]).toBe(
        TEST_SHOPIFY_STOREFRONT_TOKEN,
      );
    });

    it("posts to correct Shopify Storefront API endpoint", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductsResponse()),
      );

      const { getProducts } = await setupShopifyService();
      await getProducts();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://${TEST_SHOPIFY_STORE_DOMAIN}/api/2025-10/graphql.json`,
        expect.any(Object),
      );
    });
  });

  describe("getProductByHandle", () => {
    it("returns product detail on success", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductByHandleResponse()),
      );

      const { getProductByHandle } = await setupShopifyService();
      const result = await getProductByHandle("test-tshirt");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(makeMockShopifyProductNode());
      }
    });

    it("returns ok(null) when product not found", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse({ data: { product: null } }),
      );

      const { getProductByHandle } = await setupShopifyService();
      const result = await getProductByHandle("nonexistent");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("passes handle as variable", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyProductByHandleResponse()),
      );

      const { getProductByHandle } = await setupShopifyService();
      await getProductByHandle("test-tshirt");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        variables: { handle: string };
      };
      expect(body.variables.handle).toBe("test-tshirt");
    });

    it("returns err with 503 when not configured", async () => {
      const { getProductByHandle } = await setupUnconfiguredShopifyService();
      const result = await getProductByHandle("test-tshirt");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("MERCH_NOT_CONFIGURED");
      }
    });

    it("returns err with 502 on network error", async () => {
      mockFetch.mockRejectedValue(new Error("network failure"));

      const { getProductByHandle } = await setupShopifyService();
      const result = await getProductByHandle("test-tshirt");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SHOPIFY_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });

  describe("createCheckoutUrl", () => {
    const checkoutParams = {
      variantId: "gid://shopify/ProductVariant/1001",
      quantity: 2,
      returnUrl: "https://example.com/merch",
    };

    it("returns checkout URL on success", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyCartResponse()),
      );

      const { createCheckoutUrl } = await setupShopifyService();
      const result = await createCheckoutUrl(checkoutParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(
          "https://test-store.myshopify.com/cart/c/mock",
        );
      }
    });

    it("passes correct cart input", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyCartResponse()),
      );

      const { createCheckoutUrl } = await setupShopifyService();
      await createCheckoutUrl(checkoutParams);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
        variables: {
          input: {
            lines: Array<{ merchandiseId: string; quantity: number }>;
          };
        };
      };
      expect(body.variables.input.lines[0]?.merchandiseId).toBe(
        "gid://shopify/ProductVariant/1001",
      );
      expect(body.variables.input.lines[0]?.quantity).toBe(2);
    });

    it("returns err with 502 when cart has userErrors", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyCartErrorResponse()),
      );

      const { createCheckoutUrl } = await setupShopifyService();
      const result = await createCheckoutUrl(checkoutParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SHOPIFY_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("returns err with 422 when cart has warnings", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeMockShopifyCartWarningResponse()),
      );

      const { createCheckoutUrl } = await setupShopifyService();
      const result = await createCheckoutUrl(checkoutParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SHOPIFY_CART_WARNING");
        expect(result.error.statusCode).toBe(422);
        expect(result.error.message).toBe("Not enough inventory");
      }
    });

    it("returns err with 502 when cart is null", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse({
          data: {
            cartCreate: { cart: null, userErrors: [], warnings: [] },
          },
        }),
      );

      const { createCheckoutUrl } = await setupShopifyService();
      const result = await createCheckoutUrl(checkoutParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SHOPIFY_ERROR");
      }
    });

    it("returns err with 503 when not configured", async () => {
      const { createCheckoutUrl } = await setupUnconfiguredShopifyService();
      const result = await createCheckoutUrl(checkoutParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("MERCH_NOT_CONFIGURED");
      }
    });

    it("returns err with 502 on network error", async () => {
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const { createCheckoutUrl } = await setupShopifyService();
      const result = await createCheckoutUrl(checkoutParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SHOPIFY_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });
});
