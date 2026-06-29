import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock DB Chains ──

const mockInsertValues = vi.fn();
const mockInsert = vi.fn();
const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();
const mockDb = { insert: mockInsert, select: mockSelect };

// ── Mock Collaborators ──

const mockConsentLogTable = { tableName: "consent_log" };
const mockFindCreatorProfile = vi.fn();
const mockFollowCreator = vi.fn();

// ── Test Setup ──

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/consent.schema.js", () => ({
    consentLog: mockConsentLogTable,
  }));
  vi.doMock("../../src/db/schema/user.schema.js", () => ({
    users: { id: {}, emailVerified: {} },
  }));
  vi.doMock("../../src/lib/creator-helpers.js", () => ({
    findCreatorProfile: mockFindCreatorProfile,
  }));
  vi.doMock("../../src/services/follows.js", () => ({
    followCreator: mockFollowCreator,
  }));

  return await import("../../src/services/join.js");
};

beforeEach(() => {
  vi.resetAllMocks();

  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockInsertValues.mockResolvedValue(undefined);
  mockSelect.mockReturnValue({ from: mockSelectFrom });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectLimit.mockResolvedValue([{ emailVerified: true }]);
  mockFindCreatorProfile.mockResolvedValue({ id: "creator-123" });
  mockFollowCreator.mockResolvedValue({ ok: true, value: undefined });
});

afterEach(() => {
  vi.resetModules();
});

// ── Tests ──

describe("completeJoin", () => {
  it("follows the creator and appends an email-contact consent record", async () => {
    const { completeJoin } = await setupService();

    const result = await completeJoin("user-123", "creator-123", "policy-2026-06-15");

    expect(result.ok).toBe(true);
    expect(mockFindCreatorProfile).toHaveBeenCalledWith("creator-123");
    expect(mockFollowCreator).toHaveBeenCalledWith("user-123", "creator-123");
    expect(mockInsert).toHaveBeenCalledWith(mockConsentLogTable);
    expect(mockInsertValues).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: "user-123",
      consentType: "email-contact",
      policyVersion: "policy-2026-06-15",
      source: "join:creator-123",
    });
  });

  it("returns 403 and does not follow or append consent when the user's email is unverified", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ emailVerified: false }]);
    const { completeJoin } = await setupService();

    const result = await completeJoin("user-123", "creator-123", "policy-2026-06-15");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.statusCode).toBe(403);
      expect(result.error.message).toBe("Email not verified");
    }
    expect(mockFollowCreator).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("does not append consent when the creator cannot be followed", async () => {
    const { AppError } = await import("@snc/shared");
    const followError = new AppError("FOLLOW_FAILED", "Unable to follow creator", 500);
    mockFollowCreator.mockResolvedValueOnce({ ok: false, error: followError });
    const { completeJoin } = await setupService();

    const result = await completeJoin("user-123", "creator-123", "policy-2026-06-15");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(followError);
    }
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
