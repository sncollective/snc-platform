import type React from "react";
import type { SocialLink } from "@snc/shared";
import { PLATFORM_CONFIG } from "@snc/shared";

import { PlatformIcon } from "./platform-icon.js";
import sectionStyles from "../../styles/detail-section.module.css";
import styles from "./social-links-section.module.css";

// ── Public Types ──

export interface SocialLinksSectionProps {
  readonly socialLinks: SocialLink[];
}

// ── Public API ──

export function SocialLinksSection({
  socialLinks,
}: SocialLinksSectionProps): React.ReactElement | null {
  if (socialLinks.length === 0) {
    return null;
  }

  return (
    <section className={`${sectionStyles.section} ${styles.section}`}>
      <h2 className={`${sectionStyles.sectionHeading} ${styles.sectionHeading}`}>Links</h2>
      <div className={styles.linkList}>
        {socialLinks.map((link) => (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkPill}
          >
            <PlatformIcon platform={link.platform} />
            <span className={styles.linkLabel}>
              {link.label ?? PLATFORM_CONFIG[link.platform].displayName}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
