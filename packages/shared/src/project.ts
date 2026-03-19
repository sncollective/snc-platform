import { z } from "zod";

export const MAX_PROJECT_NAME_LENGTH = 200;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  creatorId: z.string().nullable(),
  createdBy: z.string(),
  completed: z.boolean(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  description: z.string().max(MAX_PROJECT_DESCRIPTION_LENGTH).default(""),
  creatorId: z.string().nullable().default(null),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH).optional(),
  description: z.string().max(MAX_PROJECT_DESCRIPTION_LENGTH).optional(),
  completed: z.boolean().optional(),
});

export const ProjectsQuerySchema = z.object({
  creatorId: z.string().optional(),
  completed: z.string().transform((v) => v === "true").optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ProjectResponseSchema = z.object({
  project: ProjectSchema,
});

export const ProjectsResponseSchema = z.object({
  items: z.array(ProjectSchema),
  nextCursor: z.string().nullable(),
});

export const CustomEventTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  slug: z.string(),
});

export const CreateCustomEventTypeSchema = z.object({
  label: z.string().min(1).max(100),
});

export const EventTypesResponseSchema = z.object({
  items: z.array(CustomEventTypeSchema),
});

// Types
export type Project = z.infer<typeof ProjectSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
export type ProjectsQuery = z.infer<typeof ProjectsQuerySchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ProjectsResponse = z.infer<typeof ProjectsResponseSchema>;
export type CustomEventType = z.infer<typeof CustomEventTypeSchema>;
export type CreateCustomEventType = z.infer<typeof CreateCustomEventTypeSchema>;
export type EventTypesResponse = z.infer<typeof EventTypesResponseSchema>;
