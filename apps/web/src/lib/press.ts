import type {
  PressConfigPatch,
  PressPagePayload,
  ReleaseOneSheet,
  PressContent,
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
export async function fetchPressConfig(creatorId: string): Promise<PressContent> {
  return apiGet<PressContent>(
    `/api/creators/${encodeURIComponent(creatorId)}/press-config`,
  );
}

/** Update the editable press configuration for a creator. */
export async function updatePressConfig(
  creatorId: string,
  patch: PressConfigPatch,
): Promise<PressContent> {
  return apiMutate<PressContent>(
    `/api/creators/${encodeURIComponent(creatorId)}/press-config`,
    { method: "PATCH", body: patch },
  );
}
