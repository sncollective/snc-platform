import { describe, it, expect } from "vitest";

import { buildLoginRedirect, getValidReturnTo } from "../../../src/lib/return-to.js";

describe("buildLoginRedirect", () => {
  it("includes returnTo for non-trivial paths", () => {
    expect(buildLoginRedirect("/dashboard")).toEqual({
      to: "/login",
      search: { returnTo: "/dashboard" },
    });
  });

  it("includes returnTo for nested paths", () => {
    expect(buildLoginRedirect("/settings/subscriptions")).toEqual({
      to: "/login",
      search: { returnTo: "/settings/subscriptions" },
    });
  });

  it("skips returnTo for /", () => {
    expect(buildLoginRedirect("/")).toEqual({ to: "/login" });
  });

  it("skips returnTo for /login", () => {
    expect(buildLoginRedirect("/login")).toEqual({ to: "/login" });
  });

  it("skips returnTo for /register", () => {
    expect(buildLoginRedirect("/register")).toEqual({ to: "/login" });
  });
});

describe("getValidReturnTo", () => {
  it("returns the path for a valid relative path", () => {
    expect(getValidReturnTo("/dashboard")).toBe("/dashboard");
  });

  it("returns /feed for undefined", () => {
    expect(getValidReturnTo(undefined)).toBe("/feed");
  });

  it("returns /feed for empty string", () => {
    expect(getValidReturnTo("")).toBe("/feed");
  });

  it("returns /feed for non-string values", () => {
    expect(getValidReturnTo(42)).toBe("/feed");
    expect(getValidReturnTo(null)).toBe("/feed");
  });

  it("rejects protocol-relative URLs (open redirect)", () => {
    expect(getValidReturnTo("//evil.com")).toBe("/feed");
  });

  it("rejects absolute URLs with protocol", () => {
    expect(getValidReturnTo("https://evil.com")).toBe("/feed");
  });

  it("rejects paths containing ://", () => {
    expect(getValidReturnTo("/foo://bar")).toBe("/feed");
  });

  it("rejects paths not starting with /", () => {
    expect(getValidReturnTo("dashboard")).toBe("/feed");
  });

  it("allows paths with query params", () => {
    expect(getValidReturnTo("/search?q=test")).toBe("/search?q=test");
  });

  it("allows paths with hash fragments", () => {
    expect(getValidReturnTo("/page#section")).toBe("/page#section");
  });
});
