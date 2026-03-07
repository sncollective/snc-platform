/**
 * Shared format mock factory for web tests.
 *
 * Eliminates ~130 lines of duplicated format mock blocks across 13 test files.
 *
 * Two modes are supported:
 *
 * 1. **Full mock** — replaces the entire module (when you only need specific fns):
 *    ```ts
 *    const { mockFormatRelativeDate } = vi.hoisted(() => ({
 *      mockFormatRelativeDate: vi.fn(),
 *    }));
 *    vi.mock("../../../src/lib/format.js", () =>
 *      createFormatMock({ formatRelativeDate: mockFormatRelativeDate }),
 *    );
 *    ```
 *
 * 2. **Partial mock** — preserves real implementations via importOriginal:
 *    ```ts
 *    const { mockFormatDate } = vi.hoisted(() => ({
 *      mockFormatDate: vi.fn(),
 *    }));
 *    vi.mock("../../../src/lib/format.js", async (importOriginal) => {
 *      const actual = await importOriginal<typeof import("../../src/lib/format.js")>();
 *      return createFormatMock({ formatDate: mockFormatDate }, actual);
 *    });
 *    ```
 *
 * Default implementations are provided for common format functions so tests
 * produce readable output even without per-test `.mockReturnValue()` calls.
 */

// ── Default implementations ──

/** Default formatDate: prefixes with "FORMATTED:" for easy assertion. */
export const DEFAULT_FORMAT_DATE = (s: string): string => `FORMATTED:${s}`;

/** Default formatPrice: renders cents as "$X.XX". */
export const DEFAULT_FORMAT_PRICE = (cents: number): string =>
  `$${(cents / 100).toFixed(2)}`;

/** Default formatRelativeDate: returns a stable string for snapshot-friendly output. */
export const DEFAULT_FORMAT_RELATIVE_DATE = (): string => "2h ago";

/** Default formatCo2: renders kg with unit. */
export const DEFAULT_FORMAT_CO2 = (kg: number): string => {
  if (kg === 0) return "0 g";
  if (Math.abs(kg) < 1) return `${(kg * 1000).toFixed(1)} g`;
  return `${kg.toFixed(1)} kg`;
};

// ── Factory options ──

interface FormatMockOptions {
  /** Mock or implementation for formatRelativeDate. */
  formatRelativeDate?: unknown;
  /** Mock or implementation for formatDate. */
  formatDate?: unknown;
  /** Mock or implementation for formatPrice. */
  formatPrice?: unknown;
  /** Mock or implementation for formatTime. */
  formatTime?: unknown;
  /** Mock or implementation for formatInterval. */
  formatInterval?: unknown;
  /** Mock or implementation for formatIntervalShort. */
  formatIntervalShort?: unknown;
  /** Mock or implementation for formatCo2. */
  formatCo2?: unknown;
}

/**
 * Creates a mock module object for `lib/format.js`.
 *
 * When `base` is provided (from `importOriginal`), it spreads the real module
 * first, then applies overrides — following the `vi-import-original-partial-mock`
 * pattern. Without `base`, only the specified overrides are returned.
 *
 * @param overrides - Format functions to include/override
 * @param base - Optional real module (from importOriginal) to spread as base
 */
export function createFormatMock(
  overrides: FormatMockOptions = {},
  base?: Record<string, unknown>,
): Record<string, unknown> {
  const mock: Record<string, unknown> = base ? { ...base } : {};

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      mock[key] = value;
    }
  }

  return mock;
}
