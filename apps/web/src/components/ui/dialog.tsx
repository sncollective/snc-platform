import type { ComponentProps, ReactNode } from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import styles from "./dialog.module.css";

// ── Public Types ──

export interface DialogProps extends ComponentProps<typeof ArkDialog.Root> {}

export interface DialogContentProps {
  readonly children: ReactNode;
  readonly className?: string;
}

// ── Public API ──

/** Accessible modal dialog with focus trap, scroll lock, and backdrop dismiss. */
export function DialogRoot(props: DialogProps) {
  return <ArkDialog.Root {...props} />;
}

/** Semi-transparent overlay behind the dialog. */
export function DialogBackdrop() {
  return (
    <Portal>
      <ArkDialog.Backdrop className={styles.backdrop} />
    </Portal>
  );
}

/** Positioned dialog content panel. Renders in a Portal. */
export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <Portal>
      <ArkDialog.Positioner className={styles.positioner}>
        <ArkDialog.Content className={className ? `${styles.content} ${className}` : styles.content}>
          {children}
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  );
}

/** Dialog heading. Renders as h2. */
export function DialogTitle(props: ComponentProps<typeof ArkDialog.Title>) {
  return <ArkDialog.Title className={styles.title} {...props} />;
}

/** Dialog description text. */
export function DialogDescription(props: ComponentProps<typeof ArkDialog.Description>) {
  return <ArkDialog.Description className={styles.description} {...props} />;
}

/** Button that closes the dialog. */
export function DialogCloseTrigger(props: ComponentProps<typeof ArkDialog.CloseTrigger>) {
  return <ArkDialog.CloseTrigger className={styles.close} {...props} />;
}

/** Button that opens the dialog. Passes through without styling. */
export const DialogTrigger = ArkDialog.Trigger;
