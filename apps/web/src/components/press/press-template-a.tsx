import type React from "react";

import { PressCarousel } from "./press-carousel.js";
import {
  AboutSection,
  HighlightsSection,
  ListenSection,
  LiveDatesSection,
  MembersSection,
  PressDownloadAction,
  PressFooter,
  QuotesSection,
  PressHero,
} from "./press-sections.js";
import type { PressTemplateProps } from "./press-types.js";
import styles from "./press-template-a.module.css";

/** Compose Template A's clean editorial press page. */
export function PressTemplateA(props: PressTemplateProps): React.ReactElement {
  const { creator, content, fullPressPdfUrl, oneSheetUrl, liveDates } = props;
  return (
    <div className={styles.template} data-press-template="A">
      <PressDownloadAction fullPressPdfUrl={fullPressPdfUrl} />
      <PressHero creator={creator} content={content} />
      <article className={styles.editorial}>
        <AboutSection content={content} />
        <QuotesSection quotes={content.pressQuotes} />
        <MembersSection members={content.members} showBio />
        <HighlightsSection highlights={content.highlights} limit={2} />
        <LiveDatesSection dates={liveDates} liveDatesUrl={content.liveDatesUrl} />
        <ListenSection links={content.streamingLinks} />
        <PressCarousel creatorName={creator.displayName} images={content.gallery} />
      </article>
      <PressFooter email={content.pressContactEmail} bookingEmail={content.bookingContactEmail} photographyCredits={content.photographyCredits} fullPressPdfUrl={fullPressPdfUrl} oneSheetUrl={oneSheetUrl} />
    </div>
  );
}
