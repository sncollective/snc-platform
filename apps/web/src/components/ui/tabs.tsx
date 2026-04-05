import type { ComponentProps } from "react";
import { Tabs as ArkTabs } from "@ark-ui/react/tabs";
import styles from "./tabs.module.css";

// ── Public API ──

/** Tabbed content container. */
export function TabsRoot(props: ComponentProps<typeof ArkTabs.Root>) {
  return <ArkTabs.Root className={styles.root} {...props} />;
}

/** Container for tab triggers. */
export function TabsList(props: ComponentProps<typeof ArkTabs.List>) {
  return <ArkTabs.List className={styles.list} {...props} />;
}

/** Individual tab trigger button. */
export function TabsTrigger(props: ComponentProps<typeof ArkTabs.Trigger>) {
  return <ArkTabs.Trigger className={styles.trigger} {...props} />;
}

/** Tab content panel. Value must match a trigger's value. */
export function TabsContent(props: ComponentProps<typeof ArkTabs.Content>) {
  return <ArkTabs.Content className={styles.content} {...props} />;
}

/** Animated active tab indicator. */
export function TabsIndicator() {
  return <ArkTabs.Indicator className={styles.indicator} />;
}
