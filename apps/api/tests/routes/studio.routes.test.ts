import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Hoisted Mocks ──

const mockSendEmail = vi.fn();
const mockIsEmailConfigured = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  mocks: () => {
    vi.doMock("../../src/email/send.js", () => ({
      sendEmail: mockSendEmail,
      isEmailConfigured: mockIsEmailConfigured,
    }));
  },
  mountRoute: async (app) => {
    const { studioRoutes } = await import("../../src/routes/studio.routes.js");
    app.route("/api/studio", studioRoutes);
  },
  beforeEach: () => {
    mockSendEmail.mockReset();
    mockIsEmailConfigured.mockReset();
    mockIsEmailConfigured.mockReturnValue(false);
    mockSendEmail.mockResolvedValue(undefined);
  },
});

// ── Helpers ──

const validInquiry = {
  name: "Jane Smith",
  email: "jane@example.com",
  service: "recording",
  message: "This is a test inquiry message that is definitely long enough.",
};

// ── Tests ──

describe("POST /api/studio/inquiry", () => {
  it("returns 200 with success: true for a valid inquiry when SMTP not configured", async () => {
    mockIsEmailConfigured.mockReturnValue(false);

    const res = await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validInquiry),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends email and returns 200 when SMTP is configured", async () => {
    mockIsEmailConfigured.mockReturnValue(true);

    const res = await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validInquiry),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Studio Inquiry"),
        html: expect.stringContaining("Jane Smith"),
      }),
    );
  });

  it("returns 400 for missing name", async () => {
    const res = await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validInquiry, name: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const res = await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validInquiry, email: "not-an-email" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for message that is too short", async () => {
    const res = await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validInquiry, message: "Too short" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 502 when email send fails", async () => {
    mockIsEmailConfigured.mockReturnValue(true);
    mockSendEmail.mockRejectedValue(new Error("SMTP connection failed"));

    const res = await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validInquiry),
    });

    expect(res.status).toBe(502);
  });

  it("includes service label in the email subject", async () => {
    mockIsEmailConfigured.mockReturnValue(true);

    await ctx.app.request("/api/studio/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validInquiry, service: "podcast" }),
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Podcast Production"),
      }),
    );
  });
});
