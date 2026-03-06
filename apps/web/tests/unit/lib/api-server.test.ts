import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetRequestHeader = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: mockGetRequestHeader,
}));

// createServerFn is a chained builder — we need to extract the handler
// so we can call it directly in tests.
let capturedHandler: (ctx: { data: string }) => Promise<unknown>;

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: typeof capturedHandler) => {
        capturedHandler = fn;
        return fn;
      },
    }),
  }),
}));

// Must import after mocks are set up
const { fetchApiServer: _ } = await import("../../../src/lib/api-server.js");

describe("fetchApiServer", () => {
  const originalProcess = (globalThis as Record<string, unknown>).process;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    (globalThis as Record<string, unknown>).process = {
      env: { API_INTERNAL_URL: "http://api:3000" },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).process = originalProcess;
  });

  it("forwards cookie header from incoming request", async () => {
    mockGetRequestHeader.mockReturnValue("better-auth.session_token=abc123");
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await capturedHandler({ data: "/api/content/1" });

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

    await capturedHandler({ data: "/api/content/1" });

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

    await capturedHandler({ data: "/api/content/1" });

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
      capturedHandler({ data: "/api/content/missing" }),
    ).rejects.toThrow("Not Found");
  });
});
