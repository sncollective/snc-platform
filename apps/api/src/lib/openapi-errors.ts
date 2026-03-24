import { resolver } from "hono-openapi";
import { z } from "zod";

export const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const ERROR_400 = {
  description: "Validation error",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_401 = {
  description: "Unauthenticated",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_403 = {
  description: "Forbidden",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_404 = {
  description: "Not found",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_502 = {
  description: "External service error",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_503 = {
  description: "Service unavailable",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;
