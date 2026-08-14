import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  resolveRouteVoice,
  RouteVoiceScope,
} from "../../../src/lib/route-voice/route-voice.js";

describe("resolveRouteVoice", () => {
  it.each([
    ["/studio", "studio"],
    ["/studio/", "studio"],
    ["/live", "tv"],
    ["/live///", "tv"],
    ["/creators/c1/press", "records"],
    ["/creators/c1/press/", "records"],
    ["/creators/c1/press/releases/a1", "records"],
    ["/creators/c1/press-kit", "parent"],
    ["/creators/c1/manage/press", "parent"],
    ["/creators/c1/manage/library", "parent"],
    ["/", "parent"],
    ["/admin", "parent"],
    ["/admin/playout", "parent"],
  ] as const)("maps %s to %s", (pathname, expected) => {
    expect(resolveRouteVoice(pathname)).toBe(expected);
  });
});

describe("RouteVoiceScope", () => {
  it.each(["parent", "studio", "tv", "records"] as const)(
    "emits the %s identity in server-rendered HTML",
    (routeDefault) => {
      const html = renderToString(
        <RouteVoiceScope routeDefault={routeDefault}>
          <span>Leaf content</span>
        </RouteVoiceScope>,
      );

      expect(html).toContain(`data-route="${routeDefault}"`);
      expect(html).toContain("display:contents");
      expect(html).toContain("Leaf content");
    },
  );
});
