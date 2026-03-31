import type {
  StreamKeysListResponse,
  StreamKeyCreatedResponse,
  StreamKeyResponse,
  SimulcastDestination,
  CreateSimulcastDestination,
  UpdateSimulcastDestination,
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

// ── Creator Simulcast Destinations ──

/** Fetch simulcast destinations for a creator (owner only). */
export async function fetchCreatorSimulcastDestinations(
  creatorId: string,
): Promise<{ destinations: SimulcastDestination[] }> {
  return apiGet<{ destinations: SimulcastDestination[] }>(
    `/api/streaming/simulcast/${encodeURIComponent(creatorId)}`,
  );
}

/** Create a simulcast destination for a creator. */
export async function createCreatorSimulcastDestination(
  creatorId: string,
  input: CreateSimulcastDestination,
): Promise<{ destination: SimulcastDestination }> {
  return apiMutate<{ destination: SimulcastDestination }>(
    `/api/streaming/simulcast/${encodeURIComponent(creatorId)}`,
    { method: "POST", body: input },
  );
}

/** Update a creator's simulcast destination. */
export async function updateCreatorSimulcastDestination(
  creatorId: string,
  destId: string,
  input: UpdateSimulcastDestination,
): Promise<{ destination: SimulcastDestination }> {
  return apiMutate<{ destination: SimulcastDestination }>(
    `/api/streaming/simulcast/${encodeURIComponent(creatorId)}/${encodeURIComponent(destId)}`,
    { method: "PATCH", body: input },
  );
}

/** Delete a creator's simulcast destination. */
export async function deleteCreatorSimulcastDestination(
  creatorId: string,
  destId: string,
): Promise<void> {
  await apiMutate(
    `/api/streaming/simulcast/${encodeURIComponent(creatorId)}/${encodeURIComponent(destId)}`,
    { method: "DELETE" },
  );
}
