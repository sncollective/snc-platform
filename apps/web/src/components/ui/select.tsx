import type { ComponentProps } from "react";
import { Select as ArkSelect, createListCollection } from "@ark-ui/react/select";
import { Portal } from "@ark-ui/react/portal";
import styles from "./select.module.css";

// ── Re-export collection factory ──

export { createListCollection };

// ── Public API ──

/** Styled select dropdown. Requires a `collection` prop from `createListCollection`. */
export function SelectRoot(props: ComponentProps<typeof ArkSelect.Root>) {
  return <ArkSelect.Root {...props} />;
}

/** Label for the select field. */
export function SelectLabel(props: ComponentProps<typeof ArkSelect.Label>) {
  return <ArkSelect.Label className={styles.label} {...props} />;
}

/** Container for trigger and clear button. */
export function SelectControl(props: ComponentProps<typeof ArkSelect.Control>) {
  return <ArkSelect.Control className={styles.control} {...props} />;
}

/** Button that opens the dropdown. */
export function SelectTrigger(props: ComponentProps<typeof ArkSelect.Trigger>) {
  return <ArkSelect.Trigger className={styles.trigger} {...props} />;
}

/** Displays the selected value text. */
export function SelectValueText(props: ComponentProps<typeof ArkSelect.ValueText>) {
  return <ArkSelect.ValueText className={styles.valueText} {...props} />;
}

/** Positioned dropdown content. Renders in a Portal. */
export function SelectContent(props: ComponentProps<typeof ArkSelect.Content>) {
  return (
    <Portal>
      <ArkSelect.Positioner className={styles.positioner}>
        <ArkSelect.Content className={styles.content} {...props} />
      </ArkSelect.Positioner>
    </Portal>
  );
}

/** Individual select option. */
export function SelectItem(props: ComponentProps<typeof ArkSelect.Item>) {
  return <ArkSelect.Item className={styles.item} {...props} />;
}

/** Text label within a select item. */
export function SelectItemText(props: ComponentProps<typeof ArkSelect.ItemText>) {
  return <ArkSelect.ItemText {...props} />;
}

/** Checkmark indicator for selected items. */
export function SelectItemIndicator(props: ComponentProps<typeof ArkSelect.ItemIndicator>) {
  return <ArkSelect.ItemIndicator className={styles.itemIndicator} {...props} />;
}

/** Group of related select items. */
export function SelectItemGroup(props: ComponentProps<typeof ArkSelect.ItemGroup>) {
  return <ArkSelect.ItemGroup {...props} />;
}

/** Label for an item group. */
export function SelectItemGroupLabel(props: ComponentProps<typeof ArkSelect.ItemGroupLabel>) {
  return <ArkSelect.ItemGroupLabel className={styles.groupLabel} {...props} />;
}

/** Hidden native select for form integration. */
export const SelectHiddenSelect = ArkSelect.HiddenSelect;
