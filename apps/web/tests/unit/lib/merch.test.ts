import { describe, it, expect } from "vitest";

import {
  fetchProducts,
  fetchProductByHandle,
  createMerchCheckout,
} from "../../../src/lib/merch.js";
import {
  makeMockMerchProduct,
  makeMockMerchProductDetail,
} from "../../helpers/merch-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── fetchProducts ──

describe("fetchProducts", () => {
  it("fetches from correct URL with credentials", async () => {
    const products = {
      items: [makeMockMerchProduct()],
      nextCursor: null,
    };
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(products), { status: 200 }),
    );

    const result = await fetchProducts();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/merch",
      { credentials: "include" },
    );
    expect(result).toEqual(products);
  });

  it("passes creatorId as query parameter", async () => {
    const products = { items: [], nextCursor: null };
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(products), { status: 200 }),
    );

    await fetchProducts({ creatorId: "user_abc" });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/merch?creatorId=user_abc",
      { credentials: "include" },
    );
  });

  it("passes cursor and limit as query parameters", async () => {
    const products = { items: [], nextCursor: null };
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(products), { status: 200 }),
    );

    await fetchProducts({ cursor: "abc123", limit: 6 });

    expect(getMockFetch()).toHaveBeenCalledWith(
      expect.stringContaining("/api/merch?"),
      { credentials: "include" },
    );
    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    const params = new URLSearchParams(calledUrl.split("?")[1]);
    expect(params.get("cursor")).toBe("abc123");
    expect(params.get("limit")).toBe("6");
  });

  it("omits undefined parameters from query string", async () => {
    const products = { items: [], nextCursor: null };
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(products), { status: 200 }),
    );

    await fetchProducts({ limit: 12 });

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    const params = new URLSearchParams(calledUrl.split("?")[1]);
    expect(params.has("creatorId")).toBe(false);
    expect(params.get("limit")).toBe("12");
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Service unavailable" } }),
        { status: 503 },
      ),
    );

    await expect(fetchProducts()).rejects.toThrow("Service unavailable");
  });
});

// ── fetchProductByHandle ──

describe("fetchProductByHandle", () => {
  it("fetches from correct URL with credentials", async () => {
    const product = makeMockMerchProductDetail();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(product), { status: 200 }),
    );

    const result = await fetchProductByHandle("test-tshirt");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/merch/test-tshirt",
      { credentials: "include" },
    );
    expect(result).toEqual(product);
  });

  it("encodes special characters in handle", async () => {
    const product = makeMockMerchProductDetail();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(product), { status: 200 }),
    );

    await fetchProductByHandle("my product/special");

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toBe("/api/merch/my%20product%2Fspecial");
  });

  it("throws on 404 response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Product not found" } }),
        { status: 404 },
      ),
    );

    await expect(fetchProductByHandle("nonexistent")).rejects.toThrow(
      "Product not found",
    );
  });
});

// ── createMerchCheckout ──

describe("createMerchCheckout", () => {
  it("posts to correct URL with variant ID and returns checkout URL", async () => {
    const checkoutUrl = "https://shop.example.com/cart/c/abc123";
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ checkoutUrl }), { status: 200 }),
    );

    const result = await createMerchCheckout(
      "gid://shopify/ProductVariant/1001",
    );

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/merch/checkout",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: "gid://shopify/ProductVariant/1001",
        }),
      },
    );
    expect(result).toBe(checkoutUrl);
  });

  it("includes quantity when provided", async () => {
    const checkoutUrl = "https://shop.example.com/cart/c/def456";
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ checkoutUrl }), { status: 200 }),
    );

    const result = await createMerchCheckout(
      "gid://shopify/ProductVariant/1001",
      3,
    );

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/merch/checkout",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: "gid://shopify/ProductVariant/1001",
          quantity: 3,
        }),
      },
    );
    expect(result).toBe(checkoutUrl);
  });

  it("throws on 502 Shopify error", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Shopify unavailable" } }),
        { status: 502 },
      ),
    );

    await expect(
      createMerchCheckout("gid://shopify/ProductVariant/1001"),
    ).rejects.toThrow("Shopify unavailable");
  });

  it("throws on 401 unauthenticated", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(
      createMerchCheckout("gid://shopify/ProductVariant/1001"),
    ).rejects.toThrow("Unauthorized");
  });
});
