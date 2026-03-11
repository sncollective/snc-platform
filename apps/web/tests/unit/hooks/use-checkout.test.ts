import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted Mocks ──

const { mockCreateCheckout, mockNavigateExternal } = vi.hoisted(() => ({
  mockCreateCheckout: vi.fn(),
  mockNavigateExternal: vi.fn(),
}));

vi.mock("../../../src/lib/subscription.js", () => ({
  createCheckout: mockCreateCheckout,
}));

vi.mock("../../../src/lib/url.js", () => ({
  navigateExternal: mockNavigateExternal,
}));

// ── Import hook under test (after mocks) ──

import { useCheckout } from "../../../src/hooks/use-checkout.js";

// ── Tests ──

describe("useCheckout", () => {
  beforeEach(() => {
    mockCreateCheckout.mockResolvedValue("https://checkout.stripe.com/test");
  });

  it("returns checkoutLoading false initially", () => {
    const { result } = renderHook(() => useCheckout());

    expect(result.current.checkoutLoading).toBe(false);
  });

  it("calls createCheckout with planId and navigates to returned URL on success", async () => {
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.handleCheckout("plan-42");
    });

    expect(mockCreateCheckout).toHaveBeenCalledWith("plan-42");
    expect(mockNavigateExternal).toHaveBeenCalledWith("https://checkout.stripe.com/test");
  });

  it("sets checkoutLoading true during checkout", async () => {
    let resolve: (url: string) => void;
    mockCreateCheckout.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { result } = renderHook(() => useCheckout());

    act(() => {
      void result.current.handleCheckout("plan-42");
    });

    expect(result.current.checkoutLoading).toBe(true);

    await act(async () => {
      resolve!("https://checkout.stripe.com/test");
    });
  });

  it("resets checkoutLoading and does not navigate on failure", async () => {
    mockCreateCheckout.mockRejectedValue(new Error("Checkout failed"));
    mockNavigateExternal.mockClear();

    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.handleCheckout("plan-42");
    });

    expect(result.current.checkoutLoading).toBe(false);
    expect(mockNavigateExternal).not.toHaveBeenCalled();
  });

  it("calls onError callback with error message on failure", async () => {
    mockCreateCheckout.mockRejectedValue(new Error("Checkout failed"));
    const onError = vi.fn();

    const { result } = renderHook(() => useCheckout({ onError }));

    await act(async () => {
      await result.current.handleCheckout("plan-42");
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("Checkout failed");
  });

  it("calls onError with fallback message for non-Error throws", async () => {
    mockCreateCheckout.mockRejectedValue("unknown");
    const onError = vi.fn();

    const { result } = renderHook(() => useCheckout({ onError }));

    await act(async () => {
      await result.current.handleCheckout("plan-42");
    });

    expect(onError).toHaveBeenCalledWith("Failed to start checkout");
  });

  it("does not call onError on success", async () => {
    const onError = vi.fn();

    const { result } = renderHook(() => useCheckout({ onError }));

    await act(async () => {
      await result.current.handleCheckout("plan-42");
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
