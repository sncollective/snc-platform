import type { ComponentProps } from "react";
import { Collapsible as ArkCollapsible } from "@ark-ui/react/collapsible";
import styles from "./collapsible.module.css";

// ── Public API ──

/** Expandable/collapsible content section. */
export function CollapsibleRoot(props: ComponentProps<typeof ArkCollapsible.Root>) {
  return <ArkCollapsible.Root className={styles.root} {...props} />;
}

/** Button that toggles the collapsible content. Passes through without styling. */
export const CollapsibleTrigger = ArkCollapsible.Trigger;

/** Content area that expands/collapses. */
export function CollapsibleContent(props: ComponentProps<typeof ArkCollapsible.Content>) {
  return <ArkCollapsible.Content className={styles.content} {...props} />;
}

/** Visual indicator (e.g., chevron icon) that reflects open/closed state. */
export function CollapsibleIndicator(props: ComponentProps<typeof ArkCollapsible.Indicator>) {
  return <ArkCollapsible.Indicator className={styles.indicator} {...props} />;
}
