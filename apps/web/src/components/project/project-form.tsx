import type React from "react";
import type { Project, CreatorListItem } from "@snc/shared";

import { ProjectBaseForm } from "./project-base-form.js";

// ── Public Types ──

export interface ProjectFormProps {
  readonly project?: Project | undefined;
  readonly creators: readonly CreatorListItem[];
  readonly onSuccess: (project: Project) => void;
  readonly onCancel: () => void;
}

// ── Public API ──

/** Create/edit form for a project with name, description, and optional creator assignment. Used on the org-level projects page. */
export function ProjectForm({ project, creators, onSuccess, onCancel }: ProjectFormProps): React.ReactElement {
  return (
    <ProjectBaseForm
      project={project}
      creators={creators}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
