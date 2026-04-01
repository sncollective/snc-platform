import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

import { rootLogger } from "../logging/logger.js";
import { config } from "../config.js";
import { getClientIp } from "../lib/request-helpers.js";

// Warn once at startup if callback auth is disabled
if (!config.SRS_CALLBACK_SECRET) {
  rootLogger.warn(
    { event: "srs_callback_secret_missing" },
    "SRS_CALLBACK_SECRET is not set — all SRS callbacks will be accepted without authentication",
  );
}

/**
 * Verify that an SRS callback request carries the correct shared secret.
 *
 * SRS appends query params from the configured callback URL, so we pass
 * `?secret=<SRS_CALLBACK_SECRET>` in srs.conf and verify it here.
 * SRS 6 does not support custom headers on callbacks — query param is the
 * standard approach. Use `srs_log_level warn` in production to suppress
 * callback URL logging.
 *
 * When `SRS_CALLBACK_SECRET` is not configured (dev), all requests pass.
 * When configured, a missing or wrong secret returns 403.
 */
export const verifySrsCallback: MiddlewareHandler = async (c, next) => {
  const expected = config.SRS_CALLBACK_SECRET;

  // No secret configured — reject in production, skip in dev
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return c.json({ code: 1 }, 403);
    }
    await next();
    return;
  }

  const provided = c.req.query("secret");

  // timingSafeEqual requires equal-length buffers; the length check is
  // unavoidable but leaks only length (not content), which is acceptable.
  const expectedBuf = Buffer.from(expected, "utf-8");
  const providedBuf = Buffer.from(provided ?? "", "utf-8");
  const valid =
    provided != null &&
    expectedBuf.length === providedBuf.length &&
    timingSafeEqual(expectedBuf, providedBuf);

  if (!valid) {
    rootLogger.warn(
      {
        event: "srs_callback_rejected",
        path: c.req.path,
        ip: getClientIp(c),
        reason: provided ? "invalid_secret" : "missing_secret",
      },
      "SRS callback authentication failed",
    );
    return c.json({ code: 1 }, 403);
  }

  await next();
};
