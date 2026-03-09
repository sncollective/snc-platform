import { z } from "zod";

import { UserSchema, RoleSchema } from "./auth.js";

// ── Public Schemas ──

export const AdminUserSchema = UserSchema.extend({
  roles: z.array(RoleSchema),
});

export const AdminUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

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

// ── Public Types ──

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;
export type AssignRoleRequest = z.infer<typeof AssignRoleRequestSchema>;
export type RevokeRoleRequest = z.infer<typeof RevokeRoleRequestSchema>;
export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;
