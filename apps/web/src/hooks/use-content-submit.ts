import { useState, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import { z, safeParse } from "zod/mini";
import type { CreateContent, UploadPurpose } from "@snc/shared";
import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, CONTENT_TYPES, VISIBILITY } from "@snc/shared";

import { extractFieldErrors } from "../lib/form-utils.js";
import { createContent } from "../lib/content.js";
import { useUpload } from "../contexts/upload-context.js";
import type { ContentFormFields } from "./use-content-form-fields.js";

// ── Private Constants ──

const FORM_FIELDS = ["title", "description", "type", "visibility", "body"] as const;

const FormSchema = z.object({
  title: z.string().check(z.minLength(1, "Title is required"), z.maxLength(MAX_TITLE_LENGTH)),
  type: z.enum(CONTENT_TYPES),
  description: z.optional(z.string().check(z.maxLength(MAX_DESCRIPTION_LENGTH))),
  visibility: z.enum(VISIBILITY),
  body: z.optional(z.string()),
});

// ── Public Types ──

export interface ContentSubmitState {
  readonly fieldErrors: Partial<Record<string, string>>;
  readonly serverError: string;
  readonly successMessage: string;
  readonly isSubmitting: boolean;
  readonly submitStatus: string;
  readonly setFieldErrors: (errors: Partial<Record<string, string>>) => void;
  readonly handleSubmit: (e: FormEvent) => Promise<void>;
}

// ── Public API ──

/** Manage content creation form submission: validate, create draft, and enqueue file uploads. */
export function useContentSubmit(
  fields: ContentFormFields,
  creatorId: string,
  callbacks: {
    readonly onSuccess: () => void;
    readonly onUploadComplete?: () => void;
  },
): ContentSubmitState {
  const { actions: uploadActions } = useUpload();
  const onUploadCompleteRef = useRef(callbacks.onUploadComplete);
  onUploadCompleteRef.current = callbacks.onUploadComplete;

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  const handleSubmit = useCallback(async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setServerError("");
    setSuccessMessage("");
    setFieldErrors({});

    const formData = {
      creatorId,
      title: fields.title.trim(),
      type: fields.type,
      description: fields.description.trim() || undefined,
      visibility: fields.visibility,
      body: fields.type === "written" ? fields.body : undefined,
    } as CreateContent;

    const result = safeParse(FormSchema, formData);
    if (!result.success) {
      setFieldErrors(extractFieldErrors(result.error.issues, FORM_FIELDS));
      return;
    }

    if (fields.type === "written" && !fields.body.trim()) {
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

      const mediaFile = fields.mediaRef.current?.files?.[0];
      if (mediaFile) {
        filesToUpload.push({ file: mediaFile, purpose: "content-media" });
      }

      const coverArtFile = fields.coverArtRef.current?.files?.[0];
      if (coverArtFile) {
        filesToUpload.push({ file: coverArtFile, purpose: "content-thumbnail" });
      }

      const thumbnailFile = fields.thumbnailRef.current?.files?.[0];
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
      setSuccessMessage(
        filesToUpload.length > 0
          ? "Draft created — uploads in progress"
          : "Draft created",
      );
      fields.resetForm();
      callbacks.onSuccess(); // refresh lists to show new draft immediately
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to create content",
      );
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  }, [creatorId, fields, callbacks, uploadActions]);

  return {
    fieldErrors,
    serverError,
    successMessage,
    isSubmitting,
    submitStatus,
    setFieldErrors,
    handleSubmit,
  };
}
