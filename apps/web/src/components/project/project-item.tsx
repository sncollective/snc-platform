import type React from "react";
import type { Project } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { ProjectBaseItem } from "./project-base-item.js";
import styles from "../../routes/projects.module.css";

// ── Public Types ──

export interface ProjectItemProps {
  readonly project: Project;
  readonly onEdit: (project: Project) => void;
  readonly onToggleComplete: (project: Project) => void;
  readonly onDelete: (id: string) => void;
}

// ── Public API ──

/** Render a single project row on the org-level projects page with a link to the project detail, completion badge, and edit/complete/delete actions. */
export function ProjectItem({ project, onEdit, onToggleComplete, onDelete }: ProjectItemProps): React.ReactElement {
  return (
    <ProjectBaseItem
      project={project}
      renderNameLink={(p) => (
        <Link
          to="/projects/$projectSlug"
          params={{ projectSlug: p.slug }}
          className={styles.projectNameLink}
        >
          {p.name}
        </Link>
      )}
      styles={styles}
      onEdit={onEdit}
      onToggleComplete={onToggleComplete}
      onDelete={onDelete}
    />
  );
}
