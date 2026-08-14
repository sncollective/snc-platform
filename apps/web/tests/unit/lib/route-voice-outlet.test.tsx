import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { routerLocation } = vi.hoisted(() => ({
  routerLocation: { pathname: "/" },
}));

vi.mock("@tanstack/react-router", async () => {
  const { createElement } = await import("react");

  return {
    Outlet: () => createElement("span", { "data-testid": "route-leaf" }, "Route leaf"),
    useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
      select({ location: { pathname: routerLocation.pathname } }),
  };
});

import { RouteVoiceOutlet } from "../../../src/lib/route-voice/route-voice.js";

describe("RouteVoiceOutlet runtime boundary", () => {
  it.each([
    ["/studio", "studio"],
    ["/live", "tv"],
    ["/creators/c1/press", "records"],
    ["/creators/c1/manage/library", "parent"],
  ] as const)("server-renders %s with data-route=%s before hydration", (pathname, routeVoice) => {
    routerLocation.pathname = pathname;

    const html = renderToString(<RouteVoiceOutlet />);

    expect(html).toContain(`data-route="${routeVoice}"`);
    expect(html).toContain("Route leaf");
  });

  it("replaces the route identity atomically as pathname state changes", () => {
    routerLocation.pathname = "/studio";
    const { container, rerender } = render(<RouteVoiceOutlet />);

    expect(container.querySelector("[data-route]")).toHaveAttribute("data-route", "studio");

    routerLocation.pathname = "/";
    rerender(<RouteVoiceOutlet />);

    expect(container.querySelectorAll("[data-route]")).toHaveLength(1);
    expect(container.querySelector("[data-route]")).toHaveAttribute("data-route", "parent");
    expect(container.querySelector('[data-route="studio"]')).toBeNull();

    routerLocation.pathname = "/creators/c1/press/releases/a1";
    rerender(<RouteVoiceOutlet />);

    expect(container.querySelectorAll("[data-route]")).toHaveLength(1);
    expect(container.querySelector("[data-route]")).toHaveAttribute("data-route", "records");
    expect(container.querySelector('[data-route="parent"]')).toBeNull();
  });
});
