import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import type React from "react";
import { z, safeParse } from "zod/mini";

import {
  CONTENT_TYPES,
  VISIBILITY,
  ACCEPTED_MIME_TYPES,
} from "@snc/shared";
import type { ContentType, Visibility } from "@snc/shared";

import { extractFieldErrors } from "../../lib/form-utils.js";
import { createContent, uploadContentFile } from "../../lib/content.js";
import styles from "./content-form.module.css";

// ── Private Constants ──

const FORM_FIELDS = ["title", "description", "type", "visibility", "body"] as const;

const FormSchema = z.object({
  title: z.string().check(z.minLength(1, "Title is required"), z.maxLength(200)),
  type: z.enum(CONTENT_TYPES),
  description: z.optional(z.string().check(z.maxLength(2000))),
  visibility: z.enum(VISIBILITY),
  body: z.optional(z.string()),
});

const AUDIO_ACCEPT = ACCEPTED_MIME_TYPES.audio.join(",");
const VIDEO_ACCEPT = ACCEPTED_MIME_TYPES.video.join(",");
const IMAGE_ACCEPT = ACCEPTED_MIME_TYPES.image.join(",");

// ── Public Types ──

export interface ContentFormProps {
  readonly onCreated: () => void;
}

// ── Public API ──

export function ContentForm({ onCreated }: ContentFormProps): React.ReactElement {
  const [type, setType] = useState<ContentType>("audio");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [body, setBody] = useState("");

  const mediaRef = useRef<HTMLInputElement>(null);
  const coverArtRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setBody("");
    setVisibility("public");
    setFieldErrors({});
    if (mediaRef.current) mediaRef.current.value = "";
    if (coverArtRef.current) coverArtRef.current.value = "";
    if (thumbnailRef.current) thumbnailRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      setServerError("");
      setSuccessMessage("");
      setFieldErrors({});

      const formData = {
        title: title.trim(),
        type,
        description: description.trim() || undefined,
        visibility,
        body: type === "written" ? body : undefined,
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

        // Step 2: Upload files
        const mediaFile = mediaRef.current?.files?.[0];
        const coverArtFile = coverArtRef.current?.files?.[0];
        const thumbnailFile = thumbnailRef.current?.files?.[0];

        if (mediaFile) {
          setSubmitStatus("Uploading media...");
          await uploadContentFile(created.id, "media", mediaFile);
        }

        if (coverArtFile) {
          setSubmitStatus("Uploading cover art...");
          await uploadContentFile(created.id, "coverArt", coverArtFile);
        }

        if (thumbnailFile) {
          setSubmitStatus("Uploading thumbnail...");
          await uploadContentFile(created.id, "thumbnail", thumbnailFile);
        }

        setSuccessMessage("Content created successfully");
        resetForm();
        onCreated();
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Failed to create content",
        );
      } finally {
        setIsSubmitting(false);
        setSubmitStatus("");
      }
    },
    [title, type, description, visibility, body, resetForm, onCreated],
  );

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {serverError && (
        <div className={styles.fieldError} role="alert" style={{ fontSize: "var(--font-size-sm)" }}>
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className={styles.success} role="status">
          {successMessage}
        </div>
      )}

      {/* Content Type */}
      <div className={styles.fieldGroup}>
        <label htmlFor="content-type" className={styles.label}>
          Type
        </label>
        <select
          id="content-type"
          value={type}
          onChange={(e) => setType(e.target.value as ContentType)}
          className={styles.select}
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
      <div className={styles.fieldGroup}>
        <label htmlFor="content-title" className={styles.label}>
          Title
        </label>
        <input
          id="content-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={
            fieldErrors.title
              ? `${styles.input} ${styles.inputError}`
              : styles.input
          }
          disabled={isSubmitting}
          maxLength={200}
        />
        {fieldErrors.title && (
          <span className={styles.fieldError} role="alert">
            {fieldErrors.title}
          </span>
        )}
      </div>

      {/* Description */}
      <div className={styles.fieldGroup}>
        <label htmlFor="content-description" className={styles.label}>
          Description
        </label>
        <textarea
          id="content-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={styles.textarea}
          disabled={isSubmitting}
          maxLength={2000}
          rows={3}
        />
        {fieldErrors.description && (
          <span className={styles.fieldError} role="alert">
            {fieldErrors.description}
          </span>
        )}
      </div>

      {/* Visibility */}
      <div className={styles.fieldGroup}>
        <label htmlFor="content-visibility" className={styles.label}>
          Visibility
        </label>
        <select
          id="content-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
          className={styles.select}
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
        <div className={styles.fieldGroup}>
          <label htmlFor="content-body" className={styles.label}>
            Body
          </label>
          <textarea
            id="content-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={
              fieldErrors.body
                ? `${styles.textarea} ${styles.inputError}`
                : styles.textarea
            }
            disabled={isSubmitting}
            rows={8}
          />
          {fieldErrors.body && (
            <span className={styles.fieldError} role="alert">
              {fieldErrors.body}
            </span>
          )}
        </div>
      )}

      {/* Media file (audio/video only) */}
      {type !== "written" && (
        <div className={styles.fieldGroup}>
          <label htmlFor="content-media" className={styles.label}>
            Media File
          </label>
          <input
            id="content-media"
            type="file"
            ref={mediaRef}
            accept={type === "audio" ? AUDIO_ACCEPT : VIDEO_ACCEPT}
            className={styles.fileInput}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Cover art (audio only) */}
      {type === "audio" && (
        <div className={styles.fieldGroup}>
          <label htmlFor="content-cover-art" className={styles.label}>
            Cover Art (optional)
          </label>
          <input
            id="content-cover-art"
            type="file"
            ref={coverArtRef}
            accept={IMAGE_ACCEPT}
            className={styles.fileInput}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Thumbnail (video only) */}
      {type === "video" && (
        <div className={styles.fieldGroup}>
          <label htmlFor="content-thumbnail" className={styles.label}>
            Thumbnail (optional)
          </label>
          <input
            id="content-thumbnail"
            type="file"
            ref={thumbnailRef}
            accept={IMAGE_ACCEPT}
            className={styles.fileInput}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className={styles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? submitStatus || "Creating..." : "Create Content"}
      </button>
    </form>
  );
}
