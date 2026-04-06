import type React from "react";

import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "../ui/menu.js";
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
  const isDeleting = deletingId === itemId;

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          type="button"
          className={styles.kebabButton}
          aria-label="More actions"
        >
          ⋯
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          value="delete"
          className={styles.deleteAction}
          disabled={isDeleting}
          onSelect={() => {
            if (window.confirm("Delete this content? This cannot be undone.")) {
              onDelete(itemId);
            }
          }}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
