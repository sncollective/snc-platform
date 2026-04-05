import type { ComponentProps } from "react";
import { Menu as ArkMenu } from "@ark-ui/react/menu";
import { Portal } from "@ark-ui/react/portal";
import styles from "./menu.module.css";

// ── Public API ──

/** Dropdown menu root. Manages open state and keyboard navigation. */
export function MenuRoot(props: ComponentProps<typeof ArkMenu.Root>) {
  return <ArkMenu.Root {...props} />;
}

/** Button that opens the menu. Passes through without styling. */
export const MenuTrigger = ArkMenu.Trigger;

/** Positioned menu dropdown. Renders in a Portal. */
export function MenuContent(props: ComponentProps<typeof ArkMenu.Content>) {
  return (
    <Portal>
      <ArkMenu.Positioner className={styles.positioner}>
        <ArkMenu.Content className={styles.content} {...props} />
      </ArkMenu.Positioner>
    </Portal>
  );
}

/** Individual menu item. */
export function MenuItem(props: ComponentProps<typeof ArkMenu.Item>) {
  return <ArkMenu.Item className={styles.item} {...props} />;
}

/** Visual divider between menu items. */
export function MenuSeparator() {
  return <ArkMenu.Separator className={styles.separator} />;
}

/** Group of related menu items with a label. */
export function MenuItemGroup(props: ComponentProps<typeof ArkMenu.ItemGroup>) {
  return <ArkMenu.ItemGroup className={styles.group} {...props} />;
}

/** Label for a menu item group. */
export function MenuItemGroupLabel(props: ComponentProps<typeof ArkMenu.ItemGroupLabel>) {
  return <ArkMenu.ItemGroupLabel className={styles.groupLabel} {...props} />;
}
