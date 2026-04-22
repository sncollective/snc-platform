import type { ProcessingStatus, FeedItem } from "@snc/shared";
import type { ActiveUpload } from "../contexts/upload-context.js";
import { useUpload } from "../contexts/upload-context.js";

// ── Public Types ──

export type ContentDisplayState =
  | { readonly phase: "no-media" }
  | { readonly phase: "uploading"; readonly upload: ActiveUpload }
  | { readonly phase: "processing"; readonly status: ProcessingStatus }
  | { readonly phase: "ready" }
  | { readonly phase: "failed" };

export interface ContentDisplayStateInputs {
  readonly mediaUrl: string | null;
  readonly processingStatus: ProcessingStatus | null;
  readonly activeUpload: ActiveUpload | undefined;
}

// ── Public API ──

/**
 * Derive a single display phase from media URL, processing status, and active upload state.
 *
 * Priority ladder:
 * 1. Active upload with status "uploading" or "completing" → uploading phase
 * 2. processingStatus "failed" → failed phase
 * 3. processingStatus "uploaded" or "processing" → processing phase
 * 4. mediaUrl present → ready phase
 * 5. Otherwise → no-media phase
 *
 * An upload with status "complete" or "error" falls through to the processingStatus check.
 */
export function deriveContentDisplayState(
  inputs: ContentDisplayStateInputs,
): ContentDisplayState {
  const { mediaUrl, processingStatus, activeUpload } = inputs;

  if (activeUpload && (activeUpload.status === "uploading" || activeUpload.status === "completing")) {
    return { phase: "uploading", upload: activeUpload };
  }

  if (processingStatus === "failed") {
    return { phase: "failed" };
  }

  if (processingStatus === "uploaded" || processingStatus === "processing") {
    return { phase: "processing", status: processingStatus };
  }

  if (mediaUrl !== null) {
    return { phase: "ready" };
  }

  return { phase: "no-media" };
}

/**
 * Compute display state for a content item, integrating upload context.
 * SSR-safe: tolerates missing upload context (returns state derived from item alone).
 */
export function useContentDisplayState(item: FeedItem): ContentDisplayState {
  const { state } = useUpload();
  const activeUpload = state.activeUploads.find(
    (u) => u.resourceId === item.id && (u.status === "uploading" || u.status === "completing"),
  );

  return deriveContentDisplayState({
    mediaUrl: item.mediaUrl,
    processingStatus: item.processingStatus,
    activeUpload,
  });
}
