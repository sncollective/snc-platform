import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getOidcAuthorizeUrl } from "../../../src/lib/url.js";

describe("getOidcAuthorizeUrl", () => {
  const originalWindow = globalThis.window;
  let locationBackup: Location;

  beforeEach(() => {
    locationBackup = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: locationBackup,
      writable: true,
    });
  });

  function setSearch(search: string) {
    Object.defineProperty(window, "location", {
      value: { ...locationBackup, search },
      writable: true,
    });
  }

  it("returns null when no OIDC params are present", () => {
    setSearch("");
    expect(getOidcAuthorizeUrl()).toBeNull();
  });

  it("returns null when only client_id is present", () => {
    setSearch("?client_id=seafile");
    expect(getOidcAuthorizeUrl()).toBeNull();
  });

  it("returns null when only redirect_uri is present", () => {
    setSearch("?redirect_uri=http://localhost/callback");
    expect(getOidcAuthorizeUrl()).toBeNull();
  });

  it("returns authorize URL when client_id and redirect_uri are present", () => {
    setSearch("?client_id=seafile&redirect_uri=http://localhost/callback");
    const result = getOidcAuthorizeUrl();
    expect(result).toBe(
      "/api/auth/oauth2/authorize?client_id=seafile&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback",
    );
  });

  it("preserves all query params (state, scope, etc.)", () => {
    setSearch(
      "?client_id=seafile&redirect_uri=http://localhost/callback&state=abc123&scope=openid+profile",
    );
    const result = getOidcAuthorizeUrl();
    expect(result).toContain("client_id=seafile");
    expect(result).toContain("state=abc123");
    expect(result).toContain("scope=openid");
    expect(result).toMatch(/^\/api\/auth\/oauth2\/authorize\?/);
  });

  it("returns null during SSR (window undefined)", () => {
    // Temporarily remove window
    const win = globalThis.window;
    // @ts-expect-error — testing SSR condition
    delete globalThis.window;
    try {
      expect(getOidcAuthorizeUrl()).toBeNull();
    } finally {
      globalThis.window = win;
    }
  });
});
