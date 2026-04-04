import { describe, it, expect, vi, afterEach } from "vitest";

// ── Module Setup ──

const setupModule = async (overrides?: {
  emailConfigured?: boolean;
  existingInvite?: Record<string, unknown> | null;
  existingUser?: { email: string } | null;
}) => {
  const emailConfigured = overrides?.emailConfigured ?? true;
  const existingInvite = overrides?.existingInvite ?? null;
  const existingUser = overrides?.existingUser ?? { email: "invitee@example.com" };

  // ── DB mocks ──

  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  const mockInsertConflictValues = vi.fn(() => ({
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  }));
  const mockInsertConflict = vi.fn(() => ({ values: mockInsertConflictValues }));

  const mockSelectWhere = vi.fn();
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateSetWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

  // Default: inviteTokens select returns existingInvite or []
  mockSelectWhere.mockResolvedValueOnce(existingInvite ? [existingInvite] : []);
  // Default: users select returns existingUser or []
  if (existingUser !== null) {
    mockSelectWhere.mockResolvedValueOnce([existingUser]);
  } else {
    mockSelectWhere.mockResolvedValueOnce([]);
  }

  const mockDb = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };

  vi.doMock("../../src/config.js", () => ({
    config: {
      SMTP_HOST: emailConfigured ? "smtp.example.com" : undefined,
      BETTER_AUTH_URL: "https://app.example.com",
    },
  }));

  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));

  vi.doMock("../../src/db/schema/invite.schema.js", () => ({
    inviteTokens: {
      tokenHash: {},
      acceptedAt: {},
      expiresAt: {},
      id: {},
    },
  }));

  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorProfiles: {
      handle: {},
      id: {},
    },
    creatorMembers: {},
  }));

  vi.doMock("../../src/db/schema/user.schema.js", () => ({
    users: { id: {}, email: {} },
  }));

  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  vi.doMock("../../src/email/send.js", () => ({
    isEmailConfigured: () => emailConfigured,
    sendEmail: mockSendEmail,
  }));

  vi.doMock("../../src/email/templates/invite.js", () => ({
    formatInviteEmail: vi.fn().mockReturnValue({
      subject: "Test invite",
      html: "<p>invite</p>",
      text: "invite",
    }),
  }));

  const mockGenerateUniqueSlug = vi.fn().mockResolvedValue("test-creator");
  vi.doMock("../../src/services/slug.js", () => ({
    generateUniqueSlug: mockGenerateUniqueSlug,
  }));

  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));

  const module = await import("../../src/services/invites.js");

  return {
    ...module,
    mockDb,
    mockInsert,
    mockInsertValues,
    mockInsertConflict,
    mockInsertConflictValues,
    mockSelect,
    mockSelectWhere,
    mockUpdate,
    mockUpdateSet,
    mockUpdateSetWhere,
    mockSendEmail,
    mockGenerateUniqueSlug,
  };
};

// ── Tests ──

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe("createInvite", () => {
  it("returns EMAIL_NOT_CONFIGURED when SMTP not set up", async () => {
    const { createInvite } = await setupModule({ emailConfigured: false });

    const result = await createInvite(
      { type: "creator_owner", email: "a@b.com", displayName: "Test Creator" },
      "user-1",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMAIL_NOT_CONFIGURED");
      expect(result.error.statusCode).toBe(503);
    }
  });

  it("inserts hashed token and sends email for creator_owner invite", async () => {
    const { createInvite, mockInsert, mockInsertValues, mockSendEmail } =
      await setupModule({ emailConfigured: true });

    const result = await createInvite(
      { type: "creator_owner", email: "invitee@example.com", displayName: "My Creator" },
      "admin-user",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe("invitee@example.com");
      expect(result.value.expiresAt).toBeInstanceOf(Date);
    }
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "creator_owner",
        email: "invitee@example.com",
        createdBy: "admin-user",
      }),
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "invitee@example.com" }),
    );
  });

  it("inserts hashed token for team_member invite", async () => {
    const { createInvite, mockInsertValues } = await setupModule({ emailConfigured: true });

    const result = await createInvite(
      { type: "team_member", email: "member@example.com", creatorId: "creator-1", role: "editor" },
      "owner-user",
    );

    expect(result.ok).toBe(true);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team_member",
        email: "member@example.com",
        payload: { creatorId: "creator-1", role: "editor" },
      }),
    );
  });
});

