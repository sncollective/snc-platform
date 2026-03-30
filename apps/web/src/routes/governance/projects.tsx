import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type React from "react";
import type { Project, CreatorListItem } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { ProjectForm } from "../../components/project/project-form.js";
import { ProjectItem } from "../../components/project/project-item.js";
import { isFeatureEnabled } from "../../lib/config.js";
import {
  fetchProjects,
  updateProject,
  deleteProject,
} from "../../lib/project.js";
import { fetchAllCreators } from "../../lib/creator.js";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "../projects.module.css";

// ── Route ──

export const Route = createFileRoute("/governance/projects")({
  beforeLoad: () => {
    if (!isFeatureEnabled("calendar")) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [{ title: "Projects — S/NC" }],
  }),
  errorComponent: RouteErrorBoundary,
  component: ProjectsPage,
});

// ── Component ──

function ProjectsPage(): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creators, setCreators] = useState<CreatorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    void fetchAllCreators().then((all) => {
      setCreators(all.filter((c) => c.canManage === true));
    });
  }, []);

  const loadProjects = async () => {
    try {
      const params: Record<string, string> = {};
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

  if (!isFeatureEnabled("calendar")) {
    return <div>Projects are not available.</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={listingStyles.heading}>Projects</h1>
        <button
          type="button"
          className={styles.newButton}
          onClick={handleNewProject}
        >
          New Project
        </button>
      </div>

      {error !== null && (
        <div className={styles.error} role="alert">{error}</div>
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
            creators={creators}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingProject(undefined);
            }}
          />
        </div>
      )}

      {isLoading ? (
        <p className={listingStyles.status}>Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className={listingStyles.status}>No projects yet. Create one to get started.</p>
      ) : (
        <div className={styles.projectList}>
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              onEdit={handleEdit}
              onToggleComplete={(p) => { void handleToggleComplete(p); }}
              onDelete={(id) => { void handleDelete(id); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
