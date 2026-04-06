import type { ComponentProps, ReactNode } from "react";
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

// ── FormField ──

export interface FormFieldProps {
  /** Visible label text rendered above the input. */
  label: string;
  /**
   * The base id for the field. Ark UI Field uses this to wire the label's
   * htmlFor and the input's id automatically. The child input will receive
   * this value as its `id` via context — do not set `id` on the child directly.
   */
  htmlFor: string;
  /** Optional hint shown below the input. */
  hint?: string;
  /** Error message. When truthy, marks the field invalid and shows the text. */
  error?: string;
  /** Marks the field as required (visual indicator + aria-required on input). */
  required?: boolean;
  /** Disables all child controls via Ark UI context. */
  disabled?: boolean;
  /** The input element — typically FieldInput, FieldTextarea, or FieldSelect. */
  children: ReactNode;
}

/**
 * Prop-based form field wrapper. Composes Ark UI Field parts with automatic
 * aria-describedby / aria-invalid / aria-required wiring.
 *
 * Pass `FieldInput`, `FieldTextarea`, or `FieldSelect` as children — they pick
 * up disabled / invalid / required state via Ark UI's React context automatically.
 *
 * @example
 * ```tsx
 * <FormField label="Email" htmlFor="email" hint="We never share this." error={errors.email} required>
 *   <FieldInput id="email" type="email" value={value} onChange={handleChange} />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  disabled,
  children,
}: FormFieldProps) {
  return (
    <FieldRoot
      id={htmlFor}
      invalid={!!error}
      required={required}
      disabled={disabled}
    >
      <FieldLabel>
        {label}
        {required && <FieldRequiredIndicator>*</FieldRequiredIndicator>}
      </FieldLabel>
      {children}
      {hint ? <FieldHelperText>{hint}</FieldHelperText> : null}
      {error ? <FieldErrorText>{error}</FieldErrorText> : null}
    </FieldRoot>
  );
}
