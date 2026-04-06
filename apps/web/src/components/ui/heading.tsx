import type { HTMLAttributes } from "react";
import styles from "./heading.module.css";

// ── Types ──

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

// ── Default size per level ──

const LEVEL_SIZE_DEFAULTS: Record<HeadingLevel, HeadingSize> = {
  1: "3xl",
  2: "2xl",
  3: "xl",
  4: "lg",
  5: "md",
  6: "sm",
};

// ── Props ──

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** HTML heading level to render (h1–h6). */
  level: HeadingLevel;
  /**
   * Visual size, independent of the heading level. Defaults to the level's
   * canonical size (h1→3xl, h2→2xl, h3→xl, h4→lg, h5→md, h6→sm).
   */
  size?: HeadingSize;
}

// ── Component ──

/**
 * Semantic heading. Renders the correct h-tag for the given level while
 * allowing independent visual size control via the `size` prop.
 *
 * Migration note: `styles/page-heading.module.css` and the `.heading` class
 * in `listing-page.module.css` / `landing-section.module.css` are superseded
 * by this component. Call site migration is a follow-up task.
 */
export function Heading({ level, size, className, children, ...rest }: HeadingProps) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const resolvedSize = size ?? LEVEL_SIZE_DEFAULTS[level];
  const combinedClassName = className ? `${styles.heading} ${className}` : styles.heading;

  return (
    <Tag
      data-size={resolvedSize}
      className={combinedClassName}
      {...rest}
    >
      {children}
    </Tag>
  );
}
