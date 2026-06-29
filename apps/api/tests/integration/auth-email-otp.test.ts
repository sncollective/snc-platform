import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { TEST_CONFIG } from "../helpers/test-constants.js";

// ── Captured Auth Config ──

type EmailOtpOptions = {
  disableSignUp?: boolean;
  sendVerificationOTP: (args: {
    email: string;
    otp: string;
    type: "forget-password" | "sign-in" | "email-verification" | "change-email";
  }) => Promise<void>;
};

const mockSendEmail = vi.fn();
const mockLogError = vi.fn();
const mockBetterAuth = vi.fn((options: unknown) => ({ options }));
const mockEmailOTP = vi.fn((options: EmailOtpOptions) => ({ id: "email-otp", options }));

const setupAuthModule = async () => {
  vi.doMock("better-auth", () => ({ betterAuth: mockBetterAuth }));
  vi.doMock("better-auth/adapters/drizzle", () => ({
    drizzleAdapter: vi.fn(() => ({ adapter: "drizzle" })),
  }));
  vi.doMock("better-auth/plugins/jwt", () => ({
    jwt: vi.fn(() => ({ id: "jwt" })),
  }));
  vi.doMock("better-auth/plugins/oidc-provider", () => ({
    oidcProvider: vi.fn(() => ({ id: "oidc" })),
  }));
  vi.doMock("better-auth/plugins/email-otp", () => ({
    emailOTP: mockEmailOTP,
  }));
  vi.doMock("../../src/db/connection.js", () => ({ db: {} }));
  vi.doMock("../../src/config.js", () => ({
    config: TEST_CONFIG,
    parseOrigins: (raw: string) =>
      raw
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
  }));
  vi.doMock("../../src/email/send.js", () => ({
    sendEmail: mockSendEmail,
    isEmailConfigured: vi.fn().mockReturnValue(true),
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: { info: vi.fn(), warn: vi.fn(), error: mockLogError, debug: vi.fn() },
  }));
  vi.doMock("../../src/auth/user-roles.js", () => ({
    getUserRoles: vi.fn().mockResolvedValue([]),
  }));

  return await import("../../src/auth/auth.js");
};

const getCapturedEmailOtpOptions = (): EmailOtpOptions => {
  const options = mockEmailOTP.mock.calls[0]?.[0];
  if (!options) throw new Error("emailOTP plugin was not configured");
  return options;
};

beforeEach(() => {
  vi.resetAllMocks();
  mockSendEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetModules();
});

// ── Tests ──

describe("email OTP auth configuration", () => {
  it("allows OTP sign-in to create an account for a new email", async () => {
    await setupAuthModule();

    const emailOtpOptions = getCapturedEmailOtpOptions();

    expect(emailOtpOptions.disableSignUp).toBe(false);
  });

  it("keeps email OTP sign-in on the verified-email auth path", async () => {
    await setupAuthModule();

    const authOptions = mockBetterAuth.mock.calls[0]![0] as {
      emailVerification: { requireEmailVerification: boolean };
    };
    const emailOtpOptions = getCapturedEmailOtpOptions();

    expect(authOptions.emailVerification.requireEmailVerification).toBe(false);
    await emailOtpOptions.sendVerificationOTP({
      email: "new-listener@example.com",
      otp: "123456",
      type: "sign-in",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new-listener@example.com",
        subject: expect.stringContaining("sign-in"),
        html: expect.stringContaining("sign-in code"),
        text: expect.stringContaining("sign-in code"),
      }),
    );
  });
});
