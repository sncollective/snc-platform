import type React from "react";
import { useState, useRef, useEffect } from "react";

import styles from "./content-management-list.module.css";

// ── Public Types ──

export interface KebabMenuProps {
  readonly itemId: string;
  readonly deletingId: string | null;
  readonly onDelete: (id: string) => void;
}

// ── Public API ──

/** Overflow action menu for a content row with a confirm-before-delete action. */
export function KebabMenu({ itemId, deletingId, onDelete }: KebabMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={styles.kebabWrapper} ref={ref}>
      <button
        type="button"
        className={styles.kebabButton}
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
      >
        ⋯
      </button>
      {open && (
        <div className={styles.kebabMenu}>
          <button
            type="button"
            className={styles.deleteAction}
            onClick={() => {
              setOpen(false);
              if (window.confirm("Delete this content? This cannot be undone.")) {
                onDelete(itemId);
              }
            }}
            disabled={deletingId === itemId}
          >
            {deletingId === itemId ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}
