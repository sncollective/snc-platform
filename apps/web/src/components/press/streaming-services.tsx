import type React from "react";
import { inferService, type PressContent } from "@snc/shared";

import { StreamingIcon } from "./streaming-icons.js";
import styles from "./streaming-services.module.css";

/** Render creator-authored listening links with an exhaustive service glyph. */
export function StreamingServices({
  links,
}: {
  readonly links: PressContent["streamingLinks"];
}): React.ReactElement | null {
  if (links.length === 0) return null;

  return (
    <div className={styles.services}>
      {links.map((link) => {
        const service = link.service ?? inferService(link.url);
        return (
          <a
            key={`${link.label}-${link.url}`}
            className={styles.service}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Listen on ${link.label}`}
          >
            <StreamingIcon service={service} />
            {link.label}
          </a>
        );
      })}
    </div>
  );
}
