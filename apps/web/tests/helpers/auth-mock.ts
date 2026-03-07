/**
 * Shared auth mock factory for web tests.
 *
 * Eliminates ~200 lines of duplicated auth mock blocks across 13 test files.
 *
 * Usage (useSession only — most common):
 *   const { mockUseSession } = vi.hoisted(() => ({
 *     mockUseSession: vi.fn(),
 *   }));
 *   vi.mock("../../../src/lib/auth.js", () =>
 *     createAuthMock({ useSession: mockUseSession }),
 *   );
 *
 * Usage (useSession + useRoles + hasRole — nav-bar, user-menu):
 *   const { mockUseSession, mockUseRoles } = vi.hoisted(() => ({
 *     mockUseSession: vi.fn(),
 *     mockUseRoles: vi.fn(),
 *   }));
 *   vi.mock("../../../src/lib/auth.js", () =>
 *     createAuthMock({ useSession: mockUseSession, useRoles: mockUseRoles }),
 *   );
 *
 * Usage (fetchAuthState only — route guards):
 *   const { mockFetchAuthState } = vi.hoisted(() => ({
 *     mockFetchAuthState: vi.fn(),
 *   }));
 *   vi.mock("../../../src/lib/auth.js", () =>
 *     createAuthMock({ fetchAuthState: mockFetchAuthState }),
 *   );
 */

// ── Factory options ──

interface AuthMockOptions {
  /** Mock for useSession hook. */
  useSession?: unknown;
  /** Mock for useRoles hook. */
  useRoles?: unknown;
  /** Mock for fetchAuthState (used in route beforeLoad guards). */
  fetchAuthState?: unknown;
  /** Additional top-level exports to include. */
  extras?: Record<string, unknown>;
}

/**
 * Creates a mock module object for `lib/auth.js`.
 *
 * When `useRoles` is provided, `hasRole` is automatically included with
 * the standard implementation: `(roles, role) => roles.includes(role)`.
 *
 * Can be used as the factory argument to `vi.mock()`:
 * ```ts
 * vi.mock("../../../src/lib/auth.js", () => createAuthMock({ ... }));
 * ```
 */
export function createAuthMock(options: AuthMockOptions = {}): Record<string, unknown> {
  const mock: Record<string, unknown> = {};

  if (options.useSession !== undefined) {
    mock.useSession = options.useSession;
  }

  if (options.useRoles !== undefined) {
    mock.useRoles = options.useRoles;
    mock.hasRole = (roles: string[], role: string) => roles.includes(role);
  }

  if (options.fetchAuthState !== undefined) {
    mock.fetchAuthState = options.fetchAuthState;
  }

  if (options.extras) {
    Object.assign(mock, options.extras);
  }

  return mock;
}
