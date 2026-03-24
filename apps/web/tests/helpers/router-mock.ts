/**
 * Shared TanStack Router mock factory for web tests.
 *
 * Eliminates ~620 lines of duplicated vi.mock("@tanstack/react-router", ...)
 * blocks across 31 test files.
 *
 * Usage (minimal — Link only):
 *   vi.mock("@tanstack/react-router", () => createRouterMock());
 *
 * Usage (with hoisted fns):
 *   const { mockNavigate, mockUseLoaderData } = vi.hoisted(() => ({
 *     mockNavigate: vi.fn(),
 *     mockUseLoaderData: vi.fn(),
 *   }));
 *   vi.mock("@tanstack/react-router", () =>
 *     createRouterMock({ useNavigate: () => mockNavigate, useLoaderData: mockUseLoaderData }),
 *   );
 *
 * Usage (root route):
 *   vi.mock("@tanstack/react-router", () =>
 *     createRouterMock({ rootRoute: true, outlet: true }),
 *   );
 */

import { createElement, type ReactNode, type MouseEventHandler } from "react";

// ── Link stub ──
// Renders as <a> so getByRole("link") works in tests.
// Supports params via regex replacement and search via URLSearchParams.

interface LinkProps {
  to?: string;
  params?: Record<string, string> | null;
  search?: Record<string, string> | null;
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler;
  role?: string;
  [key: string]: unknown;
}

export const StubLink = ({
  to,
  params,
  search,
  children,
  className,
  onClick,
  role,
  ...rest
}: LinkProps) => {
  let href = (to as string) ?? "";
  if (typeof params === "object" && params !== null) {
    href = href.replace(
      /\$(\w+)/g,
      (_, key: string) => (params as Record<string, string>)[key] ?? "",
    );
  }
  if (typeof search === "object" && search !== null) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      searchParams.set(key, value);
    }
    href = `${href}?${searchParams.toString()}`;
  }
  return createElement("a", { href, className, onClick, role, ...rest }, children);
};

// ── Factory options ──

interface RouterMockOptions {
  /** Mock for useNavigate — e.g. `() => mockNavigate`. */
  useNavigate?: () => unknown;
  /** Mock for useRouter — e.g. `() => mockRouter`. */
  useRouter?: () => unknown;
  /** Mock for useRouterState — pass hoisted fn directly. */
  useRouterState?: unknown;
  /** Mock for useLoaderData — attached to createFileRoute return value. */
  useLoaderData?: unknown;
  /** Mock for useSearch — attached to createFileRoute return value. */
  useSearch?: unknown;
  /** Mock for redirect — pass `vi.fn()` or a hoisted fn. */
  redirect?: unknown;
  /** If true, mock createRootRoute instead of createFileRoute (for __root.test). */
  rootRoute?: boolean;
  /** If true, include an Outlet stub that renders a testable div. */
  outlet?: boolean;
  /** Custom createRootRoute factory (overrides rootRoute boolean). */
  createRootRoute?: unknown;
  /** Mock for getRouteApi — returns an object with useLoaderData, useParams, useRouteContext. */
  getRouteApi?: unknown;
  /** Additional top-level exports to spread onto the mock module. */
  extras?: Record<string, unknown>;
}

/**
 * Creates a mock module object for `@tanstack/react-router`.
 *
 * Can be used as the factory argument to `vi.mock()`:
 * ```ts
 * vi.mock("@tanstack/react-router", () => createRouterMock({ ... }));
 * ```
 */
export function createRouterMock(options: RouterMockOptions = {}): Record<string, unknown> {
  const mock: Record<string, unknown> = {
    Link: StubLink,
  };

  // createFileRoute — standard route mock (included unless rootRoute mode)
  if (!options.rootRoute && !options.createRootRoute) {
    mock.createFileRoute = () => (routeOptions: Record<string, unknown>) => {
      const result: Record<string, unknown> = { ...routeOptions };
      if (options.useLoaderData) {
        result.useLoaderData = options.useLoaderData;
      }
      if (options.useSearch) {
        result.useSearch = options.useSearch;
      }
      return result;
    };
  }

  // createRootRoute — for __root.test
  if (options.createRootRoute) {
    mock.createRootRoute = options.createRootRoute;
  } else if (options.rootRoute) {
    mock.createRootRoute = (routeOptions: Record<string, unknown>) => ({
      ...routeOptions,
      useLoaderData: options.useLoaderData ?? (() => ({ authState: { user: null, roles: [] } })),
    });
  }

  // Outlet stub
  if (options.outlet) {
    mock.Outlet = () => createElement("div", { "data-testid": "outlet" }, "Page content");
  }

  // useNavigate
  if (options.useNavigate) {
    mock.useNavigate = options.useNavigate;
  }

  // useRouter
  if (options.useRouter) {
    mock.useRouter = options.useRouter;
  }

  // useRouterState
  if (options.useRouterState !== undefined) {
    mock.useRouterState = options.useRouterState;
  }

  // redirect
  if (options.redirect !== undefined) {
    mock.redirect = options.redirect;
  }

  // getRouteApi — for child routes that access parent loader data
  if (options.getRouteApi !== undefined) {
    mock.getRouteApi = options.getRouteApi;
  } else if (options.useLoaderData) {
    // Default: getRouteApi returns an object with useLoaderData pointing to the same mock
    const loaderDataFn = options.useLoaderData;
    mock.getRouteApi = () => ({
      useLoaderData: loaderDataFn,
      useParams: () => ({}),
      useRouteContext: () => ({}),
    });
  }

  // Arbitrary additional exports
  if (options.extras) {
    Object.assign(mock, options.extras);
  }

  return mock;
}
