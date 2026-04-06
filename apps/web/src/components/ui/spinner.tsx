import type { HTMLAttributes } from "react";
import styles from "./spinner.module.css";

// ── Constants (Single Source of Truth) ──

export const SPINNER_SIZES = ["sm", "md", "lg"] as const;
export type SpinnerSize = (typeof SPINNER_SIZES)[number];

// ── Props ──

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual size of the spinner. Defaults to "md". */
  size?: SpinnerSize;
  /** Accessible label announced to screen readers. Defaults to "Loading". */
  label?: string;
}

// ── Component ──

/**
 * Animated loading indicator. Renders a rotating SVG circle with an
 * accessible visually-hidden label. Uses `currentColor` so it inherits
 * from its parent's text color.
 */
export function Spinner({ size = "md", label = "Loading", ...rest }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-size={size}
      className={styles.spinner}
      {...rest}
    >
      <svg
        className={styles.svg}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          className={styles.track}
          cx="12"
          cy="12"
          r="10"
          strokeWidth="2.5"
        />
        <circle
          className={styles.arc}
          cx="12"
          cy="12"
          r="10"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
