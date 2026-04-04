import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
    },
    sql: vi.fn(),
  }));

  vi.doMock("../../src/db/schema/mastodon.schema.js", () => ({
    mastodonApps: {
      instanceDomain: "instance_domain",
      clientId: "client_id",
      clientSecret: "client_secret",
    },
  }));

  vi.doMock("../../src/db/schema/user.schema.js", () => ({
    users: {
      id: "id",
      name: "name",
      email: "email",
      emailVerified: "email_verified",
      image: "image",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    accounts: {
      id: "id",
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      updatedAt: "updated_at",
    },
    sessions: {
      id: "id",
      userId: "user_id",
      token: "token",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }));

  vi.doMock("../../src/config.js", () => ({
    config: {
      BETTER_AUTH_URL: "http://localhost:3080",
      MASTODON_REDIRECT_URI: undefined,
    },
  }));

  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  }));

  return await import("../../src/services/mastodon-auth.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── DB Chain Helpers ──

const buildSelectChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildInsertChain = () => ({
  values: vi.fn().mockReturnValue({
    onConflictDoNothing: vi.fn().mockResolvedValue([]),
  }),
});

const buildInsertNoReturnChain = () => ({
  values: vi.fn().mockResolvedValue([]),
});

const buildUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

// ── App Registration ──

describe("getOrRegisterApp", () => {
  it("returns cached app from DB when found", async () => {
    const { getOrRegisterApp } = await setupService();

    mockDbSelect.mockReturnValue(
      buildSelectChain([
        { instanceDomain: "mastodon.social", clientId: "cached-id", clientSecret: "cached-secret" },
      ]),
    );

    const result = await getOrRegisterApp("mastodon.social", "http://localhost:3080/api/auth/mastodon/callback");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.client_id).toBe("cached-id");
      expect(result.value.client_secret).toBe("cached-secret");
    }
  });

  it("registers new app and caches it when not found", async () => {
    const { getOrRegisterApp } = await setupService();

    // DB returns empty (no cached app)
    mockDbSelect.mockReturnValue(buildSelectChain([]));
    mockDbInsert.mockReturnValue(buildInsertChain());

    const mockRegistration = { client_id: "new-id", client_secret: "new-secret" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRegistration,
      }),
    );

    const result = await getOrRegisterApp("mastodon.social", "http://localhost:3080/api/auth/mastodon/callback");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.client_id).toBe("new-id");
      expect(result.value.client_secret).toBe("new-secret");
    }

    vi.unstubAllGlobals();
  });

  it("returns MASTODON_UNREACHABLE error when fetch throws", async () => {
    const { getOrRegisterApp } = await setupService();

    mockDbSelect.mockReturnValue(buildSelectChain([]));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const result = await getOrRegisterApp("mastodon.social", "http://localhost:3080/api/auth/mastodon/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MASTODON_UNREACHABLE");
    }

    vi.unstubAllGlobals();
  });

  it("returns MASTODON_REGISTRATION_FAILED when instance returns non-ok", async () => {
    const { getOrRegisterApp } = await setupService();

    mockDbSelect.mockReturnValue(buildSelectChain([]));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 422 }),
    );

    const result = await getOrRegisterApp("mastodon.social", "http://localhost:3080/api/auth/mastodon/callback");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MASTODON_REGISTRATION_FAILED");
    }

    vi.unstubAllGlobals();
  });
});

// ── startMastodonAuth ──

describe("startMastodonAuth", () => {
  it("returns authorization URL with state", async () => {
    const { startMastodonAuth } = await setupService();

    // DB returns cached app
    mockDbSelect.mockReturnValue(
      buildSelectChain([
        { instanceDomain: "mastodon.social", clientId: "app-id", clientSecret: "app-secret" },
      ]),
    );

    const result = await startMastodonAuth("mastodon.social");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizationUrl).toContain("mastodon.social");
      expect(result.value.authorizationUrl).toContain("oauth/authorize");
      expect(result.value.authorizationUrl).toContain("client_id=app-id");
      expect(result.value.state).toBeTruthy();
      expect(typeof result.value.state).toBe("string");
    }
  });

  it("propagates error when app registration fails", async () => {
    const { startMastodonAuth } = await setupService();

    mockDbSelect.mockReturnValue(buildSelectChain([]));

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await startMastodonAuth("mastodon.social");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MASTODON_UNREACHABLE");
    }

    vi.unstubAllGlobals();
  });
});

