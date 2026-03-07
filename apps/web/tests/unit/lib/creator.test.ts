import { describe, it, expect } from "vitest";

import {
  fetchCreatorProfile,
  updateCreatorProfile,
} from "../../../src/lib/creator.js";
import { makeMockCreatorProfileResponse } from "../../helpers/creator-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── Tests ──

describe("fetchCreatorProfile", () => {
  it("fetches from correct URL with credentials", async () => {
    const profile = makeMockCreatorProfileResponse();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(profile), { status: 200 }),
    );

    const result = await fetchCreatorProfile("user_test123");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creators/user_test123",
      { credentials: "include" },
    );
    expect(result).toEqual(profile);
  });

  it("encodes special characters in creator ID", async () => {
    const profile = makeMockCreatorProfileResponse();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(profile), { status: 200 }),
    );

    await fetchCreatorProfile("user/special id");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creators/user%2Fspecial%20id",
      { credentials: "include" },
    );
  });

  it("throws on 404 response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Creator not found" } }),
        { status: 404 },
      ),
    );

    await expect(fetchCreatorProfile("nonexistent")).rejects.toThrow(
      "Creator not found",
    );
  });

  it("throws on 500 response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Server error" } }),
        { status: 500 },
      ),
    );

    await expect(fetchCreatorProfile("user_test123")).rejects.toThrow(
      "Server error",
    );
  });
});

describe("updateCreatorProfile", () => {
  it("sends PATCH to correct URL with body and credentials", async () => {
    const socialLinks = [
      { platform: "bandcamp" as const, url: "https://myband.bandcamp.com" },
    ];
    const updatedProfile = makeMockCreatorProfileResponse({ socialLinks });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(updatedProfile), { status: 200 }),
    );

    const result = await updateCreatorProfile("user_test123", { socialLinks });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/creators/user_test123",
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ socialLinks }),
      },
    );
    expect(result).toEqual(updatedProfile);
  });

  it("encodes special characters in creator ID", async () => {
    const profile = makeMockCreatorProfileResponse();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify(profile), { status: 200 }),
    );

    await updateCreatorProfile("user/special id", { displayName: "X" });

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("user%2Fspecial%20id");
  });

  it("throws on 401 response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(
      updateCreatorProfile("user_test123", { displayName: "New Name" }),
    ).rejects.toThrow("Unauthorized");
  });

  it("throws on 403 response for non-owner", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Cannot update another creator's profile" },
        }),
        { status: 403 },
      ),
    );

    await expect(
      updateCreatorProfile("other_user", { displayName: "New Name" }),
    ).rejects.toThrow("Cannot update another creator's profile");
  });

  it("throws on 400 validation error", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Validation failed" } }),
        { status: 400 },
      ),
    );

    await expect(
      updateCreatorProfile("user_test123", {
        socialLinks: [{ platform: "bandcamp" as const, url: "not-a-valid-url" }],
      }),
    ).rejects.toThrow("Validation failed");
  });
});
