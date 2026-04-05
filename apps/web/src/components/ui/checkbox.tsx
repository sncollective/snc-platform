import type { ComponentProps, ReactNode } from "react";
import { Checkbox as ArkCheckbox } from "@ark-ui/react/checkbox";
import { Check } from "lucide-react";

import styles from "./checkbox.module.css";

// ── Public Types ──

export interface CheckboxProps extends ComponentProps<typeof ArkCheckbox.Root> {
  readonly children?: ReactNode;
}

// ── Public API ──

/** Accessible checkbox with custom styling. */
export function Checkbox({ children, ...props }: CheckboxProps) {
  return (
    <ArkCheckbox.Root className={styles.root} {...props}>
      <ArkCheckbox.Control className={styles.control}>
        <ArkCheckbox.Indicator className={styles.indicator}>
          <Check size={12} aria-hidden="true" />
        </ArkCheckbox.Indicator>
      </ArkCheckbox.Control>
      {children && <ArkCheckbox.Label className={styles.label}>{children}</ArkCheckbox.Label>}
      <ArkCheckbox.HiddenInput />
    </ArkCheckbox.Root>
  );
}

