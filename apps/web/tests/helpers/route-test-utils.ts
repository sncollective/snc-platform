import type React from "react";
import { beforeAll } from "vitest";

interface RouteWithComponent {
  component: () => React.ReactElement;
  [key: string]: unknown;
}

/**
 * Extracts the component from a TanStack file route module inside a
 * `beforeAll` block, eliminating the unsafe `as unknown as { component }`
 * cast that would otherwise appear in every route test file.
 *
 * Usage:
 * ```ts
 * const Page = extractRouteComponent(() => import("../../../src/routes/feed.js"));
 * ```
 *
 * The returned function is populated by `beforeAll` and returns the component
 * when called during a test.
 */
export function extractRouteComponent(
  importFn: () => Promise<{ Route: unknown }>,
): () => React.ReactElement {
  let component: (() => React.ReactElement) | undefined;

  beforeAll(async () => {
    const mod = await importFn();
    component = (mod.Route as RouteWithComponent).component;
  });

  return (() => {
    if (!component) {
      throw new Error(
        "Route component not yet loaded — extractRouteComponent must be called at module scope (before tests run)",
      );
    }
    return component();
  }) as () => React.ReactElement;
}

/**
 * Extracts the full route object from a TanStack file route module inside a
 * `beforeAll` block, for tests that need access to `beforeLoad`, `loader`,
 * or other route options beyond the component.
 *
 * Usage:
 * ```ts
 * const { component: Page, route } = extractRoute(() => import("../../../src/routes/index.js"));
 * ```
 */
export function extractRoute(
  importFn: () => Promise<{ Route: unknown }>,
): { component: () => React.ReactElement; route: RouteWithComponent } {
  let component: (() => React.ReactElement) | undefined;
  let routeObj: RouteWithComponent | undefined;

  beforeAll(async () => {
    const mod = await importFn();
    routeObj = mod.Route as RouteWithComponent;
    component = routeObj.component;
  });

  const componentFn = (() => {
    if (!component) {
      throw new Error(
        "Route component not yet loaded — extractRoute must be called at module scope (before tests run)",
      );
    }
    return component();
  }) as () => React.ReactElement;

  const routeProxy = new Proxy({} as RouteWithComponent, {
    get(_target, prop) {
      if (!routeObj) {
        throw new Error(
          "Route not yet loaded — extractRoute must be called at module scope (before tests run)",
        );
      }
      return routeObj[prop as string];
    },
    has(_target, prop) {
      if (!routeObj) {
        throw new Error(
          "Route not yet loaded — extractRoute must be called at module scope (before tests run)",
        );
      }
      return prop in routeObj;
    },
    ownKeys() {
      if (!routeObj) {
        throw new Error(
          "Route not yet loaded — extractRoute must be called at module scope (before tests run)",
        );
      }
      return Reflect.ownKeys(routeObj);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (!routeObj) {
        throw new Error(
          "Route not yet loaded — extractRoute must be called at module scope (before tests run)",
        );
      }
      return Object.getOwnPropertyDescriptor(routeObj, prop);
    },
  });

  return { component: componentFn, route: routeProxy };
}
