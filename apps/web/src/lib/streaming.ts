import type {
  StreamKeysListResponse,
  StreamKeyCreatedResponse,
  StreamKeyResponse,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

/** Fetch stream keys for a creator (owner only). */
export async function fetchStreamKeys(
  creatorId: string,
): Promise<StreamKeysListResponse> {
  return apiGet<StreamKeysListResponse>(
    `/api/streaming/keys/${encodeURIComponent(creatorId)}`,
  );
}

/** Create a named stream key. Returns raw key once. */
export async function createStreamKey(
  creatorId: string,
  name: string,
): Promise<StreamKeyCreatedResponse> {
  return apiMutate<StreamKeyCreatedResponse>(
    `/api/streaming/keys/${encodeURIComponent(creatorId)}`,
    { method: "POST", body: { name } },
  );
}

/** Revoke a stream key. */
export async function revokeStreamKey(
  creatorId: string,
  keyId: string,
): Promise<StreamKeyResponse> {
  return apiMutate<StreamKeyResponse>(
    `/api/streaming/keys/${encodeURIComponent(creatorId)}/${encodeURIComponent(keyId)}`,
    { method: "DELETE" },
  );
}
