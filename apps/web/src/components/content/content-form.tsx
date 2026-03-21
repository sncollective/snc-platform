import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type React from "react";
import { z, safeParse } from "zod/mini";

import {
  CONTENT_TYPES,
  VISIBILITY,
  ACCEPTED_MIME_TYPES,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "@snc/shared";
import type { ContentType, UploadPurpose, Visibility } from "@snc/shared";

import { extractFieldErrors } from "../../lib/form-utils.js";
import { createContent } from "../../lib/content.js";
import { useUpload } from "../../contexts/upload-context.js";
import formStyles from "../../styles/form.module.css";
import successStyles from "../../styles/success-alert.module.css";
import styles from "./content-form.module.css";

// ── Private Constants ──

const FORM_FIELDS = ["title", "description", "type", "visibility", "body"] as const;

const FormSchema = z.object({
  title: z.string().check(z.minLength(1, "Title is required"), z.maxLength(MAX_TITLE_LENGTH)),
  type: z.enum(CONTENT_TYPES),
  description: z.optional(z.string().check(z.maxLength(MAX_DESCRIPTION_LENGTH))),
  visibility: z.enum(VISIBILITY),
  body: z.optional(z.string()),
});

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
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
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
  const { actions: uploadActions } = useUpload();
  const onUploadCompleteRef = useRef(onUploadComplete);
  onUploadCompleteRef.current = onUploadComplete;

  const [type, setType] = useState<ContentType>("audio");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [body, setBody] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);

  const mediaRef = useRef<HTMLInputElement>(null);
  const coverArtRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);

  const [mediaFileName, setMediaFileName] = useState("");
  const [coverArtFileName, setCoverArtFileName] = useState("");
  const [thumbnailFileName, setThumbnailFileName] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setBody("");
    setVisibility("public");
    setFieldErrors({});
    if (mediaRef.current) mediaRef.current.value = "";
    if (coverArtRef.current) coverArtRef.current.value = "";
    if (thumbnailRef.current) thumbnailRef.current.value = "";
    setMediaFileName("");
    setCoverArtFileName("");
    setThumbnailFileName("");
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setServerError("");
    setSuccessMessage("");
    setFieldErrors({});

    const formData = {
      creatorId,
      title: title.trim(),
      type,
      description: description.trim() || undefined,
      visibility,
      body: type === "written" ? body : undefined,
      publishImmediately: type === "written" && !saveAsDraft ? true : undefined,
    };

    const result = safeParse(FormSchema, formData);
    if (!result.success) {
      setFieldErrors(extractFieldErrors(result.error.issues, FORM_FIELDS));
      return;
    }

    if (type === "written" && !body.trim()) {
      setFieldErrors({ body: "Body is required for written content" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create content record
      setSubmitStatus("Creating...");
      const created = await createContent(formData);

      // Step 2: Fire-and-forget uploads via global context
      const filesToUpload: Array<{ file: File; purpose: UploadPurpose }> = [];

      const mediaFile = mediaRef.current?.files?.[0];
      if (mediaFile) {
        filesToUpload.push({ file: mediaFile, purpose: "content-media" });
      }

      const coverArtFile = coverArtRef.current?.files?.[0];
      if (coverArtFile) {
        filesToUpload.push({ file: coverArtFile, purpose: "content-cover-art" });
      }

      const thumbnailFile = thumbnailRef.current?.files?.[0];
      if (thumbnailFile) {
        filesToUpload.push({ file: thumbnailFile, purpose: "content-thumbnail" });
      }

      if (filesToUpload.length > 0) {
        let completedCount = 0;
        const totalCount = filesToUpload.length;
        for (const { file, purpose } of filesToUpload) {
          uploadActions.startUpload({
            file,
            purpose,
            resourceId: created.id,
            onComplete: () => {
              completedCount++;
              if (completedCount === totalCount) {
                // Safe: reads ref, not form state — survives unmount
                onUploadCompleteRef.current?.();
              }
            },
          });
        }
      }

      // Form resets immediately — uploads continue in background
      setSuccessMessage("Content created — uploads in progress");
      resetForm();
      onSuccess(); // refresh lists to show new draft immediately
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to create content",
      );
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className={successStyles.success} role="status">
          {successMessage}
        </div>
      )}

      {/* Content Type */}
      <div className={formStyles.fieldGroup}>
        <label htmlFor="content-type" className={formStyles.label}>
          Type
        </label>
        <select
          id="content-type"
          value={type}
          onChange={(e) => {
            const v = e.target.value;
            if ((CONTENT_TYPES as readonly string[]).includes(v)) {
              setType(v as ContentType);
            }
          }}
          className={formStyles.select}
          disabled={isSubmitting}
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
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
          className={
            fieldErrors.title
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
          disabled={isSubmitting}
          maxLength={MAX_TITLE_LENGTH}
        />
        {fieldErrors.title && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.title}
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
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: undefined }));
          }}
          className={`${formStyles.textarea} ${styles.textarea}`}
          disabled={isSubmitting}
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
        />
        {fieldErrors.description && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.description}
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
          value={visibility}
          onChange={(e) => {
            const v = e.target.value;
            if ((VISIBILITY as readonly string[]).includes(v)) {
              setVisibility(v as Visibility);
            }
          }}
          className={formStyles.select}
          disabled={isSubmitting}
        >
          {VISIBILITY.map((v) => (
            <option key={v} value={v}>
              {v === "public" ? "Public" : "Subscribers Only"}
            </option>
          ))}
        </select>
      </div>

      {/* Body (written only) */}
      {type === "written" && (
        <div className={formStyles.fieldGroup}>
          <label htmlFor="content-body" className={formStyles.label}>
            Body
          </label>
          <textarea
            id="content-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (fieldErrors.body) setFieldErrors((prev) => ({ ...prev, body: undefined }));
            }}
            className={
              fieldErrors.body
                ? `${formStyles.textarea} ${styles.textarea} ${formStyles.inputError}`
                : `${formStyles.textarea} ${styles.textarea}`
            }
            disabled={isSubmitting}
            rows={8}
          />
          {fieldErrors.body && (
            <span className={formStyles.fieldError} role="alert">
              {fieldErrors.body}
            </span>
          )}
        </div>
      )}

      {/* Save as draft (written only) */}
      {type === "written" && (
        <div className={formStyles.fieldGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={saveAsDraft}
              onChange={(e) => setSaveAsDraft(e.target.checked)}
              disabled={isSubmitting}
            />
            Save as draft (don&apos;t publish immediately)
          </label>
        </div>
      )}

      {/* Media file (audio/video only) */}
      {type !== "written" && (
        <FileInputField
          label="Media File"
          inputId="content-media"
          accept={type === "audio" ? AUDIO_ACCEPT : VIDEO_ACCEPT}
          inputRef={mediaRef}
          fileName={mediaFileName}
          onFileChange={setMediaFileName}
          onClear={() => {
            if (mediaRef.current) mediaRef.current.value = "";
            setMediaFileName("");
          }}
          disabled={isSubmitting}
        />
      )}

      {/* Cover art (audio only) */}
      {type === "audio" && (
        <FileInputField
          label="Cover Art (optional)"
          inputId="content-cover-art"
          accept={IMAGE_ACCEPT}
          inputRef={coverArtRef}
          fileName={coverArtFileName}
          onFileChange={setCoverArtFileName}
          onClear={() => {
            if (coverArtRef.current) coverArtRef.current.value = "";
            setCoverArtFileName("");
          }}
          disabled={isSubmitting}
        />
      )}

      {/* Thumbnail (video only) */}
      {type === "video" && (
        <FileInputField
          label="Thumbnail (optional)"
          inputId="content-thumbnail"
          accept={IMAGE_ACCEPT}
          inputRef={thumbnailRef}
          fileName={thumbnailFileName}
          onFileChange={setThumbnailFileName}
          onClear={() => {
            if (thumbnailRef.current) thumbnailRef.current.value = "";
            setThumbnailFileName("");
          }}
          disabled={isSubmitting}
        />
      )}

      {/* Submit / Cancel */}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={`${formStyles.submitButton} ${styles.submitButton}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? submitStatus || "Creating..." : "Create Content"}
        </button>
        {onCancel && (
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
