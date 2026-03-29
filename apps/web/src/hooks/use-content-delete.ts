import { useState } from "react";

import { deleteContent } from "../lib/content.js";

// ── Public Types ──

export interface UseContentDeleteOptions {
  readonly onDeleted?: () => void;
  readonly onError?: (message: string) => void;
}

// ── Public API ──

/** Shared delete handler for content items. Manages deleting state, calls onDeleted on success, and optionally surfaces errors via onError. */
export function useContentDelete({ onDeleted, onError }: UseContentDeleteOptions): {
  readonly deletingId: string | null;
  readonly handleDelete: (id: string) => Promise<void>;
} {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("Are you sure you want to permanently delete this content?")) return;
    setDeletingId(id);
    try {
      await deleteContent(id);
      onDeleted?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return { deletingId, handleDelete };
}
