import type React from "react";
import type { Project } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { ProjectBaseItem } from "./project-base-item.js";
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
    <ProjectBaseItem
      project={project}
      renderNameLink={(p) => (
        <Link
          to="/creators/$creatorId/manage/projects/$projectSlug"
          params={{ creatorId, projectSlug: p.slug }}
          className={styles.projectName}
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
