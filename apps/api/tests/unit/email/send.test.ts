import { describe, it, expect, vi, afterEach } from "vitest";

// ── Tests ──

describe("email/send", () => {
  afterEach(() => {
    vi.resetModules();
  });

  const mockLogger = () => {
    vi.doMock("../../../src/logging/logger.js", () => ({
      rootLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    }));
  };

  describe("isEmailConfigured", () => {
    it("returns false when SMTP_HOST is not set", async () => {
      vi.doMock("../../../src/config.js", () => ({
        config: { SMTP_HOST: undefined, SMTP_PORT: 587 },
      }));
      mockLogger();

      const { isEmailConfigured } = await import(
        "../../../src/email/send.js"
      );
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns true when SMTP_HOST is set", async () => {
      vi.doMock("../../../src/config.js", () => ({
        config: {
          SMTP_HOST: "smtp.example.com",
          SMTP_PORT: 587,
          EMAIL_FROM: "test@example.com",
        },
      }));
      mockLogger();

      const { isEmailConfigured } = await import(
        "../../../src/email/send.js"
      );
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("sendEmail", () => {
    it("throws when email is not configured", async () => {
      vi.doMock("../../../src/config.js", () => ({
        config: { SMTP_HOST: undefined, SMTP_PORT: 587 },
      }));
      mockLogger();

      const { sendEmail } = await import("../../../src/email/send.js");

      await expect(
        sendEmail({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Test</p>",
        }),
      ).rejects.toThrow("Email sending is not configured");
    });

    it("skips sending to reserved .test domains", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "abc" });

      vi.doMock("nodemailer", () => ({
        default: {
          createTransport: () => ({ sendMail: mockSendMail }),
        },
      }));

      vi.doMock("../../../src/config.js", () => ({
        config: {
          SMTP_HOST: "smtp.example.com",
          SMTP_PORT: 587,
          SMTP_USER: "user",
          SMTP_PASS: "pass",
          EMAIL_FROM: "S/NC <noreply@s-nc.org>",
        },
      }));
      mockLogger();

      const { sendEmail } = await import("../../../src/email/send.js");

      await sendEmail({
        to: "e2e-register-123@snc.test",
        subject: "Verify your S/NC email",
        html: "<p>Click here</p>",
      });

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("sends mail via nodemailer when configured", async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "abc" });

      vi.doMock("nodemailer", () => ({
        default: {
          createTransport: () => ({ sendMail: mockSendMail }),
        },
      }));

      vi.doMock("../../../src/config.js", () => ({
        config: {
          SMTP_HOST: "smtp.example.com",
          SMTP_PORT: 587,
          SMTP_USER: "user",
          SMTP_PASS: "pass",
          EMAIL_FROM: "S/NC <noreply@s-nc.org>",
        },
      }));
      mockLogger();

      const { sendEmail } = await import("../../../src/email/send.js");

      await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: "S/NC <noreply@s-nc.org>",
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
        text: "Hello",
        messageId: expect.stringMatching(/^<[0-9a-f-]+@s-nc\.org>$/),
      });
    });
  });
});
