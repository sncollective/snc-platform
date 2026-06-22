import type { PlatformEvent, SseTopic } from "@snc/shared";

// ── Public Types ──

/** Connection status of a spine store's single EventSource. */
export type SpineStatus = "connecting" | "open" | "denied" | "closed";

/** Immutable snapshot of the spine connection, consumed via useSyncExternalStore. */
export interface SpineSnapshot {
  readonly status: SpineStatus;
  readonly granted: readonly SseTopic[];
  readonly denied: readonly SseTopic[];
}

/**
 * Framework-agnostic SSE spine consumer: one EventSource, the
 * useSyncExternalStore contract for status, and per-topic event dispatch.
 */
export interface SpineStore {
  /** Subscribe to status-snapshot changes. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
  /** Current status snapshot (stable reference until a change). */
  getSnapshot(): SpineSnapshot;
  /** Subscribe a handler to a topic's events. Returns an unsubscribe fn. */
  onTopic(topic: SseTopic, handler: (event: PlatformEvent) => void): () => void;
  /** Close the EventSource and release all listeners. */
  close(): void;
}

// ── Private ──

/** Maps each platform event type to its SSE topic (mirrors the API EVENT_REGISTRY). */
const EVENT_TOPIC: Record<PlatformEvent["type"], SseTopic> = {
  "channel.live-state-changed": "live",
  "playout.queue-changed": "playout",
  "playout.now-playing-changed": "playout",
  "playout.engine-restarted": "playout",
  "content.processing-status-changed": "content",
  "content.playout-changed": "content",
};

// ── Public API ──

/**
 * Create a spine store backed by one EventSource subscribed to `topics`.
 *
 * The EventSource is the only connection (respecting the server maxConnections cap);
 * native auto-reconnect owns the lifetime-close and network-blip cases, so this store
 * holds NO backoff timer. The `error` handler triages by readyState: CONNECTING is a
 * transient retry-in-progress (status → connecting, no teardown); CLOSED is terminal
 * (e.g. a session-expiry non-200 on reconnect — status → closed, consumer routes to
 * re-auth).
 *
 * @param topics - topics to request (CSV'd into ?topics=)
 * @param eventSourceCtor - injectable EventSource constructor (default: global); tests
 *   pass a FakeEventSource.
 */
export function createSpineStore(
  topics: readonly SseTopic[],
  eventSourceCtor: typeof EventSource = EventSource,
): SpineStore {
  let snapshot: SpineSnapshot = {
    status: "connecting",
    granted: [],
    denied: [],
  };
  const statusListeners = new Set<() => void>();
  const topicHandlers = new Map<SseTopic, Set<(event: PlatformEvent) => void>>();

  const emitStatus = (): void => {
    for (const listener of statusListeners) listener();
  };

  const setSnapshot = (next: SpineSnapshot): void => {
    snapshot = next;
    emitStatus();
  };

  const source = new eventSourceCtor(`/api/sse?topics=${topics.join(",")}`);

  // Handshake: { granted, denied }. All-denied → status "denied".
  source.addEventListener("spine.connected", (e) => {
    try {
      const { granted, denied } = JSON.parse((e as MessageEvent).data as string) as {
        granted: SseTopic[];
        denied: SseTopic[];
      };
      setSnapshot({
        status: granted.length === 0 ? "denied" : "open",
        granted,
        denied,
      });
    } catch {
      // Malformed handshake — keep connecting; a real event or reconnect will recover.
    }
  });

  // Named platform events → dispatch to that event's topic handlers.
  const dispatch = (e: Event): void => {
    try {
      const event = JSON.parse((e as MessageEvent).data as string) as PlatformEvent;
      const topic = EVENT_TOPIC[event.type];
      const handlers = topicHandlers.get(topic);
      if (handlers) for (const handler of handlers) handler(event);
    } catch {
      // Malformed event payload — ignore (the next re-sync re-reads authoritative state).
    }
  };
  for (const type of Object.keys(EVENT_TOPIC) as PlatformEvent["type"][]) {
    source.addEventListener(type, dispatch);
  }

  source.addEventListener("error", () => {
    // readyState triage — CONNECTING(0): browser is retrying (transient); CLOSED(2):
    // terminal, native reconnect gave up (e.g. a non-200 on reconnect).
    if (source.readyState === source.CLOSED) {
      setSnapshot({ ...snapshot, status: "closed" });
    } else if (snapshot.status !== "denied") {
      setSnapshot({ ...snapshot, status: "connecting" });
    }
  });

  return {
    subscribe(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    onTopic(topic, handler) {
      let handlers = topicHandlers.get(topic);
      if (!handlers) {
        handlers = new Set();
        topicHandlers.set(topic, handlers);
      }
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    close() {
      source.close();
      statusListeners.clear();
      topicHandlers.clear();
    },
  };
}
