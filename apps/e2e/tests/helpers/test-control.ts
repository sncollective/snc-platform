import type { APIRequestContext } from "@playwright/test";

export type MayaProgrammingSeedOptions = {
  pool?: boolean;
  queue?: boolean;
  fixtureId?: string;
  title?: string;
  timestampIso?: string;
  channelActive?: boolean;
  syncPlaybackEngine?: boolean;
};

export type MayaProgrammingState = {
  channelId: string;
  creatorId: string;
  contentId: string;
  title: string;
  fixtureId: string | null;
  seededPool: boolean;
  seededQueue: boolean;
  channelActive: boolean;
  playbackEngineSynced: boolean;
};

const DEFAULT_TEST_CONTROL_SECRET = "dev-e2e-test-control-secret-minimum-32-chars";
const TEST_CONTROL_HEADERS = {
  "x-test-control-secret": process.env.TEST_CONTROL_SECRET ?? DEFAULT_TEST_CONTROL_SECRET,
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
  options: Pick<
    MayaProgrammingSeedOptions,
    "fixtureId" | "title" | "channelActive" | "syncPlaybackEngine"
  > = {},
): Promise<MayaProgrammingState> => {
  const response = await request.post("/api/test-control/creator-programming/maya/reset", {
    data: options,
    headers: TEST_CONTROL_HEADERS,
  });
  return assertOk(response, "reset Maya programming");
};

/** Reset Maya's programming state, then seed deterministic pool/queue rows as requested. */
export const seedMayaProgramming = async (
  request: APIRequestContext,
  options: MayaProgrammingSeedOptions = {},
): Promise<MayaProgrammingState> => {
  const response = await request.post("/api/test-control/creator-programming/maya/seed", {
    data: options,
    headers: TEST_CONTROL_HEADERS,
  });
  return assertOk(response, "seed Maya programming");
};
