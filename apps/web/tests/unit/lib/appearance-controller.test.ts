import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppearanceController,
  type AppearanceControllerEnvironment,
  type AppearanceMediaQuery,
  type AppearancePreference,
} from "../../../src/lib/appearance/appearance-controller.js";

class FakeDocumentElement {
  readonly attributes = new Map<string, string>();
  readonly setAttribute = vi.fn((name: string, value: string) => {
    this.attributes.set(name, value);
  });

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeMediaQuery implements AppearanceMediaQuery {
  matches = false;
  readonly listeners = new Set<() => void>();
  readonly removedListeners: Array<() => void> = [];

  addEventListener(_type: "change", listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "change", listener: () => void): void {
    this.listeners.delete(listener);
    this.removedListeners.push(listener);
  }

  emit(matches: boolean): void {
    this.matches = matches;
    for (const listener of [...this.listeners]) listener();
  }
}

class FakeEnvironment implements AppearanceControllerEnvironment {
  readonly documentElement = new FakeDocumentElement();
  readonly mediaQuery = new FakeMediaQuery();
  readonly storageListeners = new Set<(value: string | null) => void>();
  readonly writes: AppearancePreference[] = [];
  storedValue: string | null = null;
  blockRead = false;
  blockWrite = false;

  readStoredPreference(): string | null {
    if (this.blockRead) throw new DOMException("Storage blocked", "SecurityError");
    return this.storedValue;
  }

  writeStoredPreference(value: AppearancePreference): void {
    if (this.blockWrite) throw new DOMException("Storage blocked", "SecurityError");
    this.storedValue = value;
    this.writes.push(value);
  }

  getMediaQuery(): AppearanceMediaQuery {
    return this.mediaQuery;
  }

  addStorageListener(listener: (value: string | null) => void): void {
    this.storageListeners.add(listener);
  }

  removeStorageListener(listener: (value: string | null) => void): void {
    this.storageListeners.delete(listener);
  }

  emitStorage(value: string | null): void {
    this.storedValue = value;
    for (const listener of [...this.storageListeners]) listener(value);
  }
}

let environment: FakeEnvironment;
let controller: AppearanceController;

beforeEach(() => {
  environment = new FakeEnvironment();
  controller = new AppearanceController(() => environment);
});

describe("AppearanceController", () => {
  it("normalizes an invalid stored value to system", () => {
    environment.storedValue = "sepia";
    environment.mediaQuery.matches = true;

    controller.start();

    expect(controller.getSnapshot()).toEqual({ preference: "system", effective: "dark" });
    expect(environment.documentElement.attributes).toEqual(
      new Map([
        ["data-theme-preference", "system"],
        ["data-theme", "dark"],
      ]),
    );
  });

  it("falls back to system without throwing when storage reads or writes are blocked", () => {
    environment.blockRead = true;
    environment.mediaQuery.matches = true;

    expect(() => controller.start()).not.toThrow();
    expect(controller.getSnapshot()).toEqual({ preference: "system", effective: "dark" });

    environment.blockRead = false;
    environment.blockWrite = true;
    expect(() => controller.applyPreference("light", "local")).not.toThrow();
    expect(controller.getSnapshot()).toEqual({ preference: "system", effective: "dark" });
    expect(environment.writes).toEqual([]);
  });

  it("applies storage events without echo writes and normalizes removal or invalid values", () => {
    controller.start();
    expect(environment.mediaQuery.listeners.size).toBe(1);

    environment.emitStorage("dark");
    expect(controller.getSnapshot()).toEqual({ preference: "dark", effective: "dark" });
    expect(environment.mediaQuery.listeners.size).toBe(0);
    expect(environment.writes).toEqual([]);

    environment.emitStorage("invalid");
    expect(controller.getSnapshot().preference).toBe("system");
    expect(environment.mediaQuery.listeners.size).toBe(1);

    environment.emitStorage(null);
    expect(controller.getSnapshot().preference).toBe("system");
    expect(environment.writes).toEqual([]);
  });

  it("tracks system changes only while system-pinned", () => {
    controller.start();

    environment.mediaQuery.emit(true);
    expect(controller.getSnapshot()).toEqual({ preference: "system", effective: "dark" });
    expect(environment.documentElement.getAttribute("data-theme")).toBe("dark");

    controller.applyPreference("light", "local");
    expect(environment.mediaQuery.listeners.size).toBe(0);
    environment.mediaQuery.emit(false);
    expect(controller.getSnapshot()).toEqual({ preference: "light", effective: "light" });
    expect(environment.writes).toEqual(["light"]);
  });

  it("lets an explicit preference beat a queued media callback", () => {
    controller.start();
    const queuedMediaCallback = [...environment.mediaQuery.listeners][0];
    expect(queuedMediaCallback).toBeDefined();

    environment.mediaQuery.matches = true;
    controller.applyPreference("light", "local");
    queuedMediaCallback?.();

    expect(controller.getSnapshot()).toEqual({ preference: "light", effective: "light" });
    expect(environment.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("is idempotent and tears down all listeners on stop", () => {
    controller.start();
    const writesAfterStart = environment.documentElement.setAttribute.mock.calls.length;

    controller.applyPreference("system", "storage");
    expect(environment.documentElement.setAttribute).toHaveBeenCalledTimes(writesAfterStart);
    expect(environment.mediaQuery.listeners.size).toBe(1);

    controller.stop();
    expect(environment.mediaQuery.listeners.size).toBe(0);
    expect(environment.storageListeners.size).toBe(0);
  });
});
