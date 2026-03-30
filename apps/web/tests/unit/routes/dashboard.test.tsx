import { describe, it, expect, vi } from "vitest";

import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRoute } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn((args: unknown) => args),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: mockRedirect }),
);

// ── Route Under Test ──

const { route: routeObject } = extractRoute(
  () => import("../../../src/routes/governance/index.js"),
);
const routeBeforeLoad = () =>
  (routeObject.beforeLoad as () => void)();

// ── Tests ──

describe("governance/index (redirect)", () => {
  it("redirects to /governance/calendar with 301", () => {
    expect(() => routeBeforeLoad()).toThrow();
    expect(mockRedirect).toHaveBeenCalledWith({
      to: "/governance/calendar",
      statusCode: 301,
    });
  });
});
