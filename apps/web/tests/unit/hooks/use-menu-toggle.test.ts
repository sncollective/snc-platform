import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";

import { useMenuToggle } from "../../../src/hooks/use-menu-toggle.js";

// ── Tests ──

describe("useMenuToggle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isOpen starts false", () => {
    const ref = createRef<HTMLElement | null>();
    const { result } = renderHook(() => useMenuToggle(ref));

    expect(result.current.isOpen).toBe(false);
  });

  it("handleToggle opens the menu", () => {
    const ref = createRef<HTMLElement | null>();
    const { result } = renderHook(() => useMenuToggle(ref));

    act(() => {
      result.current.handleToggle();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("handleToggle closes the menu when already open", () => {
    const ref = createRef<HTMLElement | null>();
    const { result } = renderHook(() => useMenuToggle(ref));

    act(() => {
      result.current.handleToggle();
    });
    act(() => {
      result.current.handleToggle();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("handleClose closes the menu without toggling", () => {
    const ref = createRef<HTMLElement | null>();
    const { result } = renderHook(() => useMenuToggle(ref));

    act(() => {
      result.current.handleToggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.handleClose();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("Escape key closes the menu when open", () => {
    const ref = createRef<HTMLElement | null>();
    const { result } = renderHook(() => useMenuToggle(ref));

    act(() => {
      result.current.handleToggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("Escape key does nothing when menu is already closed", () => {
    const ref = createRef<HTMLElement | null>();
    const { result } = renderHook(() => useMenuToggle(ref));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("click outside closes the menu when open", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    // Create a ref pointing to the container element
    const ref = { current: container };
    const { result } = renderHook(() => useMenuToggle(ref));

    act(() => {
      result.current.handleToggle();
    });
    expect(result.current.isOpen).toBe(true);

    // Click outside — on document.body, not on container
    act(() => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(result.current.isOpen).toBe(false);

    document.body.removeChild(container);
  });

  it("click inside the ref element does not close the menu", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const ref = { current: container };
    const { result } = renderHook(() => useMenuToggle(ref));

    act(() => {
      result.current.handleToggle();
    });
    expect(result.current.isOpen).toBe(true);

    // Click inside the container element
    act(() => {
      container.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
    });

    expect(result.current.isOpen).toBe(true);

    document.body.removeChild(container);
  });

  it("registers event listeners when open and removes them when closed", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const ref = createRef<HTMLElement | null>();
    const { result } = renderHook(() => useMenuToggle(ref));

    // No listeners before opening
    expect(addSpy).not.toHaveBeenCalled();

    act(() => {
      result.current.handleToggle();
    });

    // Listeners added when opened
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));

    act(() => {
      result.current.handleClose();
    });

    // Listeners removed when closed
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
  });
});
