import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useCursorPagination } from "../../../src/hooks/use-cursor-pagination.js";

// ── Helpers ──

function makeResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

// ── Tests ──

describe("useCursorPagination", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          makeResponse({ items: ["a", "b"], nextCursor: null }),
        ),
      ),
    );
  });

  it("fetches initial page on mount", async () => {
    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(["a", "b"]);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("starts in loading state", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
      }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("sets error state with structured message when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          makeResponse(
            { error: { code: "NOT_FOUND", message: "Service not found" } },
            404,
          ),
        ),
      ),
    );

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Service not found");
    expect(result.current.items).toEqual([]);
  });

  it("falls back to statusText when response body has no structured error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response("not json", {
            status: 500,
            statusText: "Internal Server Error",
          }),
        ),
      ),
    );

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Internal Server Error");
    expect(result.current.items).toEqual([]);
  });

  it("sets error state when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.items).toEqual([]);
  });

  it("clears error state when a new fetch is triggered (deps change)", async () => {
    let shouldFail = true;
    const mockFetch = vi.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(makeResponse({ items: ["a"], nextCursor: null }));
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result, rerender } = renderHook(
      ({ filter }: { filter: string }) =>
        useCursorPagination<string>({
          buildUrl: () => `http://localhost/api/items?filter=${filter}`,
          deps: [filter],
        }),
      { initialProps: { filter: "a" } },
    );

    await waitFor(() => {
      expect(result.current.error).toBe("Network error");
    });

    shouldFail = false;
    rerender({ filter: "b" });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.items).toEqual(["a"]);
    });
  });

  it("forwards fetchOptions to fetch call (merged with AbortSignal)", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(makeResponse({ items: [], nextCursor: null })),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
        fetchOptions: { credentials: "include" },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/items",
      expect.objectContaining({ credentials: "include", signal: expect.any(AbortSignal) }),
    );
  });

  it("aborts in-flight request when deps change (rapid filter changes)", async () => {
    let resolveFirst: ((v: Response) => void) | null = null;
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First fetch never resolves on its own — we control it
        return new Promise<Response>((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve(makeResponse({ items: ["fresh"], nextCursor: null }));
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result, rerender } = renderHook(
      ({ filter }: { filter: string }) =>
        useCursorPagination<string>({
          buildUrl: () => `http://localhost/api/items?filter=${filter}`,
          deps: [filter],
        }),
      { initialProps: { filter: "a" } },
    );

    // First fetch is in-flight; now change deps to trigger abort + new fetch
    rerender({ filter: "b" });

    await waitFor(() => {
      expect(result.current.items).toEqual(["fresh"]);
    });

    // Resolve the first (now-aborted) fetch — should not overwrite state
    act(() => {
      resolveFirst?.(makeResponse({ items: ["stale"], nextCursor: null }));
    });

    // Items should still be the fresh result
    expect(result.current.items).toEqual(["fresh"]);
    expect(result.current.error).toBeNull();
  });

  it("does not set error state when fetch is aborted", async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        if (opts.signal) {
          opts.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result, unmount } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
      }),
    );

    // Unmount triggers cleanup which aborts the fetch
    act(() => { unmount(); });

    // Error should never be set
    expect(result.current.error).toBeNull();
  });

  it("appends items on loadMore", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            makeResponse({ items: ["a"], nextCursor: "cursor-2" }),
          );
        }
        return Promise.resolve(
          makeResponse({ items: ["b"], nextCursor: null }),
        );
      }),
    );

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: (cursor) =>
          cursor
            ? `http://localhost/api/items?cursor=${cursor}`
            : "http://localhost/api/items",
      }),
    );

    await waitFor(() => {
      expect(result.current.items).toEqual(["a"]);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toEqual(["a", "b"]);
    });

    expect(result.current.nextCursor).toBeNull();
  });

  it("resets items and refetches when deps change", async () => {
    let type = "video";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          makeResponse({ items: [type], nextCursor: null }),
        ),
      ),
    );

    const { result, rerender } = renderHook(
      ({ t }: { t: string }) =>
        useCursorPagination<string>({
          buildUrl: () => `http://localhost/api/items?type=${t}`,
          deps: [t],
        }),
      { initialProps: { t: "video" } },
    );

    await waitFor(() => {
      expect(result.current.items).toEqual(["video"]);
    });

    type = "audio";
    rerender({ t: "audio" });

    await waitFor(() => {
      expect(result.current.items).toEqual(["audio"]);
    });
  });

  // ── initialData ──

  it("renders initial data without fetching", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: () => "http://localhost/api/items",
        initialData: { items: ["x", "y"], nextCursor: "cur-2" },
      }),
    );

    // Should not be loading and should have initial data immediately
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual(["x", "y"]);
    expect(result.current.nextCursor).toBe("cur-2");

    // Wait a tick to ensure no fetch was triggered
    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("skips first fetch with initialData but fetches on deps change", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeResponse({ items: ["fetched"], nextCursor: null }),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { result, rerender } = renderHook(
      ({ filter }: { filter: string }) =>
        useCursorPagination<string>({
          buildUrl: () => `http://localhost/api/items?filter=${filter}`,
          deps: [filter],
          initialData: { items: ["seed"], nextCursor: null },
        }),
      { initialProps: { filter: "a" } },
    );

    // Initial render uses seed data, no fetch
    expect(result.current.items).toEqual(["seed"]);
    expect(mockFetch).not.toHaveBeenCalled();

    // Changing deps triggers a client-side fetch
    rerender({ filter: "b" });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.current.items).toEqual(["fetched"]);
    });
  });

  it("loadMore works after initial seed", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeResponse({ items: ["page2"], nextCursor: null }),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() =>
      useCursorPagination<string>({
        buildUrl: (cursor) =>
          cursor
            ? `http://localhost/api/items?cursor=${cursor}`
            : "http://localhost/api/items",
        initialData: { items: ["page1"], nextCursor: "cur-2" },
      }),
    );

    // No fetch yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Load more
    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toEqual(["page1", "page2"]);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("cursor=cur-2");
  });
});
