export class AccessDeniedError extends Error {
  readonly statusCode = 403;

  constructor(message = "You don't have access to this page") {
    super(message);
    this.name = "AccessDeniedError";
  }
}
