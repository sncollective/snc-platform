import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import {
  StudioInquirySchema,
  StudioInquiryResponseSchema,
  AppError,
} from "@snc/shared";

import { sendEmail, isEmailConfigured } from "../email/send.js";
import { formatInquiryEmail } from "../email/templates.js";
import { config } from "../config.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import { rootLogger } from "../logging/logger.js";
import type { LoggingEnv } from "../middleware/logging-env.js";
import { ERROR_400, ERROR_502 } from "../lib/openapi-errors.js";

// ── Rate Limiter ──

const inquiryLimiter = rateLimiter({ windowMs: 60_000, max: 5 });

// ── Public API ──

export const studioRoutes = new Hono<LoggingEnv>();

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
      (c.var?.logger ?? rootLogger).warn("SMTP not configured — skipping email send for studio inquiry");
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
      (c.var?.logger ?? rootLogger).error({ err }, "Failed to send studio inquiry email");
      throw new AppError("EMAIL_SEND_FAILED", "Failed to send inquiry email", 502);
    }

    return c.json({ success: true as const });
  },
);
