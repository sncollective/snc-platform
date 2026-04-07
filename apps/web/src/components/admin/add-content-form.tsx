import { useState } from "react";
import type React from "react";
import type { PlayoutItem } from "@snc/shared";

import { createPlayoutItem } from "../../lib/playout.js";
import { assignChannelContent } from "../../lib/playout-channels.js";
import { useUpload } from "../../contexts/upload-context.js";
import errorStyles from "../../styles/error-alert.module.css";
import formStyles from "../../styles/form.module.css";
import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface AddContentFormProps {
  readonly channelId: string;
  readonly onAdded: (item: PlayoutItem) => void;
  readonly onUploadComplete?: () => void;
  readonly onCancel: () => void;
}

// ── Component ──

/** Form to create a new playout item, upload media, and auto-assign it to the channel pool. */
export function AddContentForm({
  channelId,
  onAdded,
  onUploadComplete,
  onCancel,
}: AddContentFormProps): React.ReactElement {
  const { actions } = useUpload();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [director, setDirector] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Create item + assign to pool
      const item = await createPlayoutItem({
        title: title.trim() || null,
        year: year ? parseInt(year, 10) : null,
        director: director.trim() || null,
      });
      await assignChannelContent(channelId, [item.id]);

      // Step 2: Start upload if file selected
      if (selectedFile) {
        actions.startUpload({
          file: selectedFile,
          purpose: "playout-media",
          resourceId: item.id,
          onComplete: () => {
            onAdded(item);
            onUploadComplete?.();
          },
          onError: (err) => {
            // Item created but upload failed — still add to pool, show error
            setError(err.message);
            onAdded(item);
          },
        });
      } else {
        // No file — item added to pool without media
        onAdded(item);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create content");
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.addFilmForm} onSubmit={(e) => void handleSubmit(e)}>
      <div className={formStyles.fieldGroup}>
        <label className={formStyles.label} htmlFor="content-title">
          Title
        </label>
        <input
          id="content-title"
          type="text"
          className={formStyles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Leave blank to auto-fill from file tags"
          disabled={isSubmitting}
        />
      </div>

      <div className={formStyles.fieldGroup}>
        <label className={formStyles.label} htmlFor="content-year">
          Year
        </label>
        <input
          id="content-year"
          type="number"
          className={formStyles.input}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          min={1888}
          max={2100}
          disabled={isSubmitting}
        />
      </div>

      <div className={formStyles.fieldGroup}>
        <label className={formStyles.label} htmlFor="content-director">
          Director
        </label>
        <input
          id="content-director"
          type="text"
          className={formStyles.input}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className={formStyles.fieldGroup}>
        <label className={formStyles.label} htmlFor="content-file">
          Source File
        </label>
        <label className={styles.fileLabel}>
          {selectedFile ? selectedFile.name : "Choose file"}
          <input
            id="content-file"
            type="file"
            accept="video/*,audio/*"
            className={styles.fileInput}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            disabled={isSubmitting}
          />
        </label>
      </div>

      {error !== null && (
        <div className={errorStyles.error} role="alert">
          {error}
        </div>
      )}

      <div className={styles.formActions}>
        <button
          type="submit"
          className={formStyles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating…" : "Add Content"}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
