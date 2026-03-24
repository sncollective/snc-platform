import type React from "react";
import { useCallback, useRef } from "react";
import type { MerchVariant } from "@snc/shared";

import { clsx } from "clsx/lite";

import styles from "./variant-selector.module.css";

// ── Public Types ──

export interface VariantSelectorProps {
  readonly variants: readonly MerchVariant[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

// ── Helpers ──

function findNextAvailable(
  variants: readonly MerchVariant[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  const len = variants.length;
  for (let i = 1; i <= len; i++) {
    const idx = (currentIndex + i * direction + len) % len;
    const variant = variants[idx];
    if (variant?.available) return idx;
  }
  return currentIndex;
}

// ── Public API ──

export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = variants.findIndex((v) => v.id === selectedId);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = findNextAvailable(variants, currentIndex, 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = findNextAvailable(variants, currentIndex, -1);
      }

      if (nextIndex !== null && nextIndex !== currentIndex) {
        const nextVariant = variants[nextIndex];
        if (!nextVariant) return;
        onSelect(nextVariant.id);
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("button");
        buttons?.[nextIndex]?.focus();
      }
    },
    [variants, selectedId, onSelect],
  );

  return (
    <div
      className={styles.container}
      role="radiogroup"
      aria-label="Product variants"
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {variants.map((variant) => {
        const isSelected = variant.id === selectedId;
        const isDisabled = !variant.available;

        return (
          <button
            key={variant.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            tabIndex={isSelected ? 0 : -1}
            className={clsx(styles.chip, isSelected && styles.chipSelected, isDisabled && styles.chipDisabled)}
            onClick={() => onSelect(variant.id)}
          >
            {variant.title}
          </button>
        );
      })}
    </div>
  );
}
