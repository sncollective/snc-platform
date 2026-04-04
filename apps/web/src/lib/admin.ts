import type {
  AdminUserResponse,
  AssignRoleRequest,
  RevokeRoleRequest,
  AdminCreatorsResponse,
  AdminCreatorsQuery,
  AdminCreatorResponse,
  AdminCreateCreator,
  UpdateCreatorStatus,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

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

/** Fetch paginated admin creator list. */
export async function listAdminCreators(
  params?: Partial<AdminCreatorsQuery>,
): Promise<AdminCreatorsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.status) searchParams.set("status", params.status);
  const qs = searchParams.toString();
  return apiGet<AdminCreatorsResponse>(`/api/admin/creators${qs ? `?${qs}` : ""}`);
}

/** Create a new creator profile (admin only). */
export async function createCreator(
  data: AdminCreateCreator,
): Promise<AdminCreatorResponse> {
  return apiMutate<AdminCreatorResponse>("/api/admin/creators", {
    method: "POST",
    body: data,
  });
}

/** Change a creator's lifecycle status (admin only). */
export async function updateCreatorStatus(
  creatorId: string,
  data: UpdateCreatorStatus,
): Promise<AdminCreatorResponse> {
  return apiMutate<AdminCreatorResponse>(
    `/api/admin/creators/${encodeURIComponent(creatorId)}/status`,
    { method: "PATCH", body: data },
  );
}
