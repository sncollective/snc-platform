import { randomUUID } from "node:crypto";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { AppError } from "@snc/shared";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

// ── Private Helpers ──

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (transporter === null) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }
  return transporter;
};

// ── Public API ──

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Returns whether email sending is configured.
 */
export function isEmailConfigured(): boolean {
  return config.SMTP_HOST !== undefined;
}

/**
 * Sends an email via the configured SMTP transport.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!isEmailConfigured()) {
    throw new AppError("EMAIL_NOT_CONFIGURED", "Email sending is not configured", 503);
  }

  // Never send to reserved test TLDs (RFC 2606)
  const recipientDomain = opts.to.split("@")[1];
  if (recipientDomain?.endsWith(".test")) {
    rootLogger.info({ to: opts.to }, "Skipped email to reserved .test domain");
    return;
  }

  const domain = config.SMTP_USER?.split("@")[1] ?? "s-nc.org";

  await getTransporter().sendMail({
    from: config.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    messageId: `<${randomUUID()}@${domain}>`,
  });
}
