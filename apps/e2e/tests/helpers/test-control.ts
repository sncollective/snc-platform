import type { APIRequestContext } from "@playwright/test";

export type MayaProgrammingSeedOptions = {
  pool?: boolean;
  queue?: boolean;
};

export type MayaProgrammingState = {
  channelId: string;
  creatorId: string;
  contentId: string;
  seededPool: boolean;
  seededQueue: boolean;
};

const parseJson = async (response: Awaited<ReturnType<APIRequestContext["post"]>>) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
  action: string,
): Promise<MayaProgrammingState> => {
  if (response.ok()) return (await parseJson(response)) as MayaProgrammingState;

  throw new Error(
    `Test-control ${action} failed with ${response.status()}: ${await response.text()}`,
  );
};

/** Reset Maya's creator-programming pool/queue to a clean state without UI surgery. */
export const resetMayaProgramming = async (
  request: APIRequestContext,
): Promise<MayaProgrammingState> => {
  const response = await request.post("/api/test-control/creator-programming/maya/reset");
  return assertOk(response, "reset Maya programming");
};

/** Reset Maya's programming state, then seed deterministic pool/queue rows as requested. */
export const seedMayaProgramming = async (
  request: APIRequestContext,
  options: MayaProgrammingSeedOptions = {},
): Promise<MayaProgrammingState> => {
  const response = await request.post("/api/test-control/creator-programming/maya/seed", {
    data: options,
  });
  return assertOk(response, "seed Maya programming");
};
