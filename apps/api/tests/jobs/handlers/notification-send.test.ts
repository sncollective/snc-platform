import { describe, it, expect, vi, afterEach } from "vitest";

// ── Fixtures ──

const makeJob = (data: Record<string, unknown> = {}) => ({
  id: "pg-boss-job-1",
  name: "notification/send",
  data: {
    jobId: "notif-job-1",
    userId: "user-1",
    email: "fan@test.com",
    name: "Fan User",
    eventType: "go_live",
    payload: { creatorName: "Test Creator", liveUrl: "https://example.com/live" },
    ...data,
  },
});

// ── Module Setup ──

const setupModule = async () => {
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  const mockDb = { update: mockUpdate };

  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  const mockIsEmailConfigured = vi.fn().mockReturnValue(true);

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  vi.doMock("../../../src/config.js", () => ({ config: {} }));
  vi.doMock("../../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../../src/db/schema/notification.schema.js", () => ({
    notificationJobs: { id: {} },
  }));
  vi.doMock("../../../src/email/send.js", () => ({
    sendEmail: mockSendEmail,
    isEmailConfigured: mockIsEmailConfigured,
  }));
  vi.doMock("../../../src/email/templates/go-live.js", () => ({
    formatGoLiveEmail: vi.fn(() => ({
      subject: "Creator is live!",
      html: "<p>Live!</p>",
      text: "Creator is live!",
    })),
  }));
  vi.doMock("../../../src/email/templates/new-content.js", () => ({
    formatNewContentEmail: vi.fn(() => ({
      subject: "New content!",
      html: "<p>New!</p>",
      text: "New content!",
    })),
  }));
  vi.doMock("../../../src/logging/logger.js", () => ({
    rootLogger: mockLogger,
  }));

  const { handleNotificationSend } = await import(
    "../../../src/jobs/handlers/notification-send.js"
  );

  return {
    handleNotificationSend,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockSendEmail,
    mockIsEmailConfigured,
    mockLogger,
  };
};

// ── Tests ──

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe("handleNotificationSend", () => {
  it("sends email and marks job as sent on success", async () => {
    const { handleNotificationSend, mockSendEmail, mockUpdateSet } = await setupModule();
    const job = makeJob();

    await handleNotificationSend([job as any]);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fan@test.com" }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );
  });

  it("marks job as failed when email is not configured", async () => {
    const { handleNotificationSend, mockIsEmailConfigured, mockSendEmail, mockUpdateSet } =
      await setupModule();
    mockIsEmailConfigured.mockReturnValueOnce(false);

    await handleNotificationSend([makeJob() as any]);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", lastError: "Email not configured" }),
    );
  });

  it("marks job as failed and rethrows on send error", async () => {
    const { handleNotificationSend, mockSendEmail, mockUpdateSet } = await setupModule();
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));

    await expect(handleNotificationSend([makeJob() as any])).rejects.toThrow("SMTP error");

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", lastError: "SMTP error" }),
    );
  });

  it("handles new_content event type", async () => {
    const { handleNotificationSend, mockSendEmail, mockUpdateSet } = await setupModule();
    const job = makeJob({
      eventType: "new_content",
      payload: {
        creatorName: "Creator",
        contentTitle: "My Video",
        contentUrl: "https://example.com/video",
      },
    });

    await handleNotificationSend([job as any]);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fan@test.com" }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
    );
  });
});
