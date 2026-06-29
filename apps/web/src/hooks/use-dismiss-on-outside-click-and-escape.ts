import { useEffect } from "react";

// ── Public Types ──

export interface DismissibleContainerRef<TElement extends HTMLElement> {
  readonly current: TElement | null;
}

// ── Public API ──

/** Dismiss floating UI when focus leaves via outside pointer click or Escape. */
export function useDismissOnOutsideClickAndEscape<TElement extends HTMLElement>(
  containerRef: DismissibleContainerRef<TElement>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      const target = e.target;
      if (
        target instanceof Node &&
        containerRef.current !== null &&
        !containerRef.current.contains(target)
      ) {
        onDismiss();
      }
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, onDismiss]);
}
