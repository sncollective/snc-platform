import type React from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { MerchProductDetail } from "@snc/shared";

import { ProductDetail } from "../../components/merch/product-detail.js";
import { fetchApiServer } from "../../lib/api-server.js";

// ── Route ──

export const Route = createFileRoute("/merch/$handle")({
  loader: async ({ params }): Promise<MerchProductDetail> => {
    return fetchApiServer({
      data: `/api/merch/${encodeURIComponent(params.handle)}`,
    }) as Promise<MerchProductDetail>;
  },
  component: MerchDetailPage,
});

// ── Component ──

function MerchDetailPage(): React.ReactElement {
  const product = Route.useLoaderData();
  return <ProductDetail product={product} />;
}
