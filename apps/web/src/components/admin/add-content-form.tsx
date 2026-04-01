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
  readonly onCancel: () => void;
}

// ── Component ──

/** Form to create a new playout item, upload media, and auto-assign it to the channel pool. */
export function AddContentForm({
  channelId,
  onAdded,
  onCancel,
}: AddContentFormProps): React.ReactElement {
  const { actions } = useUpload();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [director, setDirector] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<PlayoutItem | null>(null);

  const handleMetaSubmit = async (
    e: React.FormEvent,
  ): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const item = await createPlayoutItem({
        title: title.trim(),
        year: year ? parseInt(year, 10) : null,
        director: director.trim() || null,
      });
      // Auto-assign newly created item to the channel's content pool
      await assignChannelContent(channelId, [item.id]);
      setPendingItem(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create content");
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = e.target.files?.[0];
    if (!file || !pendingItem) return;

    actions.startUpload({
      file,
      purpose: "playout-media",
      resourceId: pendingItem.id,
      onComplete: () => {
        onAdded(pendingItem);
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  };

  if (pendingItem !== null) {
    return (
      <div className={styles.addFilmForm}>
        <p className={styles.uploadPrompt}>
          <strong>{pendingItem.title}</strong> created and added to the pool.
          Select the source video file to upload:
        </p>
        {error !== null && (
          <div className={errorStyles.error} role="alert">
            {error}
          </div>
        )}
        <div className={styles.uploadActions}>
          <label className={styles.fileLabel}>
            Choose file
            <input
              type="file"
              accept="video/*,audio/*"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
          </label>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => {
              onAdded(pendingItem);
            }}
          >
            Skip upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.addFilmForm}
      onSubmit={(e) => void handleMetaSubmit(e)}
    >
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
          required
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

      {error !== null && (
        <div className={errorStyles.error} role="alert">
          {error}
        </div>
      )}

      <div className={styles.formActions}>
        <button
          type="submit"
          className={formStyles.submitButton}
          disabled={isSubmitting || !title.trim()}
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
