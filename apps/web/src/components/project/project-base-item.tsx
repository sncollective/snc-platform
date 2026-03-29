import type React from "react";
import type { Project } from "@snc/shared";

// ── Public Types ──

export interface ProjectBaseItemStyles {
  readonly projectItem: string;
  readonly projectItemHeader: string;
  readonly projectItemMeta: string;
  readonly completedBadge: string;
  readonly projectItemActions: string;
  readonly actionButton: string;
  readonly deleteButton: string;
  readonly projectDescription: string;
}

export interface ProjectBaseItemProps {
  readonly project: Project;
  /** Renders the project name as a link. Receives the project and returns a ReactNode. */
  readonly renderNameLink: (project: Project) => React.ReactNode;
  readonly styles: ProjectBaseItemStyles;
  readonly onEdit: (project: Project) => void;
  readonly onToggleComplete: (project: Project) => void;
  readonly onDelete: (id: string) => void;
}

// ── Public API ──

/** Renders a single project row with a parameterized name link, completion badge, and edit/complete/delete actions. */
export function ProjectBaseItem({ project, renderNameLink, styles, onEdit, onToggleComplete, onDelete }: ProjectBaseItemProps): React.ReactElement {
  return (
    <div className={styles.projectItem}>
      <div className={styles.projectItemHeader}>
        <div className={styles.projectItemMeta}>
          {renderNameLink(project)}
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
