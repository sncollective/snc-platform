import { useCallback, useEffect, useState } from "react";

import type React from "react";

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

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleClose, menuRef]);

  return { isOpen, handleToggle, handleClose };
}
