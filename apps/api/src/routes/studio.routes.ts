import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import {
  StudioInquirySchema,
  StudioInquiryResponseSchema,
  STUDIO_SERVICE_LABELS,
  AppError,
} from "@snc/shared";
import type { StudioInquiry } from "@snc/shared";

import { sendEmail, isEmailConfigured } from "../email/send.js";
import { config } from "../config.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import { ERROR_400, ERROR_502 } from "./openapi-errors.js";

// ── Private Helpers ──

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatInquiryEmail = (
  inquiry: StudioInquiry,
): { subject: string; html: string; text: string } => {
  const serviceLabel = STUDIO_SERVICE_LABELS[inquiry.service];
  const subject = `Studio Inquiry: ${serviceLabel} — ${inquiry.name}`;
  const text = [
    `Name: ${inquiry.name}`,
    `Email: ${inquiry.email}`,
    `Service: ${serviceLabel}`,
    ``,
    `Message:`,
    inquiry.message,
  ].join("\n");
  const html = `<h2>Studio Inquiry</h2>
<p><strong>Name:</strong> ${escapeHtml(inquiry.name)}</p>
<p><strong>Email:</strong> <a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a></p>
<p><strong>Service:</strong> ${escapeHtml(serviceLabel)}</p>
<h3>Message</h3>
<p>${escapeHtml(inquiry.message).replace(/\n/g, "<br>")}</p>`;
  return { subject, html, text };
};

// ── Rate Limiter ──

const inquiryLimiter = rateLimiter({ windowMs: 60_000, max: 5 });

// ── Public API ──

export const studioRoutes = new Hono();

// POST /inquiry — public, no auth required
studioRoutes.post(
  "/inquiry",
  inquiryLimiter,
  describeRoute({
    description: "Submit a studio inquiry via email",
    tags: ["studio"],
    responses: {
      200: {
        description: "Inquiry sent",
        content: {
          "application/json": { schema: resolver(StudioInquiryResponseSchema) },
        },
      },
      400: ERROR_400,
      502: ERROR_502,
    },
  }),
  validator("json", StudioInquirySchema),
  async (c) => {
    const inquiry = c.req.valid("json");

    if (!isEmailConfigured()) {
      console.warn(
        "[studio] SMTP not configured — skipping email send for inquiry from",
        inquiry.email,
      );
      return c.json({ success: true as const });
    }

    const { subject, html, text } = formatInquiryEmail(inquiry);

    try {
      await sendEmail({
        to: config.STUDIO_INQUIRY_EMAIL ?? config.EMAIL_FROM,
        subject,
        html,
        text,
      });
    } catch (err) {
      throw new AppError("EMAIL_SEND_FAILED", "Failed to send inquiry email", 502);
    }

    return c.json({ success: true as const });
  },
);
