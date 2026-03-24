import type {
  Project,
  ProjectResponse,
  ProjectsResponse,
  CreateProject,
  UpdateProject,
  CalendarEventsResponse,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

// ── Public API ──

/** Fetch a paginated list of projects with optional filters. */
export async function fetchProjects(
  params?: Record<string, string | number | undefined>,
): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>("/api/projects", params);
}

/** Fetch a single project by ID. */
export async function fetchProject(id: string): Promise<ProjectResponse> {
  return apiGet<ProjectResponse>(`/api/projects/${encodeURIComponent(id)}`);
}

/** Create a new project. */
export async function createProject(data: CreateProject): Promise<Project> {
  const result = await apiMutate<{ project: Project }>("/api/projects", {
    body: data,
  });
  return result.project;
}

/** Update an existing project by ID. */
export async function updateProject(
  id: string,
  data: UpdateProject,
): Promise<Project> {
  const result = await apiMutate<{ project: Project }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: data,
  });
  return result.project;
}

/** Delete a project by ID. */
export async function deleteProject(id: string): Promise<void> {
  await apiMutate<undefined>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Fetch calendar events associated with a project. */
export async function fetchProjectEvents(
  id: string,
  params?: Record<string, string | number | undefined>,
): Promise<CalendarEventsResponse> {
  return apiGet<CalendarEventsResponse>(`/api/projects/${encodeURIComponent(id)}/events`, params);
}
