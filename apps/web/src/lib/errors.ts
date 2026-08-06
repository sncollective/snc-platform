/** Error from an unsuccessful server-side API response, preserving its HTTP status. */
export class ApiServerError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiServerError";
  }
}

/** Structural guard that remains valid after server-function error serialization. */
export const isApiServerError = (
  error: unknown,
): error is { readonly statusCode: number } =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in error &&
  typeof error.statusCode === "number";

/** Client-side 403 error thrown by route guards when the user lacks required permissions. */
export class AccessDeniedError extends Error {
  readonly statusCode = 403;

  constructor(message = "You don't have access to this page") {
    super(message);
    this.name = "AccessDeniedError";
  }
}
