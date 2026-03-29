import { useState } from "react";
import type React from "react";
import type { Project, CreatorListItem } from "@snc/shared";
import { MAX_PROJECT_NAME_LENGTH, MAX_PROJECT_DESCRIPTION_LENGTH } from "@snc/shared";

import { z, minLength, maxLength, safeParse } from "zod/mini";
import { createProject, updateProject } from "../../lib/project.js";
import { extractFieldErrors } from "../../lib/form-utils.js";
import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";
import styles from "./project-base-form.module.css";

// ── Private Schemas ──

const PROJECT_FORM_SCHEMA = z.object({
  name: z
    .string()
    .check(
      minLength(1, "Name is required"),
      maxLength(MAX_PROJECT_NAME_LENGTH, `Name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`),
    ),
  description: z
    .string()
    .check(
      maxLength(MAX_PROJECT_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_PROJECT_DESCRIPTION_LENGTH} characters`),
    ),
});

type ProjectFormFields = "name" | "description";
type FieldErrors = Partial<Record<ProjectFormFields, string>>;

// ── Public Types ──

export interface ProjectBaseFormProps {
  readonly project?: Project | undefined;
  /**
   * When provided, the creator is fixed and no selector is shown.
   * Pass as a string when creating from a creator management page.
   */
  readonly creatorId?: string | undefined;
  /**
   * When provided alongside no fixed creatorId, a creator selector dropdown is shown.
   * Pass for the org-level projects page.
   */
  readonly creators?: readonly CreatorListItem[] | undefined;
  readonly onSuccess: (project: Project) => void;
  readonly onCancel: () => void;
}

// ── Public API ──

/** Unified create/edit form for a project. Pass `creatorId` to fix the creator (no selector shown); pass `creators` to show a selector (org-level). */
export function ProjectBaseForm({ project, creatorId, creators, onSuccess, onCancel }: ProjectBaseFormProps): React.ReactElement {
  const isEdit = project !== undefined;
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [selectedCreatorId, setSelectedCreatorId] = useState(project?.creatorId ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const result = safeParse(PROJECT_FORM_SCHEMA, { name, description });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, ["name", "description"]),
    );
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const data = validate();
    if (!data) return;
    setIsSubmitting(true);
    try {
      if (isEdit) {
        const updated = await updateProject(project.id, {
          name: data.name,
          description: data.description,
        });
        onSuccess(updated);
      } else {
        const resolvedCreatorId = creatorId ?? (selectedCreatorId || null);
        const created = await createProject({
          name: data.name,
          description: data.description,
          creatorId: resolvedCreatorId,
        });
        onSuccess(created);
      }
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to save project",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.projectForm}>
      {serverError && (
        <div className={formStyles.serverError} role="alert">
          {serverError}
        </div>
      )}
      <div className={formStyles.fieldGroup}>
        <label htmlFor="project-name" className={formStyles.label}>
          Name
        </label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className={clsx(formStyles.input, fieldErrors.name && formStyles.inputError)}
        />
        {fieldErrors.name && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.name}
          </span>
        )}
      </div>
      <div className={formStyles.fieldGroup}>
        <label htmlFor="project-description" className={formStyles.label}>
          Description
        </label>
        <textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          className={formStyles.textarea}
        />
        {fieldErrors.description && (
          <span className={formStyles.fieldError} role="alert">
            {fieldErrors.description}
          </span>
        )}
      </div>
      {creators !== undefined && (
        <div className={formStyles.fieldGroup}>
          <label htmlFor="project-creator" className={formStyles.label}>
            Creator
          </label>
          <select
            id="project-creator"
            value={selectedCreatorId}
            onChange={(e) => setSelectedCreatorId(e.target.value)}
            className={formStyles.input}
            disabled={isEdit}
          >
            <option value="">None (org-level)</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        </div>
      )}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={formStyles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving\u2026" : isEdit ? "Save Changes" : "Create Project"}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