describe("validateInvite", () => {
  it("returns INVITE_INVALID when token not found", async () => {
    const { validateInvite } = await setupModule({ existingInvite: null });

    const result = await validateInvite("invalid-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVITE_INVALID");
      expect(result.error.statusCode).toBe(404);
    }
  });

  it("returns invite details for a valid token", async () => {
    const now = new Date(Date.now() + 60_000);
    const invite = {
      id: "inv-1",
      type: "creator_owner",
      email: "invitee@example.com",
      payload: { displayName: "My Creator" },
      expiresAt: now,
      acceptedAt: null,
      tokenHash: "hash",
      createdBy: "admin",
      createdAt: new Date(),
    };

    const { validateInvite } = await setupModule({ existingInvite: invite });

    const result = await validateInvite("raw-token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("inv-1");
      expect(result.value.type).toBe("creator_owner");
      expect(result.value.email).toBe("invitee@example.com");
    }
  });
});

describe("acceptInvite", () => {
  it("returns INVITE_INVALID when token not found", async () => {
    const { acceptInvite } = await setupModule({ existingInvite: null });

    const result = await acceptInvite("bad-token", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVITE_INVALID");
    }
  });

  it("returns INVITE_EMAIL_MISMATCH when user email does not match", async () => {
    const now = new Date(Date.now() + 60_000);
    const invite = {
      id: "inv-1",
      type: "creator_owner",
      email: "owner@example.com",
      payload: { displayName: "Test" },
      expiresAt: now,
      acceptedAt: null,
      tokenHash: "h",
      createdBy: "admin",
      createdAt: new Date(),
    };

    // Override mockSelectWhere: first call returns invite, second returns different user email
    const mockSelectWhere = vi.fn()
      .mockResolvedValueOnce([invite])
      .mockResolvedValueOnce([{ email: "different@example.com" }]);

    vi.doMock("../../src/config.js", () => ({
      config: { SMTP_HOST: "smtp.example.com", BETTER_AUTH_URL: "https://app.example.com" },
    }));
    vi.doMock("../../src/db/connection.js", () => ({
      db: {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) })),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
      },
    }));
    vi.doMock("../../src/db/schema/invite.schema.js", () => ({
      inviteTokens: { tokenHash: {}, acceptedAt: {}, expiresAt: {}, id: {} },
    }));
    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: { handle: {}, id: {} },
      creatorMembers: {},
    }));
    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: { id: {}, email: {} },
    }));
    vi.doMock("../../src/email/send.js", () => ({
      isEmailConfigured: () => true,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("../../src/email/templates/invite.js", () => ({
      formatInviteEmail: vi.fn().mockReturnValue({ subject: "x", html: "x", text: "x" }),
    }));
    vi.doMock("../../src/services/slug.js", () => ({
      generateUniqueSlug: vi.fn().mockResolvedValue("slug"),
    }));
    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    const { acceptInvite: accept } = await import("../../src/services/invites.js");
    const result = await accept("raw-token", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVITE_EMAIL_MISMATCH");
      expect(result.error.statusCode).toBe(403);
    }
  });

  it("creates creator profile and membership for creator_owner invite", async () => {
    const now = new Date(Date.now() + 60_000);
    const invite = {
      id: "inv-1",
      type: "creator_owner",
      email: "invitee@example.com",
      payload: { displayName: "My Creator" },
      expiresAt: now,
      acceptedAt: null,
      tokenHash: "h",
      createdBy: "admin",
      createdAt: new Date(),
    };

    const mockInsertValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
    const mockUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
    const mockUpdateSet = vi.fn(() => ({ where: mockUpdateSetWhere }));
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
    const mockSelectWhere = vi.fn()
      .mockResolvedValueOnce([invite])
      .mockResolvedValueOnce([{ email: "invitee@example.com" }]);

    vi.doMock("../../src/config.js", () => ({
      config: { SMTP_HOST: "smtp.example.com", BETTER_AUTH_URL: "https://app.example.com" },
    }));
    vi.doMock("../../src/db/connection.js", () => ({
      db: {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) })),
        insert: mockInsert,
        update: mockUpdate,
      },
    }));
    vi.doMock("../../src/db/schema/invite.schema.js", () => ({
      inviteTokens: { tokenHash: {}, acceptedAt: {}, expiresAt: {}, id: {} },
    }));
    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: { handle: {}, id: {} },
      creatorMembers: {},
    }));
    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: { id: {}, email: {} },
    }));
    vi.doMock("../../src/email/send.js", () => ({
      isEmailConfigured: () => true,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("../../src/email/templates/invite.js", () => ({
      formatInviteEmail: vi.fn().mockReturnValue({ subject: "x", html: "x", text: "x" }),
    }));
    vi.doMock("../../src/services/slug.js", () => ({
      generateUniqueSlug: vi.fn().mockResolvedValue("my-creator"),
    }));
    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    const { acceptInvite: accept } = await import("../../src/services/invites.js");
    const result = await accept("raw-token", "user-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe("creator_owner");
      expect(typeof result.value.creatorId).toBe("string");
    }
    // insert called for creatorProfiles and creatorMembers and inviteTokens update
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("adds team member for team_member invite (idempotent via onConflictDoNothing)", async () => {
    const now = new Date(Date.now() + 60_000);
    const invite = {
      id: "inv-2",
      type: "team_member",
      email: "member@example.com",
      payload: { creatorId: "creator-1", role: "editor" },
      expiresAt: now,
      acceptedAt: null,
      tokenHash: "h2",
      createdBy: "owner",
      createdAt: new Date(),
    };

    const mockInsertOnConflict = vi.fn().mockResolvedValue(undefined);
    const mockInsertValues = vi.fn(() => ({ onConflictDoNothing: mockInsertOnConflict }));
    const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
    const mockUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
    const mockUpdateSet = vi.fn(() => ({ where: mockUpdateSetWhere }));
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
    const mockSelectWhere = vi.fn()
      .mockResolvedValueOnce([invite])
      .mockResolvedValueOnce([{ email: "member@example.com" }]);

    vi.doMock("../../src/config.js", () => ({
      config: { SMTP_HOST: "smtp.example.com", BETTER_AUTH_URL: "https://app.example.com" },
    }));
    vi.doMock("../../src/db/connection.js", () => ({
      db: {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) })),
        insert: mockInsert,
        update: mockUpdate,
      },
    }));
    vi.doMock("../../src/db/schema/invite.schema.js", () => ({
      inviteTokens: { tokenHash: {}, acceptedAt: {}, expiresAt: {}, id: {} },
    }));
    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: { handle: {}, id: {} },
      creatorMembers: {},
    }));
    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: { id: {}, email: {} },
    }));
    vi.doMock("../../src/email/send.js", () => ({
      isEmailConfigured: () => true,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("../../src/email/templates/invite.js", () => ({
      formatInviteEmail: vi.fn().mockReturnValue({ subject: "x", html: "x", text: "x" }),
    }));
    vi.doMock("../../src/services/slug.js", () => ({
      generateUniqueSlug: vi.fn().mockResolvedValue("slug"),
    }));
    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    const { acceptInvite: accept } = await import("../../src/services/invites.js");
    const result = await accept("raw-token", "user-2");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe("team_member");
      expect(result.value.creatorId).toBe("creator-1");
    }
    expect(mockInsert).toHaveBeenCalledOnce(); // only creatorMembers insert
    expect(mockInsertOnConflict).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled(); // invite marked as accepted
  });
});
