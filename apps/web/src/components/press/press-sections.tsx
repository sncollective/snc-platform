import type React from "react";

import { PressImageFigure } from "./press-image.js";
import { StreamingServices } from "./streaming-services.js";
import type {
  DeliveredPressContent,
  PressLiveDate,
  PressTemplateProps,
} from "./press-types.js";
import styles from "./press-sections.module.css";

interface SectionVariantProps {
  readonly variant?: "default" | "zone";
}

/** Render the shared full-bleed press hero. */
export function PressHero({
  creator,
  content,
}: Pick<PressTemplateProps, "creator" | "content">): React.ReactElement {
  const location = content.location ?? creator.location;
  return (
    <header className={styles.hero} aria-labelledby="press-band-name">
      <PressImageFigure
        image={content.banner}
        slot="banner"
        creditMode="overlay"
        loading="eager"
        fetchPriority="high"
        className={styles.banner!}
      />
      <div className={styles.wordmark}>
        <h1 id="press-band-name">{creator.displayName}</h1>
        {(location || content.tagline) && (
          <div className={styles.heroFacts}>
            {location && <span>{location}</span>}
            {content.tagline && <span>{content.tagline}</span>}
          </div>
        )}
      </div>
    </header>
  );
}

/** Render biography, portrait, and affinity tags when supplied. */
export function AboutSection({
  content,
}: Pick<PressTemplateProps, "content">): React.ReactElement | null {
  const paragraphs = content.longBio
    ?.split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean) ?? [];
  const hasContent = Boolean(
    content.shortBio || paragraphs.length || content.aboutPhoto || content.forFansOf.length,
  );
  if (!hasContent) return null;

  return (
    <section className={`${styles.section} ${styles.about}`} aria-labelledby="press-about-heading">
      <h2 className={styles.kicker} id="press-about-heading">About</h2>
      {content.shortBio && <p className={styles.deck}>{content.shortBio}</p>}
      <PressImageFigure image={content.aboutPhoto} slot="about" className={styles.aboutPhoto!} />
      {paragraphs.length > 0 && (
        <div className={styles.bio}>
          {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      )}
      {content.forFansOf.length > 0 && (
        <div className={styles.fansCluster} aria-labelledby="press-fans-heading">
          <h3 className={styles.kicker} id="press-fans-heading">For fans of</h3>
          <ul className={styles.fans}>
            {content.forFansOf.map((name) => <li className={styles.pill} key={name}>{name}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Render ordered band members with optional biography copy. */
export function MembersSection({
  members,
  showBio,
  variant = "default",
}: {
  readonly members: DeliveredPressContent["members"];
  readonly showBio: boolean;
} & SectionVariantProps): React.ReactElement | null {
  if (members.length === 0) return null;

  return (
    <section className={`${styles.section} ${variant === "zone" ? styles.zoneSection : ""}`} aria-labelledby="press-members-heading">
      <h2 className={styles.kicker} id="press-members-heading">Members</h2>
      <div className={`${styles.members} ${variant === "zone" ? styles.zoneMembers : ""}`}>
        {members.map((member) => (
          <article className={`${styles.member} ${variant === "zone" ? styles.zoneMember : ""}`} key={member.name}>
            <PressImageFigure image={member.photo} slot="member" creditMode="overlay" />
            <h3>{member.name}</h3>
            {member.role && <p className={styles.role}>{member.role}</p>}
            {showBio && member.bio && <p className={styles.memberBio}>{member.bio}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function HighlightCard({
  highlight,
  index,
  variant,
}: {
  readonly highlight: DeliveredPressContent["highlights"][number];
  readonly index: number;
  readonly variant: "default" | "zone";
}): React.ReactElement {
  const card = (
    <article className={`${styles.highlight} ${styles[`highlight${index % 3}`]} ${variant === "zone" ? styles.zoneHighlight : ""} ${!highlight.coverArt ? styles.highlightNoMedia : ""}`}>
      <PressImageFigure image={highlight.coverArt} slot="cover" creditMode="overlay" />
      <div className={styles.highlightCopy}>
        {highlight.eyebrow && <span className={styles.eyebrow}>{highlight.eyebrow}</span>}
        <h3>{highlight.title}</h3>
        {highlight.metric && <div className={styles.metric}>{highlight.metric}</div>}
        {highlight.description && <p>{highlight.description}</p>}
      </div>
    </article>
  );

  return highlight.url ? (
    <a className={styles.highlightLink} href={highlight.url} target="_blank" rel="noopener noreferrer">
      {card}
    </a>
  ) : card;
}

/** Render the requested number of ordered press highlights. */
export function HighlightsSection({
  highlights,
  limit,
  variant = "default",
}: {
  readonly highlights: DeliveredPressContent["highlights"];
  readonly limit: 2 | 3;
} & SectionVariantProps): React.ReactElement | null {
  const visible = highlights.slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <section className={`${styles.section} ${variant === "zone" ? styles.zoneSection : ""}`} aria-labelledby="press-highlights-heading">
      <h2 className={styles.kicker} id="press-highlights-heading">Highlights</h2>
      <div className={`${styles.highlights} ${variant === "zone" ? styles.zoneHighlights : ""}`}>
        {visible.map((highlight, index) => (
          <HighlightCard key={`${highlight.title}-${index}`} highlight={highlight} index={index} variant={variant} />
        ))}
      </div>
    </section>
  );
}

/** Render supplied live-date rows or the current Bandsintown link-out. */
export function LiveDatesSection({
  dates,
  liveDatesUrl,
}: {
  readonly dates?: readonly PressLiveDate[] | undefined;
  readonly liveDatesUrl?: string | null | undefined;
}): React.ReactElement | null {
  if ((!dates || dates.length === 0) && !liveDatesUrl) return null;

  return (
    <section className={styles.section} aria-labelledby="press-live-heading">
      <h2 className={styles.kicker} id="press-live-heading">Live dates</h2>
      {dates && dates.length > 0 && (
        <div className={styles.dates}>
          {dates.map((date) => (
            <div className={styles.date} key={date.id}>
              <time dateTime={date.dateTime}>{date.dateLabel}</time>
              <strong>{date.venue}</strong>
              <span className={styles.city}>{date.city}</span>
              <a href={date.ticketUrl} target="_blank" rel="noopener noreferrer">Tickets ↗</a>
            </div>
          ))}
        </div>
      )}
      {liveDatesUrl && (
        <a className={styles.more} href={liveDatesUrl} target="_blank" rel="noopener noreferrer">
          More on Bandsintown ↗
        </a>
      )}
    </section>
  );
}

/** Render the shared Listen section when destinations exist. */
export function ListenSection({
  links,
}: {
  readonly links: DeliveredPressContent["streamingLinks"];
}): React.ReactElement | null {
  if (links.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="press-listen-heading">
      <h2 className={styles.kicker} id="press-listen-heading">Listen</h2>
      <StreamingServices links={links} />
    </section>
  );
}

/** Render the fixed full-kit download action used by both templates. */
export function PressDownloadAction({ fullPressPdfUrl }: Pick<PressTemplateProps, "fullPressPdfUrl">): React.ReactElement {
  return <a className={styles.downloadPin} href={fullPressPdfUrl} download>Full press PDF ↓</a>;
}

/** Render press contact and distinct full-kit and one-sheet downloads. */
export function PressFooter({
  email,
  fullPressPdfUrl,
  oneSheetUrl,
}: {
  readonly email?: string | null | undefined;
  readonly fullPressPdfUrl: string;
  readonly oneSheetUrl: string;
}): React.ReactElement {
  return (
    <footer className={styles.footer}>
      {email ? <span>Press · <a href={`mailto:${email}`}>{email}</a></span> : <span />}
      <div className={styles.pdfActions}>
        <a className={styles.pdf} href={fullPressPdfUrl} download>Download full press PDF ↓</a>
        <a className={styles.pdf} href={oneSheetUrl} download>Download one-sheet PDF ↓</a>
      </div>
    </footer>
  );
}
