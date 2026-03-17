import { describe, it, expect } from "vitest";

import { assignRole, revokeRole } from "../../../src/lib/admin.js";
import { makeMockAdminUser } from "../../helpers/admin-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── assignRole ──

describe("assignRole", () => {
  it("sends POST with correct URL, method, and body", async () => {
    const user = makeMockAdminUser({ roles: ["admin"] });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ user }), { status: 200 }),
    );

    const result = await assignRole("user_001", { role: "stakeholder" });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/admin/users/user_001/roles",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "stakeholder" }),
      },
    );
    expect(result).toEqual({ user });
  });

  it("encodes special characters in userId", async () => {
    const user = makeMockAdminUser();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ user }), { status: 200 }),
    );

    await assignRole("user/special id", { role: "admin" });

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("user%2Fspecial%20id");
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "User not found" } }),
        { status: 404 },
      ),
    );

    await expect(assignRole("nonexistent", { role: "admin" })).rejects.toThrow(
      "User not found",
    );
  });
});

// ── revokeRole ──

describe("revokeRole", () => {
  it("sends DELETE with correct URL, method, and body", async () => {
    const user = makeMockAdminUser({ roles: ["stakeholder"] });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ user }), { status: 200 }),
    );

    const result = await revokeRole("user_001", { role: "admin" });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/admin/users/user_001/roles",
      {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      },
    );
    expect(result).toEqual({ user });
  });

  it("encodes special characters in userId", async () => {
    const user = makeMockAdminUser();
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ user }), { status: 200 }),
    );

    await revokeRole("user/special id", { role: "stakeholder" });

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    expect(calledUrl).toContain("user%2Fspecial%20id");
  });

  it("throws on 403 when removing own admin role", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Cannot remove your own admin role" },
        }),
        { status: 403 },
      ),
    );

    await expect(
      revokeRole("self_user", { role: "admin" }),
    ).rejects.toThrow("Cannot remove your own admin role");
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "User not found" } }),
        { status: 404 },
      ),
    );

    await expect(
      revokeRole("nonexistent", { role: "stakeholder" }),
    ).rejects.toThrow("User not found");
  });
});
