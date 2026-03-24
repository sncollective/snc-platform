import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type React from "react";
import type { Project } from "@snc/shared";

import {
  fetchProjects,
  updateProject,
  deleteProject,
} from "../../../../../lib/project.js";
import { isFeatureEnabled } from "../../../../../lib/config.js";
import { ManageProjectForm } from "../../../../../components/project/manage-project-form.js";
import { ManageProjectItem } from "../../../../../components/project/manage-project-item.js";
import sectionStyles from "../../../../../styles/detail-section.module.css";
import styles from "./projects-manage.module.css";

// ── Route ──

const manageRoute = getRouteApi("/creators/$creatorId/manage");

export const Route = createFileRoute("/creators/$creatorId/manage/projects/")({
  beforeLoad: () => {
    if (!isFeatureEnabled("calendar")) throw redirect({ to: "/" });
  },
  component: ManageProjectsPage,
});

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
            <ManageProjectForm
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
              <ManageProjectItem
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
