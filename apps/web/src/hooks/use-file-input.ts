import { useRef, useCallback } from "react";
import type React from "react";

// ── Public Types ──

export interface UseFileInputResult {
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly triggerSelect: () => void;
  readonly handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ── Public API ──

export function useFileInput(onFile?: (file: File) => void): UseFileInputResult {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const triggerSelect = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onFile?.(file);
      e.target.value = "";
    },
    [onFile],
  );

  return { inputRef, triggerSelect, handleChange };
}
