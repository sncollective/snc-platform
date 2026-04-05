import type { ComponentProps } from "react";
import { Field as ArkField } from "@ark-ui/react/field";
import styles from "./field.module.css";

// ── Public API ──

/** Form field wrapper. Propagates disabled/invalid/required to children. */
export function FieldRoot(props: ComponentProps<typeof ArkField.Root>) {
  return <ArkField.Root className={styles.root} {...props} />;
}

/** Field label. Auto-wires htmlFor to the input. */
export function FieldLabel(props: ComponentProps<typeof ArkField.Label>) {
  return <ArkField.Label className={styles.label} {...props} />;
}

/** Text input. Inherits disabled/invalid/required from FieldRoot. */
export function FieldInput(props: ComponentProps<typeof ArkField.Input>) {
  return <ArkField.Input className={styles.input} {...props} />;
}

/** Textarea input. Inherits disabled/invalid/required from FieldRoot. */
export function FieldTextarea(props: ComponentProps<typeof ArkField.Textarea>) {
  return <ArkField.Textarea className={styles.textarea} {...props} />;
}

/** Native select. Inherits disabled/invalid/required from FieldRoot. */
export function FieldSelect(props: ComponentProps<typeof ArkField.Select>) {
  return <ArkField.Select className={styles.select} {...props} />;
}

/** Helper text shown below input. */
export function FieldHelperText(props: ComponentProps<typeof ArkField.HelperText>) {
  return <ArkField.HelperText className={styles.helperText} {...props} />;
}

/** Error text shown below input when field is invalid. */
export function FieldErrorText(props: ComponentProps<typeof ArkField.ErrorText>) {
  return <ArkField.ErrorText className={styles.errorText} {...props} />;
}

/** Visual required indicator (e.g., asterisk). */
export function FieldRequiredIndicator(props: ComponentProps<typeof ArkField.RequiredIndicator>) {
  return <ArkField.RequiredIndicator className={styles.required} {...props} />;
}
