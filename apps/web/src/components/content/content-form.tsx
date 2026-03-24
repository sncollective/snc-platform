import type React from "react";
import type { RefObject } from "react";
import { CONTENT_TYPES, VISIBILITY, ACCEPTED_MIME_TYPES, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from "@snc/shared";
import type { ContentType, Visibility } from "@snc/shared";

import { useContentFormFields } from "../../hooks/use-content-form-fields.js";
import { useContentSubmit } from "../../hooks/use-content-submit.js";
import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";
import successStyles from "../../styles/success-alert.module.css";
import styles from "./content-form.module.css";

// ── Private Constants ──

const AUDIO_ACCEPT = ACCEPTED_MIME_TYPES.audio.join(",");
const VIDEO_ACCEPT = ACCEPTED_MIME_TYPES.video.join(",");
const IMAGE_ACCEPT = ACCEPTED_MIME_TYPES.image.join(",");

// ── Private Components ──

function FileInputField({
  label,
  inputId,
  accept,
  inputRef,
  fileName,
  onFileChange,
  onClear,
  disabled,
}: {
  readonly label: string;
  readonly inputId: string;
  readonly accept: string;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly fileName: string;
  readonly onFileChange: (name: string) => void;
  readonly onClear: () => void;
  readonly disabled: boolean;
}): React.ReactElement {
  return (
    <div className={formStyles.fieldGroup}>
      <label htmlFor={inputId} className={formStyles.label}>
        {label}
      </label>
      <div className={styles.fileInputRow}>
        <input
          id={inputId}
          type="file"
          ref={inputRef}
          accept={accept}
          className={styles.fileInput}
          disabled={disabled}
          onChange={(e) => onFileChange(e.target.files?.[0]?.name ?? "")}
        />
        {fileName && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Public Types ──

export interface ContentFormProps {
  readonly creatorId: string;
  readonly onSuccess: () => void;
  readonly onCancel?: () => void;
  readonly onUploadComplete?: () => void; // called after background uploads finish
}

// ── Public API ──

export function ContentForm({ creatorId, onSuccess, onCancel, onUploadComplete }: ContentFormProps): React.ReactElement {
  const fields = useContentFormFields();
  const submitCallbacks = onUploadComplete
    ? { onSuccess, onUploadComplete }
    : { onSuccess };
  const submit = useContentSubmit(fields, creatorId, submitCallbacks);

  return (
    <form onSubmit={submit.handleSubmit} noValidate className={styles.form}>
      {submit.serverError && (
        <div className={formStyles.serverError} role="alert">
          {submit.serverError}
        </div>
      )}

      {submit.successMessage && (
        <div className={successStyles.success} role="status">
          {submit.successMessage}
        </div>
      )}

      {/* Content Type */}
      <div className={formStyles.fieldGroup}>
        <label htmlFor="content-type" className={formStyles.label}>
          Type
        </label>
        <select
          id="content-type"
          value={fields.type}
          onChange={(e) => {
            const v = e.target.value;
            if ((CONTENT_TYPES as readonly string[]).includes(v)) {
              fields.setType(v as ContentType);
            }
          }}
          className={formStyles.select}
          disabled={submit.isSubmitting}
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div className={formStyles.fieldGroup}>
        <label htmlFor="content-title" className={formStyles.label}>
          Title
        </label>
        <input
          id="content-title"
          type="text"
          value={fields.title}
          onChange={(e) => {
            fields.setTitle(e.target.value);
            if (submit.fieldErrors.title) submit.setFieldErrors({ ...submit.fieldErrors, title: undefined });
          }}
          className={clsx(formStyles.input, submit.fieldErrors.title && formStyles.inputError)}
          disabled={submit.isSubmitting}
          maxLength={MAX_TITLE_LENGTH}
        />
        {submit.fieldErrors.title && (
          <span className={formStyles.fieldError} role="alert">
            {submit.fieldErrors.title}
          </span>
        )}
      </div>

      {/* Description */}
      <div className={formStyles.fieldGroup}>
        <label htmlFor="content-description" className={formStyles.label}>
          Description
        </label>
        <textarea
          id="content-description"
          value={fields.description}
          onChange={(e) => {
            fields.setDescription(e.target.value);
            if (submit.fieldErrors.description) submit.setFieldErrors({ ...submit.fieldErrors, description: undefined });
          }}
          className={clsx(formStyles.textarea, styles.textarea)}
          disabled={submit.isSubmitting}
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
        />
        {submit.fieldErrors.description && (
          <span className={formStyles.fieldError} role="alert">
            {submit.fieldErrors.description}
          </span>
        )}
      </div>

      {/* Visibility */}
      <div className={formStyles.fieldGroup}>
        <label htmlFor="content-visibility" className={formStyles.label}>
          Visibility
        </label>
        <select
          id="content-visibility"
          value={fields.visibility}
          onChange={(e) => {
            const v = e.target.value;
            if ((VISIBILITY as readonly string[]).includes(v)) {
              fields.setVisibility(v as Visibility);
            }
          }}
          className={formStyles.select}
          disabled={submit.isSubmitting}
        >
          {VISIBILITY.map((v) => (
            <option key={v} value={v}>
              {v === "public" ? "Public" : "Subscribers Only"}
            </option>
          ))}
        </select>
      </div>

      {/* Body (written only) */}
      {fields.type === "written" && (
        <div className={formStyles.fieldGroup}>
          <label htmlFor="content-body" className={formStyles.label}>
            Body
          </label>
          <textarea
            id="content-body"
            value={fields.body}
            onChange={(e) => {
              fields.setBody(e.target.value);
              if (submit.fieldErrors.body) submit.setFieldErrors({ ...submit.fieldErrors, body: undefined });
            }}
            className={clsx(formStyles.textarea, styles.textarea, submit.fieldErrors.body && formStyles.inputError)}
            disabled={submit.isSubmitting}
            rows={8}
          />
          {submit.fieldErrors.body && (
            <span className={formStyles.fieldError} role="alert">
              {submit.fieldErrors.body}
            </span>
          )}
        </div>
      )}

      {/* Media file (audio/video only) */}
      {fields.type !== "written" && (
        <FileInputField
          label="Media File"
          inputId="content-media"
          accept={fields.type === "audio" ? AUDIO_ACCEPT : VIDEO_ACCEPT}
          inputRef={fields.mediaRef}
          fileName={fields.mediaFileName}
          onFileChange={fields.setMediaFileName}
          onClear={fields.clearMedia}
          disabled={submit.isSubmitting}
        />
      )}

      {/* Cover art (audio only) */}
      {fields.type === "audio" && (
        <FileInputField
          label="Cover Art (optional)"
          inputId="content-cover-art"
          accept={IMAGE_ACCEPT}
          inputRef={fields.coverArtRef}
          fileName={fields.coverArtFileName}
          onFileChange={fields.setCoverArtFileName}
          onClear={fields.clearCoverArt}
          disabled={submit.isSubmitting}
        />
      )}

      {/* Thumbnail (video and written) */}
      {(fields.type === "video" || fields.type === "written") && (
        <FileInputField
          label="Thumbnail (optional)"
          inputId="content-thumbnail"
          accept={IMAGE_ACCEPT}
          inputRef={fields.thumbnailRef}
          fileName={fields.thumbnailFileName}
          onFileChange={fields.setThumbnailFileName}
          onClear={fields.clearThumbnail}
          disabled={submit.isSubmitting}
        />
      )}

      {/* Submit / Cancel */}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={clsx(formStyles.submitButton, styles.submitButton)}
          disabled={submit.isSubmitting}
        >
          {submit.isSubmitting ? submit.submitStatus || "Creating..." : "Create Content"}
        </button>
        {onCancel && (
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={submit.isSubmitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
