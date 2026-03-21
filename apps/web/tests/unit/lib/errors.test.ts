import { describe, it, expect } from "vitest";

import { AccessDeniedError } from "../../../src/lib/errors.js";

describe("AccessDeniedError", () => {
  it("has statusCode 403", () => {
    const error = new AccessDeniedError();
    expect(error.statusCode).toBe(403);
  });

  it("has the correct name", () => {
    const error = new AccessDeniedError();
    expect(error.name).toBe("AccessDeniedError");
  });

  it("has a default message", () => {
    const error = new AccessDeniedError();
    expect(error.message).toBe("You don't have access to this page");
  });

  it("accepts a custom message", () => {
    const error = new AccessDeniedError("Custom message");
    expect(error.message).toBe("Custom message");
  });

  it("is an instance of Error", () => {
    const error = new AccessDeniedError();
    expect(error).toBeInstanceOf(Error);
  });
});
