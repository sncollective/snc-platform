import type {
  MerchCheckoutResponse,
  MerchProduct,
  MerchProductDetail,
  MerchListResponse,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

// ── Public API ──

/**
 * Fetch paginated merch products.
 * Optional params filter by creatorId and control pagination.
 */
export async function fetchProducts(params?: {
  creatorId?: string;
  limit?: number;
  cursor?: string;
}): Promise<MerchListResponse> {
  return apiGet<MerchListResponse>("/api/merch", params);
}

/**
 * Fetch a single merch product by its URL handle.
 */
export async function fetchProductByHandle(
  handle: string,
): Promise<MerchProductDetail> {
  return apiGet<MerchProductDetail>(
    `/api/merch/${encodeURIComponent(handle)}`,
  );
}

/**
 * Create a Shopify checkout session for a product variant.
 * Returns the Shopify checkout URL.
 */
export async function createMerchCheckout(
  variantId: string,
  quantity?: number,
): Promise<string> {
  const data = await apiMutate<MerchCheckoutResponse>(
    "/api/merch/checkout",
    { body: { variantId, quantity } },
  );
  return data.checkoutUrl;
}
