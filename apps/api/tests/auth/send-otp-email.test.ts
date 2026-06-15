import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted Mocks ──

const { mockSendEmail, mockLogError } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
  mockLogError: vi.fn(),
}));

vi.mock("../../src/email/send.js", () => ({
  sendEmail: mockSendEmail,
  isEmailConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("../../src/logging/logger.js", () => ({
  rootLogger: { info: vi.fn(), warn: vi.fn(), error: mockLogError, debug: vi.fn() },
}));

// db connection is constructed at auth.ts module load — stub it so import is cheap.
vi.mock("../../src/db/connection.js", () => ({ db: {} }));

const { sendOtpEmail } = await import("../../src/auth/auth.js");

describe("sendOtpEmail", () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue(undefined);
    mockLogError.mockClear();
  });

  it("sends a sign-in code email", async () => {
    await sendOtpEmail("viewer@example.com", "123456", "sign-in");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0]![0];
    expect(payload.to).toBe("viewer@example.com");
    expect(payload.subject).toBe("Your S/NC sign-in code");
    expect(payload.html).toContain("123456");
    expect(payload.text).toContain("123456");
  });

  it("sends a password-reset code email (unchanged)", async () => {
    await sendOtpEmail("user@example.com", "654321", "forget-password");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0]![0].subject).toBe("Your S/NC password reset code");
    expect(mockSendEmail.mock.calls[0]![0].html).toContain("654321");
  });

  it("is a no-op for a type without configured copy", async () => {
    await sendOtpEmail("user@example.com", "111111", "email-verification");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("logs and swallows a send failure (auth must not break on mail outage)", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("smtp down"));
    await expect(
      sendOtpEmail("user@example.com", "123456", "sign-in"),
    ).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });
});
