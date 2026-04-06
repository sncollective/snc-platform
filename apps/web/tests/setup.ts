import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// Ark UI uses @floating-ui/dom which calls ResizeObserver for positioning.
// jsdom does not implement ResizeObserver, so we provide a no-op stub.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Ark UI's Select scrolls the content list on open — jsdom elements don't have scrollTo.
// Provide a no-op polyfill so Zag's state machine doesn't throw.
if (typeof Element.prototype.scrollTo === "undefined") {
  Element.prototype.scrollTo = function () {};
}
