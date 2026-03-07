/**
 * Shared null-render component stub factory for web tests.
 *
 * Eliminates duplicated vi.mock() blocks for components that need to be
 * stubbed out as simple testid divs (e.g., SubscribeCta, VideoPlayer).
 *
 * Usage:
 *   import { stubComponent } from "../../helpers/component-stubs.js";
 *
 *   const { mockSubscribeCta } = vi.hoisted(() => ({
 *     mockSubscribeCta: vi.fn(),
 *   }));
 *
 *   vi.mock(
 *     "../../../src/components/content/subscribe-cta.js",
 *     () => stubComponent("SubscribeCta", "subscribe-cta", mockSubscribeCta),
 *   );
 *
 *   // In tests:
 *   expect(mockSubscribeCta).toHaveBeenCalledWith(
 *     expect.objectContaining({ creatorId: "creator-42" }),
 *   );
 */

import { createElement } from "react";

/**
 * Returns a mock module object for a component that renders as a
 * `<div data-testid={testId} />` and records all props via the provided spy.
 *
 * Intended as the return value of a `vi.mock()` factory function.
 *
 * @param name - The named export of the component (e.g., "SubscribeCta")
 * @param testId - The data-testid attribute for the rendered stub element
 * @param spy - A `vi.fn()` spy (typically created in a `vi.hoisted()` block)
 */
export function stubComponent(
  name: string,
  testId: string,
  spy: (...args: unknown[]) => unknown,
): Record<string, unknown> {
  return {
    [name]: (props: Record<string, unknown>) => {
      spy(props);
      return createElement("div", { "data-testid": testId });
    },
  };
}
