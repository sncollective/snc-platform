import type { Job } from "pg-boss";

import { eq } from "drizzle-orm";
import type { NotificationEventType } from "@snc/shared";

import { db } from "../../db/connection.js";
import { notificationJobs } from "../../db/schema/notification.schema.js";
import { sendEmail, isEmailConfigured } from "../../email/send.js";
import { formatGoLiveEmail } from "../../email/templates/go-live.js";
import { formatNewContentEmail } from "../../email/templates/new-content.js";
import { rootLogger } from "../../logging/logger.js";

// ── Public Types ──

export interface NotificationSendJobData {
  jobId: string;
  userId: string;
  email: string;
  name: string;
  eventType: NotificationEventType;
  payload: Record<string, unknown>;
}

// ── Private Helpers ──

const formatEmail = (
  eventType: NotificationEventType,
  payload: Record<string, unknown>,
): { subject: string; html: string; text: string } => {
  switch (eventType) {
    case "go_live":
      return formatGoLiveEmail({
        creatorName: payload.creatorName as string,
        liveUrl: payload.liveUrl as string,
      });
    case "new_content":
      return formatNewContentEmail({
        creatorName: payload.creatorName as string,
        contentTitle: payload.contentTitle as string,
        contentUrl: payload.contentUrl as string,
      });
  }
};

// ── Public API ──

/** pg-boss handler for notification/send queue. */
export const handleNotificationSend = async (
  jobs: [Job<NotificationSendJobData>],
): Promise<void> => {
  const [job] = jobs;
  const { jobId, email, eventType, payload } = job.data;

  if (!isEmailConfigured()) {
    rootLogger.warn({ jobId }, "Email not configured, skipping notification");
    await db
      .update(notificationJobs)
      .set({ status: "failed", lastError: "Email not configured" })
      .where(eq(notificationJobs.id, jobId));
    return;
  }

  try {
    const emailContent = formatEmail(eventType, payload);

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    await db
      .update(notificationJobs)
      .set({ status: "sent", sentAt: new Date(), attempts: 1 })
      .where(eq(notificationJobs.id, jobId));

    rootLogger.info({ jobId, email, eventType }, "Notification sent");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(notificationJobs)
      .set({ status: "failed", lastError: message })
      .where(eq(notificationJobs.id, jobId));

    rootLogger.error({ jobId, email, eventType, error: message }, "Notification send failed");
    throw err; // Let pg-boss retry
  }
};
