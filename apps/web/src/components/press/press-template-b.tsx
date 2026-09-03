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
import styles from "./press-template-b.module.css";

/** Compose Template B's dense two-column editorial zone. */
export function PressTemplateB(props: PressTemplateProps): React.ReactElement {
  const { creator, content, fullPressPdfUrl, oneSheetUrl, liveDates } = props;
  return (
    <div className={styles.template} data-press-template="B">
      <PressDownloadAction fullPressPdfUrl={fullPressPdfUrl} />
      <PressHero creator={creator} content={content} />
      <article className={styles.editorial}>
        <AboutSection content={content} />
        <QuotesSection quotes={content.pressQuotes} />
        {(content.members.length > 0 || content.highlights.length > 0) && (
          <div className={styles.midZone}>
            <MembersSection members={content.members} showBio={false} variant="zone" />
            <HighlightsSection highlights={content.highlights} limit={3} variant="zone" />
          </div>
        )}
        <LiveDatesSection dates={liveDates} liveDatesUrl={content.liveDatesUrl} />
        <ListenSection links={content.streamingLinks} />
        <PressCarousel creatorName={creator.displayName} images={content.gallery} />
      </article>
      <PressFooter email={content.pressContactEmail} bookingEmail={content.bookingContactEmail} photographyCredits={content.photographyCredits} fullPressPdfUrl={fullPressPdfUrl} oneSheetUrl={oneSheetUrl} />
    </div>
  );
}
