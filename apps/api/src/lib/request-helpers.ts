import type { Context } from "hono";

/** Extract the originating client IP, preferring X-Forwarded-For over X-Real-IP. */
export const getClientIp = (c: Context): string | null =>
  c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
  c.req.header("x-real-ip") ??
  null;
