import type { Mock } from "vitest";

// ── Types ──

/**
 * A Promise that also has additional chainable methods — used to mock Drizzle
 * query builders where a node is both awaitable (terminal) AND has further
 * chain methods (e.g., `.from()` returns a result but also has `.where()`).
 *
 * Replaces `(promise as any).method = mockFn` with a properly typed construct.
 */
type ChainablePromise<T, Methods extends Record<string, Mock>> = Promise<T> &
  Methods;

// ── Public API ──

/**
 * Create a Promise that resolves to `value` and also exposes additional
 * properties (typically mock functions for the next link in a Drizzle chain).
 *
 * Usage:
 * ```ts
 * const mockSelectWhere = vi.fn();
 * mockSelectFrom.mockImplementation(() =>
 *   chainablePromise([{ count: 0 }], { where: mockSelectWhere })
 * );
 * ```
 *
 * This replaces the unsafe pattern:
 * ```ts
 * const result = Promise.resolve([{ count: 0 }]);
 * (result as any).where = mockSelectWhere;  // <-- eliminated
 * return result;
 * ```
 */
export function chainablePromise<T, M extends Record<string, Mock>>(
  value: T,
  methods: M,
): ChainablePromise<T, M> {
  const promise = Promise.resolve(value) as ChainablePromise<T, M>;
  for (const [key, fn] of Object.entries(methods)) {
    (promise as Record<string, unknown>)[key] = fn;
  }
  return promise;
}
