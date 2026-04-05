import { Toast as ArkToast, Toaster, createToaster } from "@ark-ui/react/toast";
import { X } from "lucide-react";

import styles from "./toast.module.css";

// ── Module-level singleton ──

/** Toast engine. Import and call `toaster.success(...)` from anywhere. */
export const toaster = createToaster({
  placement: "bottom-end",
  duration: 5000,
  removeDelay: 200,
  max: 5,
  offsets: "1rem",
});

// ── Public API ──

/** Mount once in the root layout. Renders all active toasts. */
export function ToastProvider() {
  return (
    <Toaster toaster={toaster}>
      {(toast) => (
        <ArkToast.Root className={styles.root}>
          <ArkToast.Title className={styles.title}>{toast.title}</ArkToast.Title>
          <ArkToast.Description className={styles.description}>
            {toast.description}
          </ArkToast.Description>
          <ArkToast.CloseTrigger className={styles.close}>
            <X size={16} aria-hidden="true" />
          </ArkToast.CloseTrigger>
        </ArkToast.Root>
      )}
    </Toaster>
  );
}
