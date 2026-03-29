import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock DB Chains ──

const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

const mockDb = { insert: mockInsert };

// ── Setup ──

const setupSeedOidcClients = async (
  seafileClientId: string | undefined,
  seafileClientSecret: string | undefined,
) => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));

  vi.doMock("../../src/db/schema/oidc.schema.js", () => ({
    oauthApplications: {
      clientId: {},
    },
  }));

  vi.doMock("../../src/config.js", () => ({
    config: {
      SEAFILE_OIDC_CLIENT_ID: seafileClientId,
      SEAFILE_OIDC_CLIENT_SECRET: seafileClientSecret,
    },
  }));

  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));

  return await import("../../src/auth/seed-oidc-clients.js");
};

// ── Tests ──

describe("seedOidcClients", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("returns early without DB access when SEAFILE_OIDC_CLIENT_ID is not configured", async () => {
    const { seedOidcClients } = await setupSeedOidcClients(undefined, undefined);
    await seedOidcClients();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns early without DB access when SEAFILE_OIDC_CLIENT_SECRET is not configured", async () => {
    const { seedOidcClients } = await setupSeedOidcClients(
      "seafile-client-id",
      undefined,
    );
    await seedOidcClients();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts or upserts the Seafile OIDC client when both credentials are configured", async () => {
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockResolvedValue(undefined);

    const { seedOidcClients } = await setupSeedOidcClients(
      "seafile-client-id",
      "seafile-client-secret",
    );

    await seedOidcClients();

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "seafile-client-id",
        clientSecret: "seafile-client-secret",
        name: "Seafile",
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          clientSecret: "seafile-client-secret",
        }),
      }),
    );
  });
});
