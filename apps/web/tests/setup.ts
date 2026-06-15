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

// jsdom does not implement EventSource. Components that open the SSE spine
// (SpineProvider) would throw at mount. Provide an inert EventTarget-based stub so
// any consumer mounts cleanly with a connection that never fires events. Tests that
// need to DRIVE spine events inject the richer FakeEventSource via eventSourceCtor.
if (typeof globalThis.EventSource === "undefined") {
  class StubEventSource extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSED = 2;
    readyState = 0;
    url: string;
    constructor(url: string) {
      super();
      this.url = url;
    }
    close() {
      this.readyState = this.CLOSED;
    }
  }
  globalThis.EventSource = StubEventSource as unknown as typeof EventSource;
}
