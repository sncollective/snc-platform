import type {
  CreatorProfileResponse,
  UpdateCreatorProfile,
  CreateCreator,
  AddCreatorMember,
  UpdateCreatorMember,
  CreatorMembersResponse,
  CandidatesResponse,
  MyCreatorItem,
} from "@snc/shared";

import { apiGet, apiMutate, apiUpload } from "./fetch-utils.js";

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

/**
 * Upload or replace the avatar image for a creator.
 */
export async function uploadCreatorAvatar(
  creatorId: string,
  file: File,
): Promise<CreatorProfileResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<CreatorProfileResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/avatar`,
    formData,
  );
}

/**
 * Upload or replace the banner image for a creator.
 */
export async function uploadCreatorBanner(
  creatorId: string,
  file: File,
): Promise<CreatorProfileResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<CreatorProfileResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/banner`,
    formData,
  );
}

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
 * List creator entities the authenticated user is a member of.
 */
export async function fetchMyCreatorPages(): Promise<MyCreatorItem[]> {
  const res = await apiGet<{ items: MyCreatorItem[]; nextCursor: string | null }>(
    "/api/creators/mine",
  );
  return res.items;
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
