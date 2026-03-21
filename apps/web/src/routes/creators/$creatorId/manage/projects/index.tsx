import { createFileRoute, getRouteApi, redirect, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type React from "react";
import type { Project } from "@snc/shared";
import { MAX_PROJECT_NAME_LENGTH, MAX_PROJECT_DESCRIPTION_LENGTH } from "@snc/shared";

import { z, minLength, maxLength, safeParse } from "zod/mini";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../../../../../lib/project.js";
import { isFeatureEnabled } from "../../../../../lib/config.js";
import { extractFieldErrors } from "../../../../../lib/form-utils.js";
import formStyles from "../../../../../styles/form.module.css";
import sectionStyles from "../../../../../styles/detail-section.module.css";
import styles from "./projects-manage.module.css";

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

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/projects/")({
  beforeLoad: () => {
    if (!isFeatureEnabled("calendar")) throw redirect({ to: "/" });
  },
  component: ManageProjectsPage,
});

// ── Inline Project Form ──

interface ProjectFormProps {
  readonly project?: Project | undefined;
  readonly creatorId: string;
  readonly onSuccess: (project: Project) => void;
  readonly onCancel: () => void;
}

function ProjectForm({ project, creatorId, onSuccess, onCancel }: ProjectFormProps): React.ReactElement {
  const isEdit = project !== undefined;
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
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
        const created = await createProject({
          name: data.name,
          description: data.description,
          creatorId,
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
          className={
            fieldErrors.name
              ? `${formStyles.input} ${formStyles.inputError}`
              : formStyles.input
          }
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

// ── Project Item ──

interface ProjectItemProps {
  readonly project: Project;
  readonly creatorId: string;
  readonly onEdit: (project: Project) => void;
  readonly onToggleComplete: (project: Project) => void;
  readonly onDelete: (id: string) => void;
}

function ProjectItem({ project, creatorId, onEdit, onToggleComplete, onDelete }: ProjectItemProps): React.ReactElement {
  return (
    <div className={styles.projectItem}>
      <div className={styles.projectItemHeader}>
        <div className={styles.projectItemMeta}>
          <Link
            to="/creators/$creatorId/manage/projects/$projectSlug"
            params={{ creatorId, projectSlug: project.slug }}
            className={styles.projectName}
          >
            {project.name}
          </Link>
          {project.completed && (
            <span className={styles.completedBadge}>Completed</span>
          )}
        </div>
        <div className={styles.projectItemActions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => onEdit(project)}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => onToggleComplete(project)}
          >
            {project.completed ? "Reopen" : "Complete"}
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => onDelete(project.id)}
          >
            Delete
          </button>
        </div>
      </div>
      {project.description && (
        <p className={styles.projectDescription}>{project.description}</p>
      )}
    </div>
  );
}

// ── Component ──

function ManageProjectsPage(): React.ReactElement {
  const { creator } = manageRoute.useLoaderData();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadProjects = async () => {
    try {
      const params: Record<string, string> = { creatorId: creator.id };
      if (!showCompleted) params.completed = "false";
      const result = await fetchProjects(params);
      setProjects(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: showCompleted drives reload
  useEffect(() => {
    void loadProjects();
  }, [showCompleted]);

  const handleFormSuccess = (project: Project) => {
    if (editingProject) {
      setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
    } else {
      setProjects((prev) => [project, ...prev]);
    }
    setShowForm(false);
    setEditingProject(undefined);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleToggleComplete = async (project: Project) => {
    try {
      const updated = await updateProject(project.id, {
        completed: !project.completed,
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update project");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    }
  };

  const handleNewProject = () => {
    setEditingProject(undefined);
    setShowForm(true);
  };

  return (
    <div className={styles.projectsManage}>
      <section className={sectionStyles.section}>
        <div className={styles.headerRow}>
          <h2 className={sectionStyles.sectionHeading}>Projects</h2>
          <button
            type="button"
            className={styles.newButton}
            onClick={handleNewProject}
          >
            New Project
          </button>
        </div>

        {error !== null && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.filterRow}>
          <label className={styles.filterLabel}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            {" "}Show completed
          </label>
        </div>

        {showForm && (
          <div className={styles.formWrapper}>
            <ProjectForm
              project={editingProject}
              creatorId={creator.id}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowForm(false);
                setEditingProject(undefined);
              }}
            />
          </div>
        )}

        {isLoading ? (
          <p className={styles.status}>Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className={styles.status}>No projects yet. Create one to get started.</p>
        ) : (
          <div className={styles.projectList}>
            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                creatorId={creator.id}
                onEdit={handleEdit}
                onToggleComplete={(p) => { void handleToggleComplete(p); }}
                onDelete={(id) => { void handleDelete(id); }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
