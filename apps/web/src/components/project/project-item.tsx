import type React from "react";
import type { Project } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import styles from "../../routes/projects.module.css";

// ── Public Types ──

export interface ProjectItemProps {
  readonly project: Project;
  readonly onEdit: (project: Project) => void;
  readonly onToggleComplete: (project: Project) => void;
  readonly onDelete: (id: string) => void;
}

// ── Public API ──

export function ProjectItem({ project, onEdit, onToggleComplete, onDelete }: ProjectItemProps): React.ReactElement {
  return (
    <div className={styles.projectItem}>
      <div className={styles.projectItemHeader}>
        <div className={styles.projectItemMeta}>
          <Link
            to="/projects/$projectSlug"
            params={{ projectSlug: project.slug }}
            className={styles.projectNameLink}
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
