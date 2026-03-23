// ── Types ──

interface ErrorContext {
  /** Where the error originated */
  source: "error-boundary" | "global-error" | "unhandled-rejection";
  /** Component or location name */
  location?: string;
  /** Error message */
  error: string;
  /** Error name/type */
  errorType?: string;
  /** URL where the error occurred */
  url?: string;
}

// ── Public API ──

/**
 * Log a client-side error with structured context.
 * Console-only for now — swap implementation when log aggregation lands.
 */
export function logClientError(ctx: ErrorContext): void {
  console.error("[client-error]", JSON.stringify(ctx));
}
