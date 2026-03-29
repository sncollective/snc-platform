import { useCallback, useState } from "react";

import type React from "react";

import { useDismiss } from "./use-dismiss.js";

// ── Public Types ──

export interface UseMenuToggleReturn {
  readonly isOpen: boolean;
  readonly handleToggle: () => void;
  readonly handleClose: () => void;
}

// ── Public API ──

/** Manage menu open/close state with Escape key and click-outside dismissal. */
export function useMenuToggle(
  menuRef: React.RefObject<HTMLElement | null>,
): UseMenuToggleReturn {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useDismiss(menuRef, handleClose, isOpen);

  return { isOpen, handleToggle, handleClose };
}
