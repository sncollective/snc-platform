import type React from "react";

import styles from "./studio-hero.module.css";

// ── Public API ──

export function StudioHero(): React.ReactElement {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>S/NC Studio</h1>
        <p className={styles.subheading}>
          Recording studio for tracking, mixing, mastering, podcast, practice
          space, live shows, and venue rental.
        </p>
      </div>
    </section>
  );
}
