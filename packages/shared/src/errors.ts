// ── Base ──

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ── Subclasses ──

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super("RATE_LIMIT_EXCEEDED", message, 429);
  }
}
