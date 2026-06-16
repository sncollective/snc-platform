import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Service Mocks ──

const mockGetJoinPagePayload = vi.fn();
const mockCompleteJoin = vi.fn();
const mockGetJoinConfig = vi.fn();
const mockUpdateJoinConfig = vi.fn();
const mockFindCreatorProfile = vi.fn();
const mockRequireCreatorPermission = vi.fn();

const ctx = setupRouteTest({
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: () => {
    vi.doMock("../../src/services/join.js", () => ({
      getJoinPagePayload: mockGetJoinPagePayload,
      completeJoin: mockCompleteJoin,
      getJoinConfig: mockGetJoinConfig,
      updateJoinConfig: mockUpdateJoinConfig,
    }));
    vi.doMock("../../src/lib/creator-helpers.js", () => ({
      findCreatorProfile: mockFindCreatorProfile,
    }));
    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
    }));
  },
  mountRoute: async (app) => {
    const { joinRoutes, joinConfigRoutes } = await import("../../src/routes/join.routes.js");
    app.route("/api/join", joinRoutes);
    app.route("/api/creators", joinConfigRoutes);
  },
  beforeEach: () => {
    mockGetJoinPagePayload.mockResolvedValue({ ok: true, value: { creator: { id: "c1" } } });
    mockCompleteJoin.mockResolvedValue({ ok: true, value: undefined });
    mockGetJoinConfig.mockResolvedValue({ ok: true, value: { incentiveText: null, showSncExplainer: true, showSubscribeCta: true } });
    mockUpdateJoinConfig.mockResolvedValue({ ok: true, value: { incentiveText: "x", showSncExplainer: false, showSubscribeCta: true } });
    mockFindCreatorProfile.mockResolvedValue({ id: "c1", handle: "band" });
    mockRequireCreatorPermission.mockResolvedValue(undefined);
  },
});

const json = (method: string, path: string, body?: unknown) =>
  ctx.app.request(path, {
    method,
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });

// ── Tests ──

describe("GET /api/join/:handleOrId", () => {
  it("returns the public payload (no auth required)", async () => {
    ctx.auth.user = null;
    const res = await json("GET", "/api/join/band");
    expect(res.status).toBe(200);
    expect(mockGetJoinPagePayload).toHaveBeenCalledWith("band");
  });

  it("404 for an unknown creator", async () => {
    const { NotFoundError } = await import("@snc/shared");
    mockGetJoinPagePayload.mockResolvedValue({ ok: false, error: new NotFoundError("Creator not found") });
    const res = await json("GET", "/api/join/nope");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/join/:creatorId/complete", () => {
  it("follows + records consent with consent:true", async () => {
    const res = await json("POST", "/api/join/c1/complete", { consent: true });
    expect(res.status).toBe(200);
    expect(mockCompleteJoin).toHaveBeenCalledWith(ctx.auth.user!.id, "c1", expect.any(String));
  });

  it("401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await json("POST", "/api/join/c1/complete", { consent: true });
    expect(res.status).toBe(401);
    expect(mockCompleteJoin).not.toHaveBeenCalled();
  });

  it("422/400 without consent:true — never follows", async () => {
    const res = await json("POST", "/api/join/c1/complete", { consent: false });
    expect(res.status).toBe(400);
    expect(mockCompleteJoin).not.toHaveBeenCalled();
  });
});

describe("GET/PATCH /api/creators/:creatorId/join-config", () => {
  it("GET returns config for a creator member", async () => {
    const res = await json("GET", "/api/creators/c1/join-config");
    expect(res.status).toBe(200);
    expect(mockRequireCreatorPermission).toHaveBeenCalledWith(
      ctx.auth.user!.id,
      "c1",
      "editProfile",
      expect.anything(),
    );
  });

  it("PATCH updates config for a creator member", async () => {
    const res = await json("PATCH", "/api/creators/c1/join-config", { showSncExplainer: false });
    expect(res.status).toBe(200);
    expect(mockUpdateJoinConfig).toHaveBeenCalledWith("c1", { showSncExplainer: false });
  });

  it("403 when not a creator member (permission throws)", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValue(new ForbiddenError("Not a member"));
    const res = await json("GET", "/api/creators/c1/join-config");
    expect(res.status).toBe(403);
  });

  it("401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await json("GET", "/api/creators/c1/join-config");
    expect(res.status).toBe(401);
  });
});
