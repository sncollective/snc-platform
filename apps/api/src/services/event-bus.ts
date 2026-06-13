import type { PlatformEvent, SseTopic } from "@snc/shared";

import { rootLogger } from "../logging/logger.js";

// ── Public Types ──

/** A function that decides whether an event should reach a specific subscriber. */
export type EventScopeFilter = (
  event: PlatformEvent,
  ctx: SubscriberContext,
) => boolean;

/** Context attached to each SSE subscriber, used for scope-filter decisions. */
export interface SubscriberContext {
  userId: string | null;
  roles: string[];
  /**
   * Creator IDs the subscriber is a member of — populated at connect by the SSE
   * route when the `content` topic is granted. Empty array for anon connections
   * and connections that didn't request the `content` topic.
   */
  creatorIds: string[];
}

/** Registry entry describing routing and coalescing for one event type. */
export interface EventTypeEntry {
  /** Topic the event belongs to. */
  topic: SseTopic;
  /** Derive the coalescing key from the event (same key = latest-wins dedup). */
  coalesceKey: (event: PlatformEvent) => string;
  /** Optional predicate; when absent the event reaches all topic subscribers. */
  scopeFilter?: EventScopeFilter;
}

/**
 * Pull-based subscription handle returned by `EventBus.subscribe`.
 * Call `next()` in a loop; call `close()` in a `finally` block.
 */
export interface Subscription {
  /** Pull next batch; resolves on enqueue or after timeoutMs ([] = heartbeat turn). */
  next(timeoutMs: number): Promise<PlatformEvent[]>;
  /** Release resources. Safe to call multiple times. */
  close(): void;
  /**
   * Whether the subscription has been closed (close(), closeAll(), or the
   * coalesce backstop). Consumers MUST check this after every next() turn and
   * stop their write loop when true — post-close, next() resolves [] immediately,
   * so a loop that treats [] as a heartbeat turn would busy-spin.
   */
  isClosed(): boolean;
}

/** Singleton event bus interface exposed for testing and DI. */
export interface EventBus {
  /** Publish an event to all matching subscribers. Sync, never throws. */
  publish(event: PlatformEvent): void;
  /** Subscribe to events on the specified topics. */
  subscribe(topics: SseTopic[], ctx: SubscriberContext): Subscription;
  /** Resolve all pending next() calls with [] and prevent further publishes. */
  closeAll(): void;
  /** Return the current number of open subscriptions. */
  connectionCount(): number;
}

// ── Registry ──

/**
 * Exhaustive map of every PlatformEvent type to its routing entry.
 * TypeScript will error if a new event type is added to PlatformEvent
 * without a matching entry here.
 */
export const EVENT_REGISTRY: Record<PlatformEvent["type"], EventTypeEntry> = {
  "channel.live-state-changed": {
    topic: "live",
    // Coalesce by channel — last state per channel wins over a burst.
    coalesceKey: (event) =>
      event.type === "channel.live-state-changed" ? event.channelId : event.type,
  },
  "playout.queue-changed": {
    topic: "playout",
    // Coalesce by channel — bursts of queue edits collapse to one notification.
    coalesceKey: (event) =>
      event.type === "playout.queue-changed" ? event.channelId : event.type,
  },
  "playout.now-playing-changed": {
    topic: "playout",
    // Coalesce by channel — rapid track advances collapse to the latest.
    coalesceKey: (event) =>
      event.type === "playout.now-playing-changed" ? event.channelId : event.type,
  },
  "playout.engine-restarted": {
    topic: "playout",
    // Static key — all engine-restart events coalesce (one notification per burst).
    coalesceKey: () => "engine",
  },
  "content.processing-status-changed": {
    topic: "content",
    // Coalesce by content item — rapid status updates collapse to the latest.
    coalesceKey: (event) =>
      event.type === "content.processing-status-changed" ? event.contentId : event.type,
    // Admin sees all; creator members see only their own creator's content events.
    scopeFilter: (event, ctx) => {
      if (ctx.roles.includes("admin")) return true;
      if (event.type !== "content.processing-status-changed") return false;
      return ctx.creatorIds.includes(event.creatorId);
    },
  },
};

