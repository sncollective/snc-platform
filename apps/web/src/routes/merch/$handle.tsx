import type React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { MerchProductDetail } from "@snc/shared";

import { ProductDetail } from "../../components/merch/product-detail.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";

// ── Route ──

export const Route = createFileRoute("/merch/$handle")({
  beforeLoad: () => {
    if (!isFeatureEnabled("merch")) throw redirect({ to: "/" });
  },
  loader: async ({ params }): Promise<MerchProductDetail> => {
    try {
      return (await fetchApiServer({
        data: `/api/merch/${encodeURIComponent(params.handle)}`,
      })) as MerchProductDetail;
    } catch {
      throw redirect({ to: "/merch" });
    }
  },
  component: MerchDetailPage,
});

// ── Component ──

function MerchDetailPage(): React.ReactElement {
  const product = Route.useLoaderData();
  return <ProductDetail product={product} />;
}
