import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetRequestHeader = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: mockGetRequestHeader,
}));

// createServerFn is a chained builder. fetchApiServer uses
// createServerFn().inputValidator().handler(fn), while fetchAuthStateServer
// uses createServerFn().handler(fn). We distinguish them structurally:
// the one that calls inputValidator before handler is fetchApiServer.
const capturedHandlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const obj = {
      inputValidator: () => ({
        handler: (fn: (...args: unknown[]) => Promise<unknown>) => {
          capturedHandlers.fetchApiServer = fn;
          return fn;
        },
      }),
      handler: (fn: (...args: unknown[]) => Promise<unknown>) => {
        capturedHandlers.fetchAuthStateServer = fn;
        return fn;
      },
    };
    return obj;
  },
}));

// Must import after mocks are set up
const { fetchApiServer: _, fetchAuthStateServer: __ } = await import(
  "../../../src/lib/api-server.js"
);

describe("fetchApiServer", () => {
  const originalProcess = (globalThis as Record<string, unknown>).process;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    (globalThis as Record<string, unknown>).process = {
      env: { API_INTERNAL_URL: "http://api:3000" },
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).process = originalProcess;
  });

  it("forwards cookie header from incoming request", async () => {
    mockGetRequestHeader.mockReturnValue("better-auth.session_token=abc123");
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await capturedHandlers.fetchApiServer!({ data: "/api/content/1" });

    expect(mockFetch).toHaveBeenCalledWith("http://api:3000/api/content/1", {
      headers: { cookie: "better-auth.session_token=abc123" },
    });
  });

  it("sends empty headers when no cookie is present", async () => {
    mockGetRequestHeader.mockReturnValue(undefined);
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await capturedHandlers.fetchApiServer!({ data: "/api/content/1" });

    expect(mockFetch).toHaveBeenCalledWith("http://api:3000/api/content/1", {
      headers: {},
    });
  });

  it("sends empty headers when getRequestHeader throws", async () => {
    mockGetRequestHeader.mockImplementation(() => {
      throw new Error("No request context");
    });
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await capturedHandlers.fetchApiServer!({ data: "/api/content/1" });

    expect(mockFetch).toHaveBeenCalledWith("http://api:3000/api/content/1", {
      headers: {},
    });
  });

  it("throws on non-ok response with error message", async () => {
    mockGetRequestHeader.mockReturnValue(undefined);
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Not Found" } }),
        { status: 404, statusText: "Not Found" },
      ),
    );

    await expect(
      capturedHandlers.fetchApiServer!({ data: "/api/content/missing" }),
    ).rejects.toThrow("Not Found");
  });
});

describe("fetchAuthStateServer", () => {
  const originalProcess = (globalThis as Record<string, unknown>).process;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    (globalThis as Record<string, unknown>).process = {
      env: { API_INTERNAL_URL: "http://api:3000" },
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).process = originalProcess;
  });

  it("forwards cookie to /api/me", async () => {
    mockGetRequestHeader.mockReturnValue("better-auth.session_token=abc123");
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ user: { id: "u1" }, roles: ["stakeholder"] }),
        { status: 200 },
      ),
    );

    await capturedHandlers.fetchAuthStateServer!();

    expect(mockFetch).toHaveBeenCalledWith("http://api:3000/api/me", {
      headers: { cookie: "better-auth.session_token=abc123" },
    });
  });

  it("returns user and roles on success", async () => {
    mockGetRequestHeader.mockReturnValue("session=xyz");
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ user: { id: "u1" }, roles: ["stakeholder"] }),
        { status: 200 },
      ),
    );

    const result = await capturedHandlers.fetchAuthStateServer!();

    expect(result).toEqual({ user: { id: "u1" }, roles: ["stakeholder"] });
  });

  it("returns { user: null, roles: [] } on non-OK response", async () => {
    mockGetRequestHeader.mockReturnValue(undefined);
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const result = await capturedHandlers.fetchAuthStateServer!();

    expect(result).toEqual({ user: null, roles: [] });
  });

  it("returns { user: null, roles: [] } on fetch error", async () => {
    mockGetRequestHeader.mockReturnValue(undefined);
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await capturedHandlers.fetchAuthStateServer!();

    expect(result).toEqual({ user: null, roles: [] });
  });

  it("returns { user: null, roles: [] } when getRequestHeader throws", async () => {
    mockGetRequestHeader.mockImplementation(() => {
      throw new Error("No request context");
    });
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ user: { id: "u1" }, roles: [] }),
        { status: 200 },
      ),
    );

    const result = await capturedHandlers.fetchAuthStateServer!();

    // Still succeeds — getRequestHeader error is caught, fetch proceeds without cookie
    expect(result).toEqual({ user: { id: "u1" }, roles: [] });
  });
});
