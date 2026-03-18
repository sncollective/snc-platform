import { describe, it, expect } from "vitest";

import { extractFieldErrors } from "../../../src/lib/form-utils.js";

const VALID_FIELDS = ["name", "email", "password"] as const;

describe("extractFieldErrors", () => {
  it("maps issues to their respective fields", () => {
    const issues = [
      { path: ["name"], message: "Name is required" },
      { path: ["email"], message: "Invalid email" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({
      name: "Name is required",
      email: "Invalid email",
    });
  });

  it("keeps only the first error per field", () => {
    const issues = [
      { path: ["email"], message: "Invalid email" },
      { path: ["email"], message: "Email too long" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({ email: "Invalid email" });
  });

  it("ignores issues for fields not in validFields", () => {
    const issues = [
      { path: ["name"], message: "Name is required" },
      { path: ["unknown"], message: "Unknown field" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({ name: "Name is required" });
  });

  it("returns an empty object for an empty issues array", () => {
    const result = extractFieldErrors([], VALID_FIELDS);

    expect(result).toEqual({});
  });

  it("ignores issues with no path", () => {
    const issues = [
      { message: "Root-level error" },
      { path: ["name"], message: "Name is required" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({ name: "Name is required" });
  });

  it("ignores issues with an empty path array", () => {
    const issues = [
      { path: [], message: "Root-level error" },
      { path: ["email"], message: "Invalid email" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({ email: "Invalid email" });
  });

  it("uses the first path segment for nested paths", () => {
    const issues = [
      { path: ["name", "first"], message: "First name is required" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({ name: "First name is required" });
  });

  it("handles issues with undefined path property", () => {
    const issues = [
      { message: "No path" },
      { path: ["password"], message: "Too short" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({ password: "Too short" });
  });

  it("works with numeric path segments that are not valid fields", () => {
    const issues = [
      { path: [0, "name"], message: "Array index path" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({});
  });

  it("handles all valid fields having errors", () => {
    const issues = [
      { path: ["name"], message: "Required" },
      { path: ["email"], message: "Invalid" },
      { path: ["password"], message: "Too short" },
    ];

    const result = extractFieldErrors(issues, VALID_FIELDS);

    expect(result).toEqual({
      name: "Required",
      email: "Invalid",
      password: "Too short",
    });
  });
});
