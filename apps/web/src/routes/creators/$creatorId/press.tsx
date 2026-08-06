import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import type React from "react";
import type { CreatorProfileResponse, PressPagePayload } from "@snc/shared";

import { fetchApiServer } from "../../../lib/api-server.js";
import { Link } from "@tanstack/react-router";
import styles from "./press.module.css";

const parentRoute = getRouteApi("/creators/$creatorId");

export const Route = createFileRoute("/creators/$creatorId/press")({
  loader: async ({ params }): Promise<PressPagePayload | null> => {
    try {
      return (await fetchApiServer({
        data: `/api/creators/${encodeURIComponent(params.creatorId)}/press`,
      })) as PressPagePayload;
    } catch {
      // Disabled press pages are a normal, user-facing state rather than a
      // route error: keep the shell renderable with a useful empty state.
      return null;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { creator, content } = loaderData;
    const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
    const canonicalSlug = creator.handle ?? creator.id;
    const canonicalUrl = `${siteUrl}/creators/${canonicalSlug}/press`;
    const description = content.shortBio ?? `Press kit for ${creator.displayName}.`;
    const imagePath = content.photos[0]
      ? `/api/creators/${encodeURIComponent(creator.id)}/press/photos/0`
      : null;
    const imageUrl = imagePath ? `${siteUrl}${imagePath}` : null;

    return {
      meta: [
        { title: `${creator.displayName} — Press kit — S/NC` },
        { name: "description", content: description },
        { property: "og:title", content: `${creator.displayName} — Press kit` },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: canonicalUrl },
        ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${creator.displayName} — Press kit` },
        { name: "twitter:description", content: description },
        ...(imageUrl ? [{ name: "twitter:image", content: imageUrl }] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  component: PressPage,
});

const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function pressEndpoint(creatorId: string, suffix: string): string {
  return `${apiBase}/api/creators/${encodeURIComponent(creatorId)}${suffix}`;
}

function PressPage(): React.ReactElement {
  const creator = parentRoute.useLoaderData() as CreatorProfileResponse | null;
  const payload = Route.useLoaderData();

  if (!creator || !payload) {
    return (
      <main className={styles.page}>
        <h1 className={styles.heading}>Press kit unavailable</h1>
        <p className={styles.lead}>
          This creator does not have a public press kit yet.
        </p>
      </main>
    );
  }

  const { content } = payload;
  const downloadUrl = pressEndpoint(creator.id, "/press/one-pager.pdf");
  const photoBase = pressEndpoint(creator.id, "/press/photos");

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>S/NC press kit</p>
        <h1 className={styles.heading}>{creator.displayName}</h1>
        {content.location && (
          <p className={styles.location}>{content.location}</p>
        )}
        {content.shortBio && <p className={styles.lead}>{content.shortBio}</p>}
        <a className={styles.download} href={downloadUrl} download>
          Download one-pager (PDF)
        </a>
      </header>

      {content.photos.length > 0 && (
        <section className={styles.section} aria-labelledby="press-photos-heading">
          <h2 id="press-photos-heading" className={styles.sectionHeading}>Press photos</h2>
          <div className={styles.photoGrid}>
            {content.photos.map((photo, index) => (
              <img
                key={`${photo}-${index}`}
                className={styles.photo}
                src={`${photoBase}/${index}`}
                alt={`${creator.displayName} press photo ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            ))}
          </div>
        </section>
      )}

      {content.longBio && (
        <section className={styles.section} aria-labelledby="about-heading">
          <h2 id="about-heading" className={styles.sectionHeading}>About</h2>
          <p className={styles.body}>{content.longBio}</p>
        </section>
      )}

      {content.forFansOf.length > 0 && (
        <section className={styles.section} aria-labelledby="fans-heading">
          <h2 id="fans-heading" className={styles.sectionHeading}>For fans of</h2>
          <ul className={styles.tagList}>
            {content.forFansOf.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </section>
      )}

      {content.standoutTrack && (
        <section className={styles.feature} aria-labelledby="track-heading">
          <p className={styles.kicker}>Track to know</p>
          <h2 id="track-heading" className={styles.sectionHeading}>
            {content.standoutTrack.url ? (
              <a href={content.standoutTrack.url} target="_blank" rel="noreferrer">
                {content.standoutTrack.title}
              </a>
            ) : content.standoutTrack.title}
          </h2>
          {content.standoutTrack.streamsLabel && (
            <p className={styles.lead}>{content.standoutTrack.streamsLabel}</p>
          )}
        </section>
      )}

      {content.streamingLinks.length > 0 && (
        <section className={styles.section} aria-labelledby="links-heading">
          <h2 id="links-heading" className={styles.sectionHeading}>Listen and watch</h2>
          <ul className={styles.linkList}>
            {content.streamingLinks.map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {content.liveDatesUrl && (
        <section className={styles.section}>
          <a className={styles.textLink} href={content.liveDatesUrl} target="_blank" rel="noreferrer">
            Live dates
          </a>
        </section>
      )}

      {content.releases.length > 0 && (
        <section className={styles.section} aria-labelledby="releases-heading">
          <h2 id="releases-heading" className={styles.sectionHeading}>Releases</h2>
          <ul className={styles.releaseList}>
            {content.releases.map((release) => (
              <li key={release.slug} className={styles.releaseItem}>
                <Link
                  to="/creators/$creatorId/press/releases/$releaseSlug"
                  params={{ creatorId: creator.handle ?? creator.id, releaseSlug: release.slug }}
                  className={styles.textLink}
                >
                  {release.title}
                </Link>
                {release.catalogNumber && <span>{release.catalogNumber}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {content.pressContactEmail && (
        <footer className={styles.contact}>
          <span>Press contact</span>
          <a href={`mailto:${content.pressContactEmail}`}>{content.pressContactEmail}</a>
        </footer>
      )}
    </main>
  );
}
