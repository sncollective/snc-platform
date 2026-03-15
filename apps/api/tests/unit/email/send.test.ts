import { describe, it, expect, vi, afterEach } from "vitest";

// ── Tests ──

describe("email/send", () => {
  afterEach(() => {
    vi.resetModules();
  });

  describe("isEmailConfigured", () => {
    it("returns false when SMTP_HOST is not set", async () => {
      vi.doMock("../../../src/config.js", () => ({
        config: { SMTP_HOST: undefined, SMTP_PORT: 587 },
      }));

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

      const { sendEmail } = await import("../../../src/email/send.js");

      await expect(
        sendEmail({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Test</p>",
        }),
      ).rejects.toThrow("Email sending is not configured");
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
