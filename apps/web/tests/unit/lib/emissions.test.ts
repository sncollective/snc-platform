import { describe, it, expect } from "vitest";

import {
  fetchEmissionsSummary,
  fetchEmissionsBreakdown,
} from "../../../src/lib/emissions.js";
import {
  makeMockEmissionsSummary,
  makeMockEmissionsBreakdown,
} from "../../helpers/emissions-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── fetchEmissionsSummary ──

describe("fetchEmissionsSummary", () => {
  it("fetches from correct URL with credentials", async () => {
    const summary = makeMockEmissionsSummary();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(summary), { status: 200 }),
    );

    const result = await fetchEmissionsSummary();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/emissions/summary",
      { credentials: "include" },
    );
    expect(result).toEqual(summary);
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Internal server error" } }),
        { status: 500 },
      ),
    );

    await expect(fetchEmissionsSummary()).rejects.toThrow(
      "Internal server error",
    );
  });
});

// ── fetchEmissionsBreakdown ──

describe("fetchEmissionsBreakdown", () => {
  it("fetches from correct URL with credentials", async () => {
    const breakdown = makeMockEmissionsBreakdown();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(breakdown), { status: 200 }),
    );

    const result = await fetchEmissionsBreakdown();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/emissions/breakdown",
      { credentials: "include" },
    );
    expect(result).toEqual(breakdown);
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Service unavailable" } }),
        { status: 503 },
      ),
    );

    await expect(fetchEmissionsBreakdown()).rejects.toThrow(
      "Service unavailable",
    );
  });
});
