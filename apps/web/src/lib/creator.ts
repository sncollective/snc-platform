import type {
  CreatorListItem,
  CreatorProfileResponse,
  UpdateCreatorProfile,
  CreateCreator,
  AddCreatorMember,
  UpdateCreatorMember,
  CreatorMembersResponse,
  CandidatesResponse,
} from "@snc/shared";

import { apiGet, apiMutate, apiUpload } from "./fetch-utils.js";

/**
 * Fetch all creators (public listing). Authenticated stakeholder/admin
 * users receive `canManage: true` on items they have access to.
 */
export async function fetchAllCreators(): Promise<CreatorListItem[]> {
  const res = await apiGet<{ items: CreatorListItem[] }>("/api/creators", { limit: 50 });
  return res.items;
}

/**
 * Fetch a single creator profile by ID.
 */
export async function fetchCreatorProfile(
  creatorId: string,
): Promise<CreatorProfileResponse> {
  return apiGet<CreatorProfileResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}`,
  );
}

/**
 * Update a creator's profile (owner/editor).
 */
export async function updateCreatorProfile(
  creatorId: string,
  data: UpdateCreatorProfile,
): Promise<CreatorProfileResponse> {
  return apiMutate<CreatorProfileResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}`,
    { method: "PATCH", body: data },
  );
}

/** Upload or replace a creator image (avatar or banner). */
async function uploadCreatorImage(
  creatorId: string,
  file: File,
  field: "avatar" | "banner",
): Promise<CreatorProfileResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<CreatorProfileResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/${field}`,
    formData,
  );
}

/**
 * Upload or replace the avatar image for a creator.
 */
export const uploadCreatorAvatar = (id: string, file: File): Promise<CreatorProfileResponse> =>
  uploadCreatorImage(id, file, "avatar");

/**
 * Upload or replace the banner image for a creator.
 */
export const uploadCreatorBanner = (id: string, file: File): Promise<CreatorProfileResponse> =>
  uploadCreatorImage(id, file, "banner");

/**
 * Create a new creator entity (requires stakeholder platform role).
 */
export async function createCreatorEntity(
  data: CreateCreator,
): Promise<CreatorProfileResponse> {
  return apiMutate<CreatorProfileResponse>("/api/creators", {
    method: "POST",
    body: data,
  });
}

/**
 * List members of a creator entity.
 */
export async function fetchCreatorMembers(
  creatorId: string,
): Promise<CreatorMembersResponse> {
  return apiGet<CreatorMembersResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/members`,
  );
}

/**
 * Add a member to a creator entity (owner only).
 */
export async function addCreatorMember(
  creatorId: string,
  data: AddCreatorMember,
): Promise<CreatorMembersResponse> {
  return apiMutate<CreatorMembersResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/members`,
    { method: "POST", body: data },
  );
}

/**
 * Update a member's role (owner only).
 */
export async function updateCreatorMember(
  creatorId: string,
  userId: string,
  data: UpdateCreatorMember,
): Promise<CreatorMembersResponse> {
  return apiMutate<CreatorMembersResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/members/${encodeURIComponent(userId)}`,
    { method: "PATCH", body: data },
  );
}

/**
 * Remove a member from a creator entity (owner only).
 */
export async function removeCreatorMember(
  creatorId: string,
  userId: string,
): Promise<CreatorMembersResponse> {
  return apiMutate<CreatorMembersResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

/**
 * Browse eligible users to add as creator members.
 */
export async function fetchMemberCandidates(
  creatorId: string,
  q?: string,
): Promise<CandidatesResponse> {
  return apiGet<CandidatesResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/members/candidates`,
    q ? { q } : undefined,
  );
}
