import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockShopifyProductNode } from "../helpers/merch-fixtures.js";

// ── Mock Shopify Service ──

const mockGetProducts = vi.fn();
const mockGetProductByHandle = vi.fn();
const mockCreateCheckoutUrl = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  defaultAuth: { user: null, session: null, roles: [] },
  mocks: () => {
    vi.doMock("../../src/services/shopify.js", () => ({
      getProducts: mockGetProducts,
      getProductByHandle: mockGetProductByHandle,
      createCheckoutUrl: mockCreateCheckoutUrl,
    }));
  },
  mountRoute: async (app) => {
    const { merchRoutes } = await import("../../src/routes/merch.routes.js");
    app.route("/api/merch", merchRoutes);
  },
  beforeEach: () => {
    // Default: service returns success with one product
    mockGetProducts.mockResolvedValue({
      ok: true,
      value: {
        products: [makeMockShopifyProductNode()],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    });

    mockGetProductByHandle.mockResolvedValue({
      ok: true,
      value: makeMockShopifyProductNode(),
    });

    mockCreateCheckoutUrl.mockResolvedValue({
      ok: true,
      value: "https://test-store.myshopify.com/cart/c/mock",
    });
  },
});

// ── Test Suite ──

describe("merch routes", () => {
  // ── GET /api/merch ──

  describe("GET /api/merch", () => {
    it("returns paginated product list", async () => {
      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: unknown[]; nextCursor: string | null };
      expect(body.items).toHaveLength(1);
      expect((body.items[0] as { handle: string }).handle).toBe("test-tshirt");
      expect(body.nextCursor).toBeNull();
    });

    it("converts prices from decimal string to integer cents", async () => {
      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: Array<{ price: number }> };
      expect(body.items[0]?.price).toBe(2500);
    });

    it("extracts creatorId from product tags", async () => {
      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: Array<{ creatorId: string | null }> };
      expect(body.items[0]?.creatorId).toBe("user_test123");
    });

    it("extracts creatorName from vendor field", async () => {
      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: Array<{ creatorName: string | null }> };
      expect(body.items[0]?.creatorName).toBe("Test Creator");
    });

    it("returns null creatorId when no matching tag", async () => {
      const nodeWithNoTags = { ...makeMockShopifyProductNode(), tags: [] };
      mockGetProducts.mockResolvedValue({
        ok: true,
        value: {
          products: [nodeWithNoTags],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });

      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: Array<{ creatorId: string | null }> };
      expect(body.items[0]?.creatorId).toBeNull();
    });

    it("returns featuredImage as image", async () => {
      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: Array<{ image: { url: string } | null }> };
      expect(body.items[0]?.image?.url).toBe("https://cdn.shopify.com/s/files/test.jpg");
    });

    it("returns empty list for empty Shopify catalog", async () => {
      mockGetProducts.mockResolvedValue({
        ok: true,
        value: {
          products: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });

      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: unknown[]; nextCursor: string | null };
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it("generates nextCursor when hasNextPage is true", async () => {
      mockGetProducts.mockResolvedValue({
        ok: true,
        value: {
          products: [makeMockShopifyProductNode()],
          pageInfo: { hasNextPage: true, endCursor: "shopify_cursor_xyz" },
        },
      });

      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(200);
      const body = await res.json() as { items: unknown[]; nextCursor: string | null };
      expect(body.nextCursor).not.toBeNull();

      // Decode and verify it contains the endCursor
      const decoded = JSON.parse(
        Buffer.from(body.nextCursor!, "base64url").toString("utf-8"),
      ) as { endCursor: string };
      expect(decoded.endCursor).toBe("shopify_cursor_xyz");
    });

    it("passes creatorId filter to service", async () => {
      await ctx.app.request("/api/merch?creatorId=user_abc");
      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({ creatorId: "user_abc" }),
      );
    });

    it("passes limit to service", async () => {
      await ctx.app.request("/api/merch?limit=6");
      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({ first: 6 }),
      );
    });

    it("passes decoded cursor to service as after", async () => {
      // Encode a cursor the same way as the route does via encodeCursor
      const encodedCursor = Buffer.from(
        JSON.stringify({ endCursor: "my_cursor" }),
        "utf-8",
      ).toString("base64url");

      await ctx.app.request(`/api/merch?cursor=${encodedCursor}`);
      expect(mockGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({ after: "my_cursor" }),
      );
    });

    it("returns 503 when Shopify not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetProducts.mockResolvedValue({
        ok: false,
        error: new AppError("MERCH_NOT_CONFIGURED", "Not configured", 503),
      });

      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(503);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("MERCH_NOT_CONFIGURED");
    });

    it("returns 502 on Shopify API error", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetProducts.mockResolvedValue({
        ok: false,
        error: new AppError("SHOPIFY_ERROR", "Shopify API failed", 502),
      });

      const res = await ctx.app.request("/api/merch");
      expect(res.status).toBe(502);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("SHOPIFY_ERROR");
    });
  });

  // ── GET /api/merch/:handle ──

  describe("GET /api/merch/:handle", () => {
    it("returns product detail with all fields", async () => {
      const res = await ctx.app.request("/api/merch/test-tshirt");
      expect(res.status).toBe(200);
      const body = await res.json() as {
        handle: string;
        title: string;
        description: string;
        images: unknown[];
        variants: unknown[];
      };
      expect(body.handle).toBe("test-tshirt");
      expect(body.title).toBe("Test T-Shirt");
      expect(body.description).toBe("A high-quality test t-shirt for unit testing.");
      expect(Array.isArray(body.images)).toBe(true);
      expect(Array.isArray(body.variants)).toBe(true);
    });

    it("converts variant prices to integer cents", async () => {
      const res = await ctx.app.request("/api/merch/test-tshirt");
      expect(res.status).toBe(200);
      const body = await res.json() as { variants: Array<{ price: number }> };
      expect(body.variants[0]?.price).toBe(2500);
    });

    it("flattens image edges to images array", async () => {
      const res = await ctx.app.request("/api/merch/test-tshirt");
      expect(res.status).toBe(200);
      const body = await res.json() as { images: Array<{ url: string; altText: string | null }> };
      expect(body.images).toHaveLength(1);
      expect(body.images[0]?.url).toBe("https://cdn.shopify.com/s/files/test.jpg");
      expect(body.images[0]?.altText).toBe("Test T-Shirt");
    });

    it("maps availableForSale to available", async () => {
      const res = await ctx.app.request("/api/merch/test-tshirt");
      expect(res.status).toBe(200);
      const body = await res.json() as { variants: Array<{ available: boolean }> };
      expect(body.variants[0]?.available).toBe(true);
    });

    it("extracts creatorId and creatorName from detail", async () => {
      const res = await ctx.app.request("/api/merch/test-tshirt");
      expect(res.status).toBe(200);
      const body = await res.json() as { creatorId: string | null; creatorName: string | null };
      expect(body.creatorId).toBe("user_test123");
      expect(body.creatorName).toBe("Test Creator");
    });

    it("returns 404 for non-existent handle", async () => {
      mockGetProductByHandle.mockResolvedValue({
        ok: true,
        value: null,
      });

      const res = await ctx.app.request("/api/merch/nonexistent");
      expect(res.status).toBe(404);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 503 when Shopify not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetProductByHandle.mockResolvedValue({
        ok: false,
        error: new AppError("MERCH_NOT_CONFIGURED", "Not configured", 503),
      });

      const res = await ctx.app.request("/api/merch/test-tshirt");
      expect(res.status).toBe(503);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("MERCH_NOT_CONFIGURED");
    });

    it("returns 502 on Shopify API error", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetProductByHandle.mockResolvedValue({
        ok: false,
        error: new AppError("SHOPIFY_ERROR", "Shopify API failed", 502),
      });

      const res = await ctx.app.request("/api/merch/test-tshirt");
      expect(res.status).toBe(502);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("SHOPIFY_ERROR");
    });
  });

  // ── POST /api/merch/checkout ──

  describe("POST /api/merch/checkout", () => {
    it("returns checkout URL for valid input", async () => {
      const res = await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: "gid://shopify/ProductVariant/1001",
          quantity: 1,
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { checkoutUrl: string };
      expect(body.checkoutUrl).toBe("https://test-store.myshopify.com/cart/c/mock");
    });

    it("passes variantId and quantity to service", async () => {
      await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: "gid://shopify/ProductVariant/9999",
          quantity: 2,
        }),
      });
      expect(mockCreateCheckoutUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: "gid://shopify/ProductVariant/9999",
          quantity: 2,
        }),
      );
    });

    it("passes return URL derived from CORS_ORIGIN", async () => {
      await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: "gid://shopify/ProductVariant/1001",
          quantity: 1,
        }),
      });
      expect(mockCreateCheckoutUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          returnUrl: expect.stringContaining("/merch?status=success") as string,
        }),
      );
    });

    it("returns 400 for missing variantId", async () => {
      const res = await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for empty variantId", async () => {
      const res = await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: "", quantity: 1 }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for quantity above maximum (11)", async () => {
      const res = await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: "gid://shopify/ProductVariant/1", quantity: 11 }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for quantity below minimum (0)", async () => {
      const res = await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: "gid://shopify/ProductVariant/1", quantity: 0 }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 503 when Shopify not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockCreateCheckoutUrl.mockResolvedValue({
        ok: false,
        error: new AppError("MERCH_NOT_CONFIGURED", "Not configured", 503),
      });

      const res = await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: "gid://shopify/ProductVariant/1001",
          quantity: 1,
        }),
      });
      expect(res.status).toBe(503);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("MERCH_NOT_CONFIGURED");
    });

    it("returns 502 on Shopify API error", async () => {
      const { AppError } = await import("@snc/shared");
      mockCreateCheckoutUrl.mockResolvedValue({
        ok: false,
        error: new AppError("SHOPIFY_ERROR", "Shopify API failed", 502),
      });

      const res = await ctx.app.request("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: "gid://shopify/ProductVariant/1001",
          quantity: 1,
        }),
      });
      expect(res.status).toBe(502);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("SHOPIFY_ERROR");
    });
  });
});
