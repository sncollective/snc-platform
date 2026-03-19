import type { Project, ProjectsResponse } from "@snc/shared";

// ── Web-level Fixtures ──

export const makeMockProject = (overrides?: Partial<Project>): Project => ({
  id: "proj_test001",
  name: "Animal Future LP",
  description: "Album release project",
  creatorId: "creator_test001",
  createdBy: "user_test123",
  completed: false,
  completedAt: null,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

export const makeMockProjectsResponse = (
  overrides?: Partial<ProjectsResponse>,
): ProjectsResponse => ({
  items: [makeMockProject()],
  nextCursor: null,
  ...overrides,
});
