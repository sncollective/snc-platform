import type React from "react";
import type { Project } from "@snc/shared";

import { ProjectBaseForm } from "./project-base-form.js";

// ── Public Types ──

export interface ManageProjectFormProps {
  readonly project?: Project | undefined;
  readonly creatorId: string;
  readonly onSuccess: (project: Project) => void;
  readonly onCancel: () => void;
}

// ── Public API ──

/** Create/edit form for a project scoped to a specific creator, with name and description fields and Zod validation. */
export function ManageProjectForm({ project, creatorId, onSuccess, onCancel }: ManageProjectFormProps): React.ReactElement {
  return (
    <ProjectBaseForm
      project={project}
      creatorId={creatorId}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
