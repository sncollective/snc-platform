import type { PinoLogger } from "hono-pino";

import type { User, Session, Role } from "@snc/shared";

// ── Public Types ──

/**
 * Hono environment type for routes protected by auth middleware.
 * Use as the generic parameter on route handlers to get typed
 * `c.get("user")`, `c.get("session")`, and `c.get("roles")`.
 */
export type AuthEnv = {
  Variables: {
    user: User;
    session: Session;
    roles: Role[];
    logger: PinoLogger;
  };
};
