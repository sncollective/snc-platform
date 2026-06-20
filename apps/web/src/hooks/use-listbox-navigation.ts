import { useCallback, useEffect, useState } from "react";
import type React from "react";

// ── Public Types ──

export interface UseListboxNavigationOptions<T> {
  /** The currently-rendered (filtered) item list. */
  readonly items: readonly T[];
  /** Stable id for an item — used for option element ids and aria-activedescendant. */
  readonly getItemId: (item: T, index: number) => string;
  /** Invoked when an item is chosen via Enter or click. */
  readonly onSelect: (item: T) => void;
  /** Base id used to derive the listbox id and per-option ids. */
  readonly listboxId: string;
}

export interface UseListboxNavigationResult<T> {
  /** Index of the active (virtually-focused) option, or -1 when none. */
  readonly activeIndex: number;
  /** Spread onto the combobox `<input>` — wires aria-activedescendant + key handling. */
  readonly getInputProps: () => {
    readonly role: "combobox";
    readonly "aria-controls": string;
    readonly "aria-expanded": true;
    readonly "aria-activedescendant": string | undefined;
    readonly onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  /** Spread onto the listbox container `<ul>`. */
  readonly getListboxProps: () => {
    readonly role: "listbox";
    readonly id: string;
  };
  /** Spread onto each option `<li>`. */
  readonly getOptionProps: (item: T, index: number) => {
    readonly role: "option";
    readonly id: string;
    readonly "aria-selected": boolean;
    readonly onClick: () => void;
    readonly onMouseEnter: () => void;
  };
}

// ── Public API ──

/**
 * Keyboard + ARIA management for an editable combobox driving a listbox of results.
 *
 * Implements the WAI-ARIA combobox-with-listbox pattern: arrow keys move a virtual
 * focus (aria-activedescendant) across options while DOM focus stays on the input,
 * Enter selects the active option, Home/End jump to the ends. Pointer hover also
 * sets the active option so mouse and keyboard stay in sync.
 *
 * The active index resets to -1 whenever the item list changes (e.g. on re-filter),
 * so a stale highlight never points past the end of a shorter result set.
 *
 * @param options - items, id accessors, the select callback, and the base listbox id
 * @returns the active index plus prop-getters for the input, listbox, and each option
 */
export function useListboxNavigation<T>({
  items,
  getItemId,
  onSelect,
  listboxId,
}: UseListboxNavigationOptions<T>): UseListboxNavigationResult<T> {
  const [activeIndex, setActiveIndex] = useState(-1);

  // Re-filtering changes the result set; clamp a highlight that now dangles past
  // the end. Keyed on length, not array identity — callers commonly recompute the
  // filtered array on every render, which would otherwise reset the highlight on
  // each keystroke and break aria-activedescendant.
  useEffect(() => {
    setActiveIndex((i) => (i >= items.length ? items.length - 1 : i));
  }, [items.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (items.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % items.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
          break;
        case "Home":
          e.preventDefault();
          setActiveIndex(0);
          break;
        case "End":
          e.preventDefault();
          setActiveIndex(items.length - 1);
          break;
        case "Enter": {
          const item = activeIndex >= 0 ? items[activeIndex] : undefined;
          if (item !== undefined) {
            e.preventDefault();
            onSelect(item);
          }
          break;
        }
        default:
          break;
      }
    },
    [items, activeIndex, onSelect],
  );

  const activeId =
    activeIndex >= 0 && activeIndex < items.length
      ? getItemId(items[activeIndex] as T, activeIndex)
      : undefined;

  return {
    activeIndex,
    getInputProps: () => ({
      role: "combobox",
      "aria-controls": listboxId,
      "aria-expanded": true,
      "aria-activedescendant": activeId,
      onKeyDown: handleKeyDown,
    }),
    getListboxProps: () => ({
      role: "listbox",
      id: listboxId,
    }),
    getOptionProps: (_item: T, index: number) => ({
      role: "option",
      id: getItemId(items[index] as T, index),
      "aria-selected": index === activeIndex,
      onClick: () => onSelect(items[index] as T),
      onMouseEnter: () => setActiveIndex(index),
    }),
  };
}
