import { createElement, type ComponentProps, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RouteVoiceScope } from "../../../../src/lib/route-voice/route-voice.js";

function primitive(part: string) {
  return ({ children, ...props }: ComponentProps<"div">) =>
    createElement("div", { "data-part": part, ...props }, children);
}

vi.mock("@ark-ui/react/portal", () => ({
  Portal: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@ark-ui/react/select", () => ({
  createListCollection: vi.fn(),
  Select: {
    Positioner: primitive("select-positioner"),
    Content: primitive("select-content"),
  },
}));

vi.mock("@ark-ui/react/dialog", () => ({
  Dialog: {
    Backdrop: primitive("dialog-backdrop"),
    Positioner: primitive("dialog-positioner"),
    Content: primitive("dialog-content"),
  },
}));

vi.mock("@ark-ui/react/tooltip", () => ({
  Tooltip: {
    Root: primitive("tooltip-root"),
    Trigger: primitive("tooltip-trigger"),
    Positioner: primitive("tooltip-positioner"),
    Content: primitive("tooltip-content"),
  },
}));

vi.mock("@ark-ui/react/popover", () => ({
  Popover: {
    Positioner: primitive("popover-positioner"),
    Content: primitive("popover-content"),
  },
}));

vi.mock("@ark-ui/react/menu", () => ({
  Menu: {
    Positioner: primitive("menu-positioner"),
    Content: primitive("menu-content"),
  },
}));

import { DialogBackdrop, DialogContent } from "../../../../src/components/ui/dialog.js";
import { MenuContent } from "../../../../src/components/ui/menu.js";
import { PopoverContent } from "../../../../src/components/ui/popover.js";
import { SelectContent } from "../../../../src/components/ui/select.js";
import { Tooltip } from "../../../../src/components/ui/tooltip.js";

describe("route voice portal primitives", () => {
  it("repeats a voiced leaf identity on every positioned portal root", () => {
    const { container } = render(
      <RouteVoiceScope routeDefault="tv">
        <SelectContent>Option</SelectContent>
        <DialogBackdrop />
        <DialogContent>Dialog</DialogContent>
        <Tooltip content="Hint">
          <button type="button">Trigger</button>
        </Tooltip>
        <PopoverContent>Popover</PopoverContent>
        <MenuContent>Menu</MenuContent>
      </RouteVoiceScope>,
    );

    for (const part of [
      "select-positioner",
      "dialog-backdrop",
      "dialog-positioner",
      "tooltip-positioner",
      "popover-positioner",
      "menu-positioner",
    ]) {
      expect(container.querySelector(`[data-part="${part}"]`)).toHaveAttribute(
        "data-route",
        "tv",
      );
    }
  });

  it("uses the explicit Parent fallback for shell-originated portals", () => {
    const { container } = render(<MenuContent>Shell menu</MenuContent>);

    expect(container.querySelector('[data-part="menu-positioner"]')).toHaveAttribute(
      "data-route",
      "parent",
    );
  });
});
