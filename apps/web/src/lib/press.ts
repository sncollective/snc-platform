import type {
  DraftPressConfigPatch,
  DraftPressContent,
  PressPagePayload,
  ReleaseOneSheet,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

/** Fetch the public press page for a creator. */
export async function fetchPressPage(creatorId: string): Promise<PressPagePayload> {
  return apiGet<PressPagePayload>(
    `/api/creators/${encodeURIComponent(creatorId)}/press`,
  );
}

/** Fetch one release's public one-sheet metadata. */
export async function fetchReleaseOneSheet(
  creatorId: string,
  slug: string,
): Promise<ReleaseOneSheet> {
  return apiGet<ReleaseOneSheet>(
    `/api/creators/${encodeURIComponent(creatorId)}/press/releases/${encodeURIComponent(slug)}`,
  );
}

/** Fetch the editable press configuration for a creator. */
export async function fetchPressConfig(creatorId: string): Promise<DraftPressContent> {
  return apiGet<DraftPressContent>(
    `/api/creators/${encodeURIComponent(creatorId)}/press-config`,
  );
}

/** Update the editable press configuration for a creator. */
export async function updatePressConfig(
  creatorId: string,
  patch: DraftPressConfigPatch,
): Promise<DraftPressContent> {
  return apiMutate<DraftPressContent>(
    `/api/creators/${encodeURIComponent(creatorId)}/press-config`,
    { method: "PATCH", body: patch },
  );
}
