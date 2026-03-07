import { vi, beforeEach, afterEach } from "vitest";

/**
 * Sets up a shared fetch mock with proper lifecycle management.
 *
 * Call at the top level of a test file (outside `describe` blocks).
 * Returns a getter for the mock function, which is re-created each test.
 *
 * Usage:
 * ```ts
 * const { getMockFetch } = setupFetchMock();
 *
 * it("fetches data", async () => {
 *   const mockFetch = getMockFetch();
 *   mockFetch.mockResolvedValue(new Response(...));
 *   // ...
 * });
 * ```
 */
export function setupFetchMock() {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  return {
    getMockFetch: () => mockFetch,
  };
}
