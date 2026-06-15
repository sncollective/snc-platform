import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";

// ── Service Mocks ──

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

// ── Test Context ──

const ctx = setupRouteTest({
  defaultAuth: { user: makeMockUser(), roles: [] },
  mocks: () => {
    vi.doMock("../../src/services/notify-when-live.js", () => ({
      subscribeToChannel: mockSubscribe,
      unsubscribeFromChannel: mockUnsubscribe,
    }));
  },
  mountRoute: async (app) => {
    const { notifyRoutes } = await import("../../src/routes/notify.routes.js");
    app.route("/api/notify-when-live", notifyRoutes);
  },
  beforeEach: () => {
    mockSubscribe.mockResolvedValue({ ok: true, value: undefined });
    mockUnsubscribe.mockResolvedValue({ ok: true, value: undefined });
  },
});

const post = (body: unknown) =>
  ctx.app.request("/api/notify-when-live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ── Tests ──

describe("POST /api/notify-when-live", () => {
  it("subscribes an authenticated user with consent", async () => {
    const res = await post({ channelId: "ch-1", consent: true });
    expect(res.status).toBe(200);
    expect(mockSubscribe).toHaveBeenCalledWith(
      ctx.auth.user!.id,
      "ch-1",
      expect.any(String),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await post({ channelId: "ch-1", consent: true });
    expect(res.status).toBe(401);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("rejects without consent: true (validation)", async () => {
    const res = await post({ channelId: "ch-1", consent: false });
    expect(res.status).toBe(400);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("rejects a missing channelId", async () => {
    const res = await post({ consent: true });
    expect(res.status).toBe(400);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("surfaces a NotFoundError from the service as 404", async () => {
    const { NotFoundError } = await import("@snc/shared");
    mockSubscribe.mockResolvedValue({ ok: false, error: new NotFoundError("Channel not found") });
    const res = await post({ channelId: "missing", consent: true });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/notify-when-live/:channelId", () => {
  it("unsubscribes an authenticated user", async () => {
    const res = await ctx.app.request("/api/notify-when-live/ch-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(mockUnsubscribe).toHaveBeenCalledWith(ctx.auth.user!.id, "ch-1");
  });

  it("returns 401 when unauthenticated", async () => {
    ctx.auth.user = null;
    const res = await ctx.app.request("/api/notify-when-live/ch-1", { method: "DELETE" });
    expect(res.status).toBe(401);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });
});