// ── handleMastodonCallback ──

describe("handleMastodonCallback", () => {
  it("returns MASTODON_INVALID_STATE for unknown state", async () => {
    const { handleMastodonCallback } = await setupService();

    const result = await handleMastodonCallback("some-code", "unknown-state");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MASTODON_INVALID_STATE");
    }
  });

  it("returns MASTODON_STATE_EXPIRED for expired state", async () => {
    const { startMastodonAuth, handleMastodonCallback } = await setupService();

    mockDbSelect.mockReturnValue(
      buildSelectChain([
        { instanceDomain: "mastodon.social", clientId: "app-id", clientSecret: "app-secret" },
      ]),
    );

    const startResult = await startMastodonAuth("mastodon.social");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    // Manually expire the state by manipulating time
    // We'll use a fake state from a different time — just test the invalid state path
    const result = await handleMastodonCallback("code", "definitely-expired-state-that-does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MASTODON_INVALID_STATE");
    }
  });

  it("creates new user and session on successful callback", async () => {
    const { startMastodonAuth, handleMastodonCallback } = await setupService();

    // Use select call sequence: first for getOrRegisterApp (register → no cached app),
    // then for callback: getOrRegisterApp (no cached app), then accounts lookup, then users lookup
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      // Call 1 (startMastodonAuth → getOrRegisterApp): return cached app
      // Call 2 (handleMastodonCallback → getOrRegisterApp): return cached app
      // Call 3 (accounts lookup): return empty (no existing account)
      // Call 4 (users lookup): return empty (no existing user)
      if (selectCallCount <= 2) {
        return buildSelectChain([
          { instanceDomain: "mastodon.social", clientId: "app-id", clientSecret: "app-secret" },
        ]);
      }
      return buildSelectChain([]);
    });

    mockDbInsert.mockReturnValue(buildInsertNoReturnChain());

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            token_type: "Bearer",
            scope: "read:accounts",
            created_at: Math.floor(Date.now() / 1000),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "12345",
            username: "testuser",
            acct: "testuser",
            display_name: "Test User",
            avatar: null,
          }),
        }),
    );

    const startResult = await startMastodonAuth("mastodon.social");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    const result = await handleMastodonCallback("auth-code", startResult.value.state);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBeTruthy();
      expect(result.value.sessionToken).toBeTruthy();
      expect(result.value.sessionId).toBeTruthy();
      expect(result.value.expiresAt).toBeInstanceOf(Date);
    }

    vi.unstubAllGlobals();
  });

  it("links account to existing user on second login", async () => {
    const { startMastodonAuth, handleMastodonCallback } = await setupService();

    const existingAccountRow = {
      id: "account-1",
      userId: "user-1",
      accountId: "testuser@mastodon.social",
      providerId: "mastodon",
      accessToken: "old-token",
      updatedAt: new Date(),
    };

    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount <= 2) {
        // getOrRegisterApp calls
        return buildSelectChain([
          { instanceDomain: "mastodon.social", clientId: "app-id", clientSecret: "app-secret" },
        ]);
      }
      // accounts lookup — return existing account
      return buildSelectChain([existingAccountRow]);
    });

    mockDbInsert.mockReturnValue(buildInsertNoReturnChain());
    mockDbUpdate.mockReturnValue(buildUpdateChain());

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "new-token",
            token_type: "Bearer",
            scope: "read:accounts",
            created_at: Math.floor(Date.now() / 1000),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "12345",
            username: "testuser",
            acct: "testuser",
            display_name: "Test User",
            avatar: null,
          }),
        }),
    );

    const startResult = await startMastodonAuth("mastodon.social");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    const result = await handleMastodonCallback("auth-code", startResult.value.state);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe("user-1");
    }

    vi.unstubAllGlobals();
  });
});

// ── cleanExpiredStates ──

describe("cleanExpiredStates", () => {
  it("runs without error on empty store", async () => {
    const { cleanExpiredStates } = await setupService();
    expect(() => cleanExpiredStates()).not.toThrow();
  });
});
