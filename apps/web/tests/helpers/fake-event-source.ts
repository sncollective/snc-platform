/**
 * Minimal EventSource test double — jsdom does not implement EventSource.
 *
 * Extends EventTarget for spec-faithful `addEventListener` dispatch (vs. an
 * EventEmitter), exposes the `readyState` constants the spine store triages on, and
 * registers every constructed instance so tests can drive events into the one the
 * provider opened. Inject via the `eventSourceCtor` prop, or `vi.stubGlobal`.
 */
export class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  /** Every instance constructed this test — last one is usually the provider's. */
  static instances: FakeEventSource[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readonly url: string;
  readyState = 0;
  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.readyState = this.CLOSED;
    this.closed = true;
  }

  // ── Test drivers ──

  /** Fire the `spine.connected` handshake with the given grants. */
  emitConnected(granted: string[], denied: string[] = []): void {
    this.readyState = this.OPEN;
    this.dispatchEvent(
      new MessageEvent("spine.connected", {
        data: JSON.stringify({ granted, denied }),
      }),
    );
  }

  /** Fire a named platform event with a JSON payload. */
  emitEvent(type: string, payload: Record<string, unknown>): void {
    this.dispatchEvent(
      new MessageEvent(type, { data: JSON.stringify({ type, ...payload }) }),
    );
  }

  /** Fire an `error` event after setting readyState (CONNECTING=transient, CLOSED=terminal). */
  emitError(readyState: number): void {
    this.readyState = readyState;
    this.dispatchEvent(new Event("error"));
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }
}
