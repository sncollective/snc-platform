import type { ComponentProps, ReactNode } from "react";
import { Switch as ArkSwitch } from "@ark-ui/react/switch";
import styles from "./switch.module.css";

// ── Public Types ──

export interface SwitchProps extends ComponentProps<typeof ArkSwitch.Root> {
  readonly children?: ReactNode;
}

// ── Public API ──

/** Accessible toggle switch for on/off states. */
export function Switch({ children, ...props }: SwitchProps) {
  return (
    <ArkSwitch.Root className={styles.root} {...props}>
      <ArkSwitch.Control className={styles.control}>
        <ArkSwitch.Thumb className={styles.thumb} />
      </ArkSwitch.Control>
      {children && <ArkSwitch.Label className={styles.label}>{children}</ArkSwitch.Label>}
      <ArkSwitch.HiddenInput />
    </ArkSwitch.Root>
  );
}
