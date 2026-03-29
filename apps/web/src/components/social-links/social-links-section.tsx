import type React from "react";
import { clsx } from "clsx/lite";

import type { SocialLink } from "@snc/shared";
import { PLATFORM_CONFIG } from "@snc/shared";

import { PlatformIcon } from "./platform-icon.js";

import sectionStyles from "../../styles/detail-section.module.css";
import styles from "./social-links-section.module.css";

// ── Public Types ──

export interface SocialLinksSectionProps {
  readonly socialLinks: readonly SocialLink[];
}

// ── Public API ──

/** Render a creator's social links as a labelled icon list, or null when empty. */
export function SocialLinksSection({
  socialLinks,
}: SocialLinksSectionProps): React.ReactElement | null {
  if (socialLinks.length === 0) {
    return null;
  }

  return (
    <section className={clsx(sectionStyles.section, styles.section)}>
      <h2 className={clsx(sectionStyles.sectionHeading, styles.sectionHeading)}>Links</h2>
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
