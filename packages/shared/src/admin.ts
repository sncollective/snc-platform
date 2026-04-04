import { z } from "zod";

import { UserSchema, RoleSchema } from "./auth.js";
import { createPaginationQuery } from "./pagination.js";
import { CreatorStatusSchema, CreatorProfileResponseSchema } from "./creator.js";

// ── Public Schemas ──

export const AdminUserSchema = UserSchema.extend({
  roles: z.array(RoleSchema),
});

export const AdminUsersQuerySchema = createPaginationQuery({ max: 100, default: 20 });

export const AdminUsersResponseSchema = z.object({
  items: z.array(AdminUserSchema),
  nextCursor: z.string().nullable(),
});

const RoleBodySchema = z.object({
  role: RoleSchema,
});

export const AssignRoleRequestSchema = RoleBodySchema;
export const RevokeRoleRequestSchema = RoleBodySchema;

export const AdminUserResponseSchema = z.object({
  user: AdminUserSchema,
});

// ── Admin Creator Schemas ──

export const AdminCreatorsQuerySchema = createPaginationQuery({
  max: 100,
  default: 20,
}).extend({
  status: CreatorStatusSchema.optional(),
});

export const AdminCreatorsResponseSchema = z.object({
  items: z.array(CreatorProfileResponseSchema),
  nextCursor: z.string().nullable(),
});

export const AdminCreateCreatorSchema = z.object({
  displayName: z.string().min(1).max(100),
  handle: z
    .string()
    .regex(/^[a-z0-9_-]{3,30}$/, "Handle must be 3–30 characters: lowercase letters, digits, _ or -")
    .optional(),
});

export const UpdateCreatorStatusSchema = z.object({
  status: CreatorStatusSchema,
});

export const AdminCreatorResponseSchema = z.object({
  creator: CreatorProfileResponseSchema,
});

// ── Public Types ──

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;
export type AssignRoleRequest = z.infer<typeof AssignRoleRequestSchema>;
export type RevokeRoleRequest = z.infer<typeof RevokeRoleRequestSchema>;
export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;

// ── Admin Creator Types ──

export type AdminCreatorsQuery = z.infer<typeof AdminCreatorsQuerySchema>;
export type AdminCreatorsResponse = z.infer<typeof AdminCreatorsResponseSchema>;
export type AdminCreateCreator = z.infer<typeof AdminCreateCreatorSchema>;
export type UpdateCreatorStatus = z.infer<typeof UpdateCreatorStatusSchema>;
export type AdminCreatorResponse = z.infer<typeof AdminCreatorResponseSchema>;
