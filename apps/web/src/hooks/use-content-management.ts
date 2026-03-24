import { useState, useCallback } from "react";
import type { FeedItem, Visibility } from "@snc/shared";
import { useNavigate } from "@tanstack/react-router";

import { deleteContent, updateContent, publishContent, unpublishContent } from "../lib/content.js";
import { useUpload } from "../contexts/upload-context.js";

// ── Public Types ──

export interface ContentEditCallbacks {
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
  readonly onBodyChange?: (value: string) => void;
  readonly onMediaUpload: (file: File) => void;
  readonly onThumbnailUpload: (file: File) => void;
  readonly onThumbnailRemove: () => Promise<void>;
  readonly onMediaRemove: () => Promise<void>;
}

export interface ContentManagement {
  // Edit mode
  readonly isEditing: boolean;
  readonly editingItem: FeedItem;
  readonly editCallbacks: ContentEditCallbacks | undefined;
  readonly startEditing: () => void;
  readonly cancelEditing: () => void;

  // Async operations
  readonly isSaving: boolean;
  readonly isPublishing: boolean;
  readonly isDeleting: boolean;
  readonly error: string | null;

  // Actions
  readonly save: () => Promise<void>;
  readonly publish: () => Promise<void>;
  readonly unpublish: () => Promise<void>;
  readonly remove: () => Promise<void>;
}

// ── Public API ──

/** Manage inline editing, publishing, unpublishing, and deletion of a single content item. */
export function useContentManagement(item: FeedItem, initialEdit?: boolean): ContentManagement {
  const navigate = useNavigate();
  const { actions: uploadActions } = useUpload();

  const [isEditing, setIsEditing] = useState(initialEdit ?? false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description ?? "");
  const [editVisibility, setEditVisibility] = useState<Visibility>(item.visibility);
  const [editBody, setEditBody] = useState(item.body ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingItem: FeedItem = isEditing
    ? { ...item, title: editTitle, description: editDescription, visibility: editVisibility, body: editBody }
    : item;

  const editCallbacks: ContentEditCallbacks | undefined = isEditing
    ? {
        onTitleChange: setEditTitle,
        onDescriptionChange: setEditDescription,
        onVisibilityChange: setEditVisibility,
        ...(item.type === "written" ? { onBodyChange: setEditBody } : {}),
        onMediaUpload: (file: File) => {
          uploadActions.startUpload({
            file,
            purpose: "content-media",
            resourceId: item.id,
            onComplete: () => window.location.reload(),
            onError: (err) => setError(err.message),
          });
        },
        onThumbnailUpload: (file: File) => {
          uploadActions.startUpload({
            file,
            purpose: "content-thumbnail",
            resourceId: item.id,
            onComplete: () => window.location.reload(),
            onError: (err) => setError(err.message),
          });
        },
        onThumbnailRemove: async () => {
          try {
            await updateContent(item.id, { clearThumbnail: true });
            window.location.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove thumbnail");
          }
        },
        onMediaRemove: async () => {
          if (!window.confirm("Remove media file? This cannot be undone.")) return;
          try {
            await updateContent(item.id, { clearMedia: true });
            window.location.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove media");
          }
        },
      }
    : undefined;

  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditVisibility(item.visibility);
    setEditBody(item.body ?? "");
    setError(null);
  }, [item.title, item.description, item.visibility, item.body]);

  const save = useCallback(async () => {
    setError(null);
    setIsSaving(true);
    try {
      await updateContent(item.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        visibility: editVisibility,
        body: item.type === "written" ? editBody : undefined,
      });
      setIsEditing(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [item.id, item.type, editTitle, editDescription, editVisibility, editBody]);

  const publish = useCallback(async () => {
    setIsPublishing(true);
    try {
      await publishContent(item.id);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setIsPublishing(false);
    }
  }, [item.id]);

  const unpublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      await unpublishContent(item.id);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unpublish failed");
    } finally {
      setIsPublishing(false);
    }
  }, [item.id]);

  const remove = useCallback(async () => {
    if (!window.confirm("Are you sure you want to permanently delete this content?")) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteContent(item.id);
      void navigate({ to: "/feed" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }, [item.id, navigate]);

  return {
    isEditing,
    editingItem,
    editCallbacks,
    startEditing,
    cancelEditing,
    isSaving,
    isPublishing,
    isDeleting,
    error,
    save,
    publish,
    unpublish,
    remove,
  };
}
