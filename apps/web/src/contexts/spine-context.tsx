import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type React from "react";

import type { PlatformEvent, SseTopic } from "@snc/shared";

import { createSpineStore } from "./spine-store.js";
import type { SpineSnapshot, SpineStore } from "./spine-store.js";

// ── Context ──

const SpineContext = createContext<SpineStore | null>(null);

const DISCONNECTED_SNAPSHOT: SpineSnapshot = {
  status: "connecting",
  granted: [],
  denied: [],
};

// ── Provider ──

/**
 * Holds one EventSource for the tab and shares it across all spine consumers
 * (respecting the server maxConnections cap). The single store is created once and
 * closed on unmount — the same close() cleanup that respects the cap also makes the
 * provider StrictMode-correct (dev setup→cleanup→setup recreates one store cleanly).
 * EventSource is client-only, so the store is created in an effect (never on the server).
 */
export function SpineProvider({
  topics,
  children,
  eventSourceCtor,
}: {
  readonly topics: readonly SseTopic[];
  readonly children: React.ReactNode;
  /** Injectable EventSource constructor for tests; defaults to the global. */
  readonly eventSourceCtor?: typeof EventSource;
}): React.ReactElement {
  const storeRef = useRef<SpineStore | null>(null);

  // Lazily create once (client-side). The effect below owns teardown.
  if (storeRef.current === null && typeof window !== "undefined") {
    storeRef.current = createSpineStore(topics, eventSourceCtor);
  }

  useEffect(() => {
    // If the effect re-runs after a StrictMode teardown, recreate the store.
    if (storeRef.current === null && typeof window !== "undefined") {
      storeRef.current = createSpineStore(topics, eventSourceCtor);
    }
    return () => {
      storeRef.current?.close();
      storeRef.current = null;
    };
    // topics/ctor are connection identity — re-subscribe if they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.join(","), eventSourceCtor]);

  return (
    <SpineContext.Provider value={storeRef.current}>
      {children}
    </SpineContext.Provider>
  );
}

// ── Hooks ──

/** The live spine connection status + topic grants (re-renders on status change). */
export function useSpineStatus(): SpineSnapshot {
  const store = useContext(SpineContext);
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    store?.getSnapshot ?? (() => DISCONNECTED_SNAPSHOT),
    () => DISCONNECTED_SNAPSHOT,
  );
}

/**
 * Subscribe to a topic's events. `onEvent` fires for each event on the topic.
 *
 * @returns `{ denied: true }` when the topic was denied at the handshake (e.g. an
 *   anonymous viewer on the `content` topic), so the consumer can render an affordance
 *   instead of opening a second connection.
 */
export function useSpineTopic(
  topic: SseTopic,
  onEvent: (event: PlatformEvent) => void,
): { readonly denied: boolean } {
  const store = useContext(SpineContext);
  const snapshot = useSpineStatus();

  // Latest-handler ref so a re-created onEvent closure doesn't churn the subscription
  // (same pattern as usePolling's fetcherRef).
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!store) return;
    return store.onTopic(topic, (event) => handlerRef.current(event));
  }, [store, topic]);

  return { denied: snapshot.denied.includes(topic) };
}
