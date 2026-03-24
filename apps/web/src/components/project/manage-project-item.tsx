import type React from "react";
import type { Project } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import styles from "../../routes/creators/$creatorId/manage/projects/projects-manage.module.css";

// ── Public Types ──

export interface ManageProjectItemProps {
  readonly project: Project;
  readonly creatorId: string;
  readonly onEdit: (project: Project) => void;
  readonly onToggleComplete: (project: Project) => void;
  readonly onDelete: (id: string) => void;
}

// ── Public API ──

/** Render a single project row in the creator management view with a link to the project detail page, completion badge, and edit/complete/delete actions. */
export function ManageProjectItem({ project, creatorId, onEdit, onToggleComplete, onDelete }: ManageProjectItemProps): React.ReactElement {
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
