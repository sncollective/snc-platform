import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { usePolling } from "../../../src/hooks/use-polling.js";

const advancePollingClock = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("seeds initial data and waits until the first interval before fetching", async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue("polled");

    const { result } = renderHook(() =>
      usePolling(fetcher, 1_000, { initial: "seed" }),
    );

    expect(result.current.data).toBe("seed");
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();

    await advancePollingClock(999);
    expect(fetcher).not.toHaveBeenCalled();

    await advancePollingClock(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("polled");
    expect(result.current.isLoading).toBe(false);
  });

  it("refetches out-of-cycle without disturbing the interval", async () => {
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("manual")
      .mockResolvedValue("timer");

    const { result } = renderHook(() =>
      usePolling(fetcher, 1_000, { initial: "seed" }),
    );
    const refetch = result.current.refetch;

    await act(async () => {
      result.current.refetch();
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("manual");
    expect(result.current.refetch).toBe(refetch);

    await advancePollingClock(999);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await advancePollingClock(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe("timer");
  });

  it("resets to the new initial value and restarts polling when the key changes", async () => {
    const fetchA = vi.fn<() => Promise<string>>().mockResolvedValue("fetched-a");
    const fetchB = vi.fn<() => Promise<string>>().mockResolvedValue("fetched-b");

    const { result, rerender } = renderHook(
      ({ channelId }: { channelId: "a" | "b" }) =>
        usePolling(
          channelId === "a" ? fetchA : fetchB,
          1_000,
          { initial: `seed-${channelId}`, key: channelId },
        ),
      { initialProps: { channelId: "a" as const } },
    );

    expect(result.current.data).toBe("seed-a");

    await advancePollingClock(1_000);
    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("fetched-a");

    rerender({ channelId: "b" });

    expect(result.current.data).toBe("seed-b");
    expect(result.current.isLoading).toBe(false);
    expect(fetchB).not.toHaveBeenCalled();

    await advancePollingClock(1_000);
    expect(fetchB).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("fetched-b");
  });

  it("clears the pending timeout and does not fetch after unmount", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue("late");

    const { unmount } = renderHook(() =>
      usePolling(fetcher, 1_000, { initial: "seed" }),
    );

    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    await advancePollingClock(1_000);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
