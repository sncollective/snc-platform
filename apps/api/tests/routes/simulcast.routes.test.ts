import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";

// ── Mock Fns ──

const mockListSimulcastDestinations = vi.fn();
const mockCreateSimulcastDestination = vi.fn();
const mockUpdateSimulcastDestination = vi.fn();
const mockDeleteSimulcastDestination = vi.fn();

// ── Fixtures ──

const ADMIN_USER_UUID = "00000000-0000-4000-a000-000000000001";

const makeDestination = (overrides?: Partial<{
  id: string;
  platform: string;
  label: string;
  rtmpUrl: string;
  streamKeyPrefix: string;
  isActive: boolean;
  creatorId: string | null;
  createdAt: string;
  updatedAt: string;
}>) => ({
  id: "dest-1",
  platform: "twitch" as const,
  label: "S/NC Twitch",
  rtmpUrl: "rtmp://live.twitch.tv/app",
  streamKeyPrefix: "sk_test1",
  isActive: true,
  creatorId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// ── Test Setup ──

const ctx = setupRouteTest({
  defaultAuth: {
    user: makeMockUser({ id: ADMIN_USER_UUID }),
    session: makeMockSession({ userId: ADMIN_USER_UUID }),
    roles: ["admin"],
  },
  mocks: () => {
    vi.doMock("../../src/services/simulcast.js", () => ({
      listSimulcastDestinations: mockListSimulcastDestinations,
      createSimulcastDestination: mockCreateSimulcastDestination,
      updateSimulcastDestination: mockUpdateSimulcastDestination,
      deleteSimulcastDestination: mockDeleteSimulcastDestination,
    }));
  },
  mountRoute: async (app) => {
    const { simulcastRoutes } = await import("../../src/routes/simulcast.routes.js");
    app.route("/api/simulcast", simulcastRoutes);
  },
  beforeEach: () => {
    mockListSimulcastDestinations.mockResolvedValue({ ok: true, value: [] });
    mockCreateSimulcastDestination.mockResolvedValue({ ok: true, value: makeDestination() });
    mockUpdateSimulcastDestination.mockResolvedValue({ ok: true, value: makeDestination() });
    mockDeleteSimulcastDestination.mockResolvedValue({ ok: true, value: undefined });
  },
});

// ── Tests ──

describe("simulcast routes", () => {
  describe("GET /api/simulcast", () => {
    it("returns destination list for admin", async () => {
      mockListSimulcastDestinations.mockResolvedValue({
        ok: true,
        value: [makeDestination()],
      });

      const res = await ctx.app.request("/api/simulcast");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].id).toBe("dest-1");
    });

    it("returns empty list when no destinations", async () => {
      mockListSimulcastDestinations.mockResolvedValue({ ok: true, value: [] });

      const res = await ctx.app.request("/api/simulcast");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.destinations).toStrictEqual([]);
    });

    it("returns 401 for unauthenticated requests", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/simulcast");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/simulcast");

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/simulcast", () => {
    const validBody = {
      platform: "twitch",
      label: "S/NC Twitch",
      rtmpUrl: "rtmp://live.twitch.tv/app",
      streamKey: "live_sk_test_key",
    };

    it("creates a destination and returns 201", async () => {
      const res = await ctx.app.request("/api/simulcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.destination.id).toBe("dest-1");
      expect(mockCreateSimulcastDestination).toHaveBeenCalledWith(validBody);
    });

    it("returns 400 on invalid input (missing streamKey)", async () => {
      const res = await ctx.app.request("/api/simulcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "twitch", label: "Test", rtmpUrl: "rtmp://live.twitch.tv/app" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 on invalid platform", async () => {
      const res = await ctx.app.request("/api/simulcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, platform: "invalid-platform" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 for unauthenticated requests", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/simulcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/simulcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/simulcast/:id", () => {
    it("updates a destination and returns 200", async () => {
      const updated = makeDestination({ label: "Updated Label", isActive: false });
      mockUpdateSimulcastDestination.mockResolvedValue({ ok: true, value: updated });

      const res = await ctx.app.request("/api/simulcast/dest-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Updated Label", isActive: false }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.destination.label).toBe("Updated Label");
      expect(mockUpdateSimulcastDestination).toHaveBeenCalledWith("dest-1", { label: "Updated Label", isActive: false });
    });

    it("returns 404 when destination not found", async () => {
      const { NotFoundError } = await import("@snc/shared");
      mockUpdateSimulcastDestination.mockResolvedValue({
        ok: false,
        error: new NotFoundError("Simulcast destination not found"),
      });

      const res = await ctx.app.request("/api/simulcast/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 for unauthenticated requests", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/simulcast/dest-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/simulcast/dest-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/simulcast/:id", () => {
    it("deletes a destination and returns 204", async () => {
      const res = await ctx.app.request("/api/simulcast/dest-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(mockDeleteSimulcastDestination).toHaveBeenCalledWith("dest-1");
    });

    it("returns 404 when destination not found", async () => {
      const { NotFoundError } = await import("@snc/shared");
      mockDeleteSimulcastDestination.mockResolvedValue({
        ok: false,
        error: new NotFoundError("Simulcast destination not found"),
      });

      const res = await ctx.app.request("/api/simulcast/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 for unauthenticated requests", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/simulcast/dest-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/simulcast/dest-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
    });
  });
});
