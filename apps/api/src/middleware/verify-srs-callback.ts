import type { MiddlewareHandler } from "hono";

import { rootLogger } from "../logging/logger.js";
import { config } from "../config.js";
import { getClientIp } from "../lib/request-helpers.js";

/**
 * Verify that an SRS callback request carries the correct shared secret.
 *
 * SRS appends query params from the configured callback URL, so we pass
 * `?secret=<SRS_CALLBACK_SECRET>` in srs.conf and verify it here.
 *
 * When `SRS_CALLBACK_SECRET` is not configured (dev), all requests pass.
 * When configured, a missing or wrong secret returns 403.
 */
export const verifySrsCallback: MiddlewareHandler = async (c, next) => {
  const expected = config.SRS_CALLBACK_SECRET;

  // No secret configured — skip verification (dev mode)
  if (!expected) {
    await next();
    return;
  }

  const provided = c.req.query("secret");

  if (!provided || provided !== expected) {
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
