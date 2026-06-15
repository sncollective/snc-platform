import { useCallback, useEffect, useRef, useState } from "react";

// ── Public Types ──

/** State returned by {@link usePolling}: the latest fetched value and whether the first fetch is still outstanding. */
export interface PollingState<T> {
  readonly data: T | null;
  readonly isLoading: boolean;
  /**
   * Trigger an immediate out-of-cycle fetch (e.g. a push/cache-invalidation signal).
   * Updates `data` like an interval tick; does not disturb the interval. No-op before
   * the first effect run.
   */
  readonly refetch: () => void;
}

/** Options controlling {@link usePolling} lifecycle. */
export interface PollingOptions<T> {
  /**
   * Seed value (e.g. SSR data). When provided (non-null), `isLoading` starts
   * `false` and the immediate first fetch is skipped unless `immediate` forces it.
   */
  readonly initial?: T | null;
  /**
   * Re-subscribe whenever this value changes — the poll loop tears down and
   * restarts, and `data` resets to `initial ?? null`. Use for a selected id the
   * fetcher closes over (e.g. a channel id). Defaults to a stable key.
   */
  readonly key?: unknown;
  /**
   * Fetch immediately on (re)subscribe instead of waiting one interval. Defaults
   * to `true` when no `initial` is supplied, `false` otherwise.
   */
  readonly immediate?: boolean;
}

// ── Public API ──

/**
 * Poll an async fetcher on a fixed interval with mount-safe teardown.
 *
 * Captures the recursive-`setTimeout` + `mountedRef` pattern shared by the
 * playout queue poll and the live channel-list poll: the timer only reschedules
 * while mounted, state is never set after unmount, and transient fetch errors are
 * swallowed (the last known `data` is preserved, `isLoading` clears).
 *
 * @param fetcher - Produces the next value. Re-created closures are fine; the
 *   loop always calls the latest one.
 * @param intervalMs - Delay between the end of one fetch and the start of the next.
 * @param options - Seed/re-subscription/immediacy controls; see {@link PollingOptions}.
 * @returns The latest value (or `null` before the first success) plus `isLoading`.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  options: PollingOptions<T> = {},
): PollingState<T> {
  const { initial = null, key, immediate = initial === null } = options;

  const [state, setState] = useState<Omit<PollingState<T>, "refetch">>({
    data: initial,
    isLoading: initial === null,
  });

  // Keep the loop calling the freshest fetcher without re-subscribing on every
  // render-new closure (only `key` drives re-subscription).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Points at the live effect's out-of-cycle fetch; populated per effect run.
  const triggerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    setState({ data: initial, isLoading: initial === null });

    // A bare fetch (no rescheduling) — used by the interval loop AND refetch.
    const fetchOnce = async (): Promise<void> => {
      try {
        const next = await fetcherRef.current();
        if (mounted) setState({ data: next, isLoading: false });
      } catch {
        // Transient failure — keep the last known value, just clear loading.
        if (mounted) setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    const poll = async (): Promise<void> => {
      await fetchOnce();
      if (mounted) {
        timeoutId = setTimeout(() => void poll(), intervalMs);
      }
    };

    triggerRef.current = () => void fetchOnce();

    if (immediate) {
      void poll();
    } else {
      timeoutId = setTimeout(() => void poll(), intervalMs);
    }

    return () => {
      mounted = false;
      triggerRef.current = null;
      clearTimeout(timeoutId);
    };
    // `initial` is a stable seed; re-subscription is driven by `key` + interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs, immediate]);

  // Stable identity; forwards to the current effect's fetch (no-op pre-mount).
  const refetch = useCallback(() => {
    triggerRef.current?.();
  }, []);

  return { ...state, refetch };
}
