import { useRef } from "react";
import type { ReactNode } from "react";
import {
  DialogRoot,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./dialog.js";
import { Button } from "./button.js";
import styles from "./confirm-dialog.module.css";

// ── Props ──

export interface ConfirmDialogProps {
  /** Controlled open state. */
  readonly open: boolean;
  /** Dialog heading, e.g. "Revoke key?". */
  readonly title: string;
  /** Consequence message — what happens if the user proceeds. */
  readonly children: ReactNode;
  /** Confirm button text — name the consequence ("Revoke key"). Required, no default. */
  readonly confirmLabel: string;
  /** Cancel button text. Default "Cancel". */
  readonly cancelLabel?: string;
  /** "danger" (default): confirm button is destructive-styled. "default": primary. */
  readonly tone?: "danger" | "default";
  /** Disables both buttons while a confirm-in-place action runs. */
  readonly isPending?: boolean;
  /** Called when the user confirms. Async/error handling is consumer-owned. */
  readonly onConfirm: () => void;
  /**
   * Called on cancel, Escape, or backdrop dismiss.
   *
   * Contract: may also fire after `onConfirm` — when the consumer clears open
   * state inside `onConfirm`, `onOpenChange(false)` fires and calls `onCancel`.
   * Consumers must make `onCancel` idempotent / safe to call when already closed.
   */
  readonly onCancel: () => void;
}

// ── Component ──

/**
 * Accessible confirm dialog for destructive or consequential actions.
 *
 * Controlled: `open` + `onConfirm` + `onCancel` are all consumer-owned.
 * Renders as `role="alertdialog"` with initial focus on the cancel button —
 * the safe default for destructive confirms. `onCancel` fires on every close,
 * including after `onConfirm` if the consumer's state clear triggers
 * `onOpenChange(false)`; it must be idempotent.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const confirmVariant = tone === "default" ? "primary" : "danger";

  return (
    <DialogRoot
      open={open}
      role="alertdialog"
      lazyMount
      unmountOnExit
      onOpenChange={(details) => {
        if (!details.open) onCancel();
      }}
      initialFocusEl={() => cancelRef.current}
    >
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{children}</DialogDescription>
        <div className={styles.actions}>
          <Button
            variant={confirmVariant}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={isPending}
            onClick={onCancel}
          >
            {cancelLabel ?? "Cancel"}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
