import { createFileRoute, notFound } from "@tanstack/react-router";
import type React from "react";

import { SignatureChip } from "../../../components/brand/signature-chip.js";
import { PressPage } from "../../../components/press/press-page.js";
import type { DeliveredPressPagePayload } from "../../../components/press/press-types.js";
import { fetchApiServer } from "../../../lib/api-server.js";
import { isApiServerError } from "../../../lib/errors.js";
import styles from "./press.module.css";

const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const pressEndpoint = (creatorId: string, suffix: string): string =>
  `${apiBase}/api/creators/${encodeURIComponent(creatorId)}${suffix}`;

const absoluteImageUrl = (src: string, siteUrl: string): string =>
  /^https?:\/\//i.test(src) ? src : `${siteUrl}${src}`;

export const Route = createFileRoute("/creators/$creatorId/press")({
  loader: async ({ params }): Promise<DeliveredPressPagePayload> => {
    try {
      return (await fetchApiServer({
        data: `/api/creators/${encodeURIComponent(params.creatorId)}/press`,
      })) as DeliveredPressPagePayload;
    } catch (error) {
      if (isApiServerError(error) && error.statusCode === 404) throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { creator, content } = loaderData;
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const canonicalSlug = creator.handle ?? creator.id;
    const canonicalUrl = `${siteUrl}/creators/${canonicalSlug}/press`;
    const description = content.shortBio ?? `Press kit for ${creator.displayName}.`;
    const deliveredImage = content.banner ?? content.aboutPhoto ?? content.gallery[0] ?? null;
    const imageUrl = deliveredImage ? absoluteImageUrl(deliveredImage.src, siteUrl) : null;

    return {
      meta: [
        { title: `${creator.displayName} — Press kit — S/NC` },
        { name: "description", content: description },
        { property: "og:title", content: `${creator.displayName} — Press kit` },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: canonicalUrl },
        ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
        { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: `${creator.displayName} — Press kit` },
        { name: "twitter:description", content: description },
        ...(imageUrl ? [{ name: "twitter:image", content: imageUrl }] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  notFoundComponent: PressPageNotFound,
  component: PressRoutePage,
});

function PressPageNotFound(): React.ReactElement {
  return (
    <article className={styles.unavailable}>
      <h1>Press kit unavailable</h1>
      <p>This creator does not have a public press kit yet.</p>
    </article>
  );
}

function PressRoutePage(): React.ReactElement {
  const { creator, content } = Route.useLoaderData();
  const fullPressPdfUrl = pressEndpoint(creator.id, "/press/one-pager.pdf");
  const oneSheetUrl = pressEndpoint(creator.id, "/press/one-sheet.pdf");

  return (
    <div className={styles.breakout}>
      <div className={styles.pressSignature}>
        <SignatureChip voice="records">A1</SignatureChip>
      </div>
      <PressPage
        creator={creator}
        content={content}
        fullPressPdfUrl={fullPressPdfUrl}
        oneSheetUrl={oneSheetUrl}
      />
    </div>
  );
}
