/** Client-side 403 error thrown by route guards when the user lacks required permissions. */
export class AccessDeniedError extends Error {
  readonly statusCode = 403;

  constructor(message = "You don't have access to this page") {
    super(message);
    this.name = "AccessDeniedError";
  }
}
