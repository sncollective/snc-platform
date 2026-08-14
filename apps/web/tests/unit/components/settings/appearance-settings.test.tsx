import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppearanceSettings } from "../../../../src/components/settings/appearance-settings.js";
import {
  AppearanceController,
  type AppearanceControllerEnvironment,
  type AppearanceMediaQuery,
  type AppearancePreference,
} from "../../../../src/lib/appearance/appearance-controller.js";

function makeController() {
  const attributes = new Map<string, string>();
  const storageListeners = new Set<(value: string | null) => void>();
  const writes: AppearancePreference[] = [];
  const mediaQuery: AppearanceMediaQuery = {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const environment: AppearanceControllerEnvironment = {
    documentElement: {
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
    },
    readStoredPreference: () => null,
    writeStoredPreference: (value) => writes.push(value),
    getMediaQuery: () => mediaQuery,
    addStorageListener: (listener) => storageListeners.add(listener),
    removeStorageListener: (listener) => storageListeners.delete(listener),
  };
  const controller = new AppearanceController(() => environment);
  controller.start();

  return {
    controller,
    attributes,
    writes,
    emitStorage(value: string | null) {
      for (const listener of storageListeners) listener(value);
    },
  };
}

describe("AppearanceSettings", () => {
  it("offers light, dark, and system through the shared controller", async () => {
    const user = userEvent.setup();
    const { controller, attributes, writes } = makeController();
    render(<AppearanceSettings controller={controller} />);

    expect(screen.getByRole("radio", { name: /System/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /Dark/ }));

    expect(screen.getByRole("radio", { name: /Dark/ })).toBeChecked();
    expect(attributes.get("data-theme-preference")).toBe("dark");
    expect(attributes.get("data-theme")).toBe("dark");
    expect(writes).toEqual(["dark"]);
  });

  it("reflects a cross-tab storage change without a local echo write", () => {
    const { controller, writes, emitStorage } = makeController();
    render(<AppearanceSettings controller={controller} />);

    act(() => emitStorage("light"));

    expect(screen.getByRole("radio", { name: /Light/ })).toBeChecked();
    expect(writes).toEqual([]);
  });
});
