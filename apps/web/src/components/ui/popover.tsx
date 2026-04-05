import type { ComponentProps } from "react";
import { Popover as ArkPopover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import styles from "./popover.module.css";

// ── Public API ──

/** Non-modal popover overlay. */
export function PopoverRoot(props: ComponentProps<typeof ArkPopover.Root>) {
  return <ArkPopover.Root {...props} />;
}

/** Button that toggles the popover. Passes through without styling. */
export const PopoverTrigger = ArkPopover.Trigger;

/** Positioned popover content. Renders in a Portal. */
export function PopoverContent(props: ComponentProps<typeof ArkPopover.Content>) {
  return (
    <Portal>
      <ArkPopover.Positioner className={styles.positioner}>
        <ArkPopover.Content className={styles.content} {...props} />
      </ArkPopover.Positioner>
    </Portal>
  );
}

/** Popover heading. */
export function PopoverTitle(props: ComponentProps<typeof ArkPopover.Title>) {
  return <ArkPopover.Title className={styles.title} {...props} />;
}

/** Popover description text. */
export function PopoverDescription(props: ComponentProps<typeof ArkPopover.Description>) {
  return <ArkPopover.Description className={styles.description} {...props} />;
}

/** Button that closes the popover. */
export function PopoverCloseTrigger(props: ComponentProps<typeof ArkPopover.CloseTrigger>) {
  return <ArkPopover.CloseTrigger className={styles.close} {...props} />;
}

/** Optional alternate positioning anchor (different from trigger). */
export const PopoverAnchor = ArkPopover.Anchor;
