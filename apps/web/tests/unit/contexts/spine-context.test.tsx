import { renderToString } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type React from "react";

import type { PlatformEvent } from "@snc/shared";

import {
  SpineProvider,
  useSpineStatus,
  useSpineTopic,
} from "../../../src/contexts/spine-context.js";
import { FakeEventSource } from "../../helpers/fake-event-source.js";

afterEach(() => {
  FakeEventSource.reset();
  vi.unstubAllGlobals();
});

/** Provider wrapper injecting the fake EventSource on the `live` topic. */
function wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <SpineProvider
      topics={["live"]}
      eventSourceCtor={FakeEventSource as unknown as typeof EventSource}
    >
      {children}
    </SpineProvider>
  );
}

function lastSource(): FakeEventSource {
  const src = FakeEventSource.instances.at(-1);
  if (!src) throw new Error("no FakeEventSource constructed");
  return src;
}

describe("SpineProvider + hooks", () => {
  it("does not construct EventSource during server render", () => {
    const eventSourceCtor = vi.fn();
    vi.stubGlobal("window", undefined);

    renderToString(
      <SpineProvider
        topics={["live"]}
        eventSourceCtor={eventSourceCtor as unknown as typeof EventSource}
      >
        <div />
      </SpineProvider>,
    );

    expect(eventSourceCtor).not.toHaveBeenCalled();
  });

  it("opens exactly one EventSource on the requested topics", () => {
    renderHook(() => useSpineStatus(), { wrapper });
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(lastSource().url).toBe("/api/sse?topics=live");
  });

  it("reflects the spine.connected handshake grants", () => {
    const { result } = renderHook(() => useSpineStatus(), { wrapper });
    expect(result.current.status).toBe("connecting");

    act(() => lastSource().emitConnected(["live"], []));

    expect(result.current.status).toBe("open");
    expect(result.current.granted).toEqual(["live"]);
  });

  it("marks a fully-denied connection as denied", () => {
    const { result } = renderHook(
      () => useSpineTopic("content", () => {}),
      { wrapper },
    );
    act(() => lastSource().emitConnected([], ["content"]));
    expect(result.current.denied).toBe(true);
  });

  it("fires the topic handler on a matching event", () => {
    const received: PlatformEvent[] = [];
    renderHook(() => useSpineTopic("live", (e) => received.push(e)), { wrapper });

    act(() => lastSource().emitConnected(["live"]));
    act(() =>
      lastSource().emitEvent("channel.live-state-changed", {
        channelId: "ch-1",
        live: true,
      }),
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: "channel.live-state-changed",
      channelId: "ch-1",
      live: true,
    });
  });

  it("does not fire a live handler for a different topic's event", () => {
    const received: PlatformEvent[] = [];
    renderHook(() => useSpineTopic("live", (e) => received.push(e)), { wrapper });

    act(() => lastSource().emitConnected(["live"]));
    act(() => lastSource().emitEvent("playout.queue-changed", { channelId: "ch-1" }));

    expect(received).toHaveLength(0);
  });

  it("triages error by readyState: CONNECTING transient, CLOSED terminal", () => {
    const { result } = renderHook(() => useSpineStatus(), { wrapper });
    act(() => lastSource().emitConnected(["live"]));
    expect(result.current.status).toBe("open");

    act(() => lastSource().emitError(FakeEventSource.CONNECTING));
    expect(result.current.status).toBe("connecting");

    act(() => lastSource().emitError(FakeEventSource.CLOSED));
    expect(result.current.status).toBe("closed");
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = renderHook(() => useSpineStatus(), { wrapper });
    const src = lastSource();
    expect(src.closed).toBe(false);
    unmount();
    expect(src.closed).toBe(true);
  });
});
