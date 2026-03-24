// ── Base ──

/** Base error with a machine-readable code and HTTP status for structured API responses. */
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

/** 404 error for missing resources. */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

/** 401 error for unauthenticated requests. */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
  }
}

/** 403 error for insufficient permissions. */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

/** 400 error for invalid input or failed schema validation. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

/** 409 error for duplicate resources or state conflicts. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

/** 429 error for exceeded rate limits. */
export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super("RATE_LIMIT_EXCEEDED", message, 429);
  }
}