// ── Internal Implementation ──

const COALESCE_BACKSTOP = 256;

/** Internal per-connection subscription. */
class SubscriptionImpl implements Subscription {
  private readonly coalesceMap = new Map<string, PlatformEvent>();
  private resolver: ((events: PlatformEvent[]) => void) | null = null;
  private closed = false;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly topics: ReadonlySet<SseTopic>,
    private readonly ctx: SubscriberContext,
    private readonly onClose: (sub: SubscriptionImpl) => void,
  ) {}

  /** Enqueue an event for delivery; wake a pending next() if one is waiting. */
  enqueue(event: PlatformEvent): void {
    if (this.closed) return;

    const entry = EVENT_REGISTRY[event.type];
    if (!entry) return;
    if (!this.topics.has(entry.topic)) return;
    if (entry.scopeFilter && !entry.scopeFilter(event, this.ctx)) return;

    const key = `${event.type}:${entry.coalesceKey(event)}`;
    this.coalesceMap.set(key, event);

    // Backstop: if the map explodes, close the subscription and warn.
    if (this.coalesceMap.size > COALESCE_BACKSTOP) {
      rootLogger.warn(
        { mapSize: this.coalesceMap.size, topics: [...this.topics] },
        "SSE coalesce map exceeded backstop; closing subscription",
      );
      this.close();
      return;
    }

    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = null;
      if (this.timeoutHandle !== null) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
      resolve(this.drain());
    }
  }

  /** Drain all pending events and clear the coalesce map. */
  private drain(): PlatformEvent[] {
    const events = [...this.coalesceMap.values()];
    this.coalesceMap.clear();
    return events;
  }

  /** Resolve any pending next() call immediately with [] (used by closeAll). */
  wake(): void {
    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = null;
      if (this.timeoutHandle !== null) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
      resolve([]);
    }
  }

  next(timeoutMs: number): Promise<PlatformEvent[]> {
    if (this.closed) return Promise.resolve([]);

    // Events already waiting — drain immediately.
    if (this.coalesceMap.size > 0) {
      return Promise.resolve(this.drain());
    }

    return new Promise<PlatformEvent[]>((resolve) => {
      this.resolver = resolve;
      this.timeoutHandle = setTimeout(() => {
        this.resolver = null;
        this.timeoutHandle = null;
        resolve([]);
      }, timeoutMs);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.wake(); // unblock any pending next()
    this.onClose(this);
  }

  isClosed(): boolean {
    return this.closed;
  }
}

// ── Factory ──

/**
 * Create a new EventBus instance.
 * Prefer the module-level `eventBus` singleton; use this in tests for isolation.
 */
export function createEventBus(): EventBus {
  const subscriptions = new Set<SubscriptionImpl>();
  let closed = false;

  const publish = (event: PlatformEvent): void => {
    if (closed) return;
    try {
      for (const sub of subscriptions) {
        sub.enqueue(event);
      }
    } catch (e) {
      rootLogger.error({ err: e }, "EventBus: publish error (should be unreachable)");
    }
  };

  const subscribe = (topics: SseTopic[], ctx: SubscriberContext): Subscription => {
    const sub = new SubscriptionImpl(new Set(topics), ctx, (s) => {
      subscriptions.delete(s);
    });
    subscriptions.add(sub);
    return sub;
  };

  const closeAll = (): void => {
    closed = true;
    // close() (not just wake()) — consumers' write loops end only when
    // isClosed() flips, which is what delivers the clean FIN at shutdown.
    // Iterate a copy: close() removes each sub from the set via onClose.
    for (const sub of [...subscriptions]) {
      sub.close();
    }
  };

  const connectionCount = (): number => subscriptions.size;

  return { publish, subscribe, closeAll, connectionCount };
}

// ── Singleton ──

/** Module-level EventBus singleton. Import and call publish/subscribe directly. */
export const eventBus: EventBus = createEventBus();
