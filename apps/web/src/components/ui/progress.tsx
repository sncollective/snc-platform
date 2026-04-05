import type { ComponentProps } from "react";
import { Progress as ArkProgress } from "@ark-ui/react/progress";
import styles from "./progress.module.css";

// ── Public API ──

/** Linear progress bar. Set value to null for indeterminate. */
export function ProgressRoot(props: ComponentProps<typeof ArkProgress.Root>) {
  return <ArkProgress.Root className={styles.root} {...props} />;
}

/** Progress bar label. */
export function ProgressLabel(props: ComponentProps<typeof ArkProgress.Label>) {
  return <ArkProgress.Label className={styles.label} {...props} />;
}

/** Percentage text display. */
export function ProgressValueText(props: ComponentProps<typeof ArkProgress.ValueText>) {
  return <ArkProgress.ValueText className={styles.valueText} {...props} />;
}

/** Track (background) of the progress bar. */
export function ProgressTrack(props: ComponentProps<typeof ArkProgress.Track>) {
  return <ArkProgress.Track className={styles.track} {...props} />;
}

/** Filled range (foreground) of the progress bar. */
export function ProgressRange(props: ComponentProps<typeof ArkProgress.Range>) {
  return <ArkProgress.Range className={styles.range} {...props} />;
}
