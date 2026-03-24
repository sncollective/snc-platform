import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import {
  MerchListQuerySchema,
  MerchListResponseSchema,
  MerchProductDetailSchema,
  MerchCheckoutRequestSchema,
  MerchCheckoutResponseSchema,
  CREATOR_TAG_PREFIX,
  NotFoundError,
} from "@snc/shared";
import type {
  MerchProduct,
  MerchProductDetail,
  MerchVariant,
  MerchListQuery,
} from "@snc/shared";

import {
  getProducts,
  getProductByHandle,
  createCheckoutUrl,
} from "../services/shopify.js";
import { getFrontendBaseUrl } from "../lib/route-utils.js";
import type { ShopifyProductNode } from "../services/shopify.js";
import {
  ERROR_400,
  ERROR_404,
  ERROR_502,
  ERROR_503,
} from "../lib/openapi-errors.js";
import { encodeCursor, decodeRawCursor } from "../lib/cursor.js";

// ── Private Helpers ──

const priceToCents = (amount: string): number =>
  Math.round(parseFloat(amount) * 100);

const extractCreatorId = (tags: readonly string[]): string | null => {
  const tag = tags.find((t) => t.startsWith(CREATOR_TAG_PREFIX));
  return tag !== undefined ? tag.slice(CREATOR_TAG_PREFIX.length) : null;
};

const toMerchProduct = (node: ShopifyProductNode): MerchProduct => ({
  handle: node.handle,
  title: node.title,
  price: priceToCents(node.priceRange.minVariantPrice.amount),
  image: node.featuredImage,
  creatorName: node.vendor || null,
  creatorId: extractCreatorId(node.tags),
});

const toMerchProductDetail = (
  node: ShopifyProductNode,
): MerchProductDetail => ({
  ...toMerchProduct(node),
  description: node.description,
  images: node.images.edges.map((e) => e.node),
  variants: node.variants.edges.map(
    (e): MerchVariant => ({
      id: e.node.id,
      title: e.node.title,
      price: priceToCents(e.node.price.amount),
      available: e.node.availableForSale,
    }),
  ),
});

// ── Public API ──

export const merchRoutes = new Hono();

// GET / — List products
merchRoutes.get(
  "/",
  describeRoute({
    description: "List merchandise products with optional filtering and pagination",
    tags: ["merch"],
    responses: {
      200: {
        description: "Paginated product list",
        content: {
          "application/json": { schema: resolver(MerchListResponseSchema) },
        },
      },
      400: ERROR_400,
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  validator("query", MerchListQuerySchema),
  async (c) => {
    const { limit, cursor, creatorId } =
      c.req.valid("query" as never) as MerchListQuery;

    let after: string | undefined;
    if (cursor !== undefined) {
      try {
        const decoded = decodeRawCursor(cursor);
        after = decoded.endCursor;
      } catch {
        after = undefined;
      }
    }

    const params: Parameters<typeof getProducts>[0] = { first: limit };
    if (after !== undefined) params.after = after;
    if (creatorId !== undefined) params.creatorId = creatorId;
    const result = await getProducts(params);
    if (!result.ok) throw result.error;

    const { products, pageInfo } = result.value;
    const items = products.map(toMerchProduct);

    let nextCursor: string | null = null;
    if (pageInfo.hasNextPage && pageInfo.endCursor !== null) {
      nextCursor = encodeCursor({ endCursor: pageInfo.endCursor });
    }

    return c.json({ items, nextCursor });
  },
);

// GET /:handle — Get product by handle
merchRoutes.get(
  "/:handle",
  describeRoute({
    description: "Get merchandise product details by handle",
    tags: ["merch"],
    responses: {
      200: {
        description: "Product detail",
        content: {
          "application/json": { schema: resolver(MerchProductDetailSchema) },
        },
      },
      404: ERROR_404,
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  async (c) => {
    const handle = c.req.param("handle");

    const result = await getProductByHandle(handle);
    if (!result.ok) throw result.error;

    if (result.value === null) {
      throw new NotFoundError("Product not found");
    }

    return c.json(toMerchProductDetail(result.value));
  },
);

// POST /checkout — Create Shopify checkout
merchRoutes.post(
  "/checkout",
  describeRoute({
    description:
      "Create a Shopify checkout session and return the checkout URL",
    tags: ["merch"],
    responses: {
      200: {
        description: "Checkout URL created",
        content: {
          "application/json": {
            schema: resolver(MerchCheckoutResponseSchema),
          },
        },
      },
      400: ERROR_400,
      502: ERROR_502,
      503: ERROR_503,
    },
  }),
  validator("json", MerchCheckoutRequestSchema),
  async (c) => {
    const { variantId, quantity } = c.req.valid("json");
    const returnUrl = `${getFrontendBaseUrl()}/merch?status=success`;

    const result = await createCheckoutUrl({ variantId, quantity, returnUrl });
    if (!result.ok) throw result.error;

    return c.json({ checkoutUrl: result.value });
  },
);
