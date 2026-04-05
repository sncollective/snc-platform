import type { ComponentProps, ReactNode } from "react";
import { Tooltip as ArkTooltip } from "@ark-ui/react/tooltip";
import { Portal } from "@ark-ui/react/portal";
import styles from "./tooltip.module.css";

// ── Public Types ──

export interface TooltipProps {
  readonly children: ReactNode;
  readonly content: ReactNode;
  readonly positioning?: ComponentProps<typeof ArkTooltip.Root>["positioning"];
  readonly openDelay?: number;
  readonly closeDelay?: number;
}

// ── Public API ──

/** Accessible tooltip shown on hover/focus. Wraps a single trigger element. */
export function Tooltip({
  children,
  content,
  positioning,
  openDelay = 400,
  closeDelay = 150,
}: TooltipProps) {
  return (
    <ArkTooltip.Root openDelay={openDelay} closeDelay={closeDelay} positioning={positioning}>
      <ArkTooltip.Trigger asChild>{children}</ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner className={styles.positioner}>
          <ArkTooltip.Content className={styles.content}>{content}</ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  );
}
