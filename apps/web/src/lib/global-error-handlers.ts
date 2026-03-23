import { logClientError } from "./client-logger.js";

/**
 * Install global error handlers. Call once at app startup.
 * Safe to call on server (no-ops when window is undefined).
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    logClientError({
      source: "global-error",
      error: event.message || "Unknown error",
      errorType: event.error?.name,
      url: event.filename
        ? `${event.filename}:${event.lineno}:${event.colno}`
        : window.location.href,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason ?? "Unknown rejection");
    const errorType =
      event.reason instanceof Error ? event.reason.name : undefined;

    logClientError({
      source: "unhandled-rejection",
      error,
      errorType,
      url: window.location.href,
    });
  });
}
