import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import type React from "react";
import type { CreatorProfileResponse, PressPagePayload, ReleaseOneSheet } from "@snc/shared";

import { fetchApiServer } from "../../../../../lib/api-server.js";
import { isApiServerError } from "../../../../../lib/errors.js";
import styles from "./release.module.css";

const parentRoute = getRouteApi("/creators/$creatorId");

interface OneSheetLoaderData {
  readonly release: ReleaseOneSheet;
  readonly press: PressPagePayload;
}

export const Route = createFileRoute("/creators/$creatorId/press/releases/$releaseSlug")({
  loader: async ({ params }): Promise<OneSheetLoaderData> => {
    try {
      const [release, press] = await Promise.all([
        fetchApiServer({
          data: `/api/creators/${encodeURIComponent(params.creatorId)}/press/releases/${encodeURIComponent(params.releaseSlug)}`,
        }) as Promise<ReleaseOneSheet>,
        fetchApiServer({
          data: `/api/creators/${encodeURIComponent(params.creatorId)}/press`,
        }) as Promise<PressPagePayload>,
      ]);
      return { release, press };
    } catch (error) {
      if (isApiServerError(error) && error.statusCode === 404) {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { release, press } = loaderData;
    const creator = press?.creator;
    const displayName = creator?.displayName ?? "S/NC creator";
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const canonicalSlug = creator?.handle ?? creator?.id;
    const canonicalUrl = canonicalSlug
      ? `${siteUrl}/creators/${canonicalSlug}/press/releases/${encodeURIComponent(release.slug)}`
      : `${siteUrl}/creators/press/releases/${encodeURIComponent(release.slug)}`;
    const description = `${release.title} — one-sheet for ${displayName}.`;
    const imageUrl = press?.content.photos[0]
      ? `${siteUrl}/api/creators/${encodeURIComponent(press.creator.id)}/press/photos/0`
      : null;

    return {
      meta: [
        { title: `${release.title} — ${displayName} — S/NC` },
        { name: "description", content: description },
        { property: "og:title", content: `${release.title} — ${displayName}` },
        { property: "og:description", content: description },
        { property: "og:type", content: "music.song" },
        { property: "og:url", content: canonicalUrl },
        ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
        { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: `${release.title} — ${displayName}` },
        { name: "twitter:description", content: description },
        ...(imageUrl ? [{ name: "twitter:image", content: imageUrl }] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  notFoundComponent: ReleaseOneSheetNotFound,
  component: ReleaseOneSheetPage,
});

const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function ReleaseOneSheetNotFound(): React.ReactElement {
  return (
    <article className={styles.page}>
      <h1 className={styles.heading}>One-sheet unavailable</h1>
      <p className={styles.lead}>This release one-sheet could not be found.</p>
    </article>
  );
}

function ReleaseOneSheetPage(): React.ReactElement {
  const creator = parentRoute.useLoaderData() as CreatorProfileResponse | null;
  const { release, press } = Route.useLoaderData();
  const displayName = creator?.displayName ?? press.creator.displayName;
  const creatorId = creator?.id ?? press.creator.id;
  const downloadUrl = `${apiBase}/api/creators/${encodeURIComponent(creatorId)}/press/releases/${encodeURIComponent(release.slug)}/one-sheet.pdf`;

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>S/NC one-sheet</p>
        <h1 className={styles.heading}>{release.title}</h1>
        <p className={styles.artist}>{displayName}</p>
        <a className={styles.download} href={downloadUrl} download>
          Download one-sheet (PDF)
        </a>
      </header>

      <dl className={styles.metadata}>
        {release.catalogNumber && <Metadata label="Catalog" value={release.catalogNumber} />}
        {release.releaseDate && <Metadata label="Release date" value={release.releaseDate} />}
        {release.format && <Metadata label="Format" value={release.format} />}
        {release.genre && <Metadata label="Genre" value={release.genre} />}
        {release.isrc && <Metadata label="ISRC" value={release.isrc} />}
        {release.upc && <Metadata label="UPC" value={release.upc} />}
        {release.duration && <Metadata label="Duration" value={release.duration} />}
        {release.fcc && <Metadata label="FCC" value={release.fcc} />}
        {release.label && <Metadata label="Label" value={release.label} />}
        {release.writtenBy && <Metadata label="Written by" value={release.writtenBy} />}
        {release.producedBy && <Metadata label="Produced by" value={release.producedBy} />}
        {release.mixedMasteredBy && <Metadata label="Mixed / mastered by" value={release.mixedMasteredBy} />}
        {release.copyrightLine && <Metadata label="Copyright" value={release.copyrightLine} />}
        {release.publisherLine && <Metadata label="Publisher" value={release.publisherLine} />}
      </dl>

      {release.personnel.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Personnel</h2>
          <ul className={styles.personnel}>
            {release.personnel.map((person) => <li key={person}>{person}</li>)}
          </ul>
        </section>
      )}
    </article>
  );
}

function Metadata({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className={styles.metadataItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
