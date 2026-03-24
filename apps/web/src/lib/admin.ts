import type {
  AdminUserResponse,
  AssignRoleRequest,
  RevokeRoleRequest,
} from "@snc/shared";

import { apiMutate } from "./fetch-utils.js";

// ── Public API ──

/** Assign a role to a user via the admin API. */
export async function assignRole(
  userId: string,
  data: AssignRoleRequest,
): Promise<AdminUserResponse> {
  return apiMutate<AdminUserResponse>(
    `/api/admin/users/${encodeURIComponent(userId)}/roles`,
    { method: "POST", body: data },
  );
}

/** Revoke a role from a user via the admin API. */
export async function revokeRole(
  userId: string,
  data: RevokeRoleRequest,
): Promise<AdminUserResponse> {
  return apiMutate<AdminUserResponse>(
    `/api/admin/users/${encodeURIComponent(userId)}/roles`,
    { method: "DELETE", body: data },
  );
}
