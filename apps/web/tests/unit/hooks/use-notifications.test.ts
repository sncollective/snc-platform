import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import type { InboxNotification } from "@snc/shared";

// ── Hoisted Mocks ──

const { mockApiGet, mockApiMutate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiMutate: vi.fn(),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiGet: mockApiGet,
  apiMutate: mockApiMutate,
}));

// ── Import hook under test (after mocks) ──

import { useNotifications } from "../../../src/hooks/use-notifications.js";

// ── Helpers ──

function makeNotification(overrides: Partial<InboxNotification> = {}): InboxNotification {
  return {
    id: "notif-1",
    type: "system",
    title: "Test notification",
    body: "Test body",
    actionUrl: null,
    read: false,
    createdAt: "2026-04-05T10:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ──

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: unread-count returns 0, so initialCount stays 0
    mockApiGet.mockResolvedValue({ count: 0 });
    mockApiMutate.mockResolvedValue(undefined);
  });

  it("seeds initialCount from REST on mount when count > 0", async () => {
    mockApiGet.mockResolvedValueOnce({ count: 5 });

    const { result } = renderHook(() => useNotifications());

    // Wait for the effect to run
    await act(async () => {});

    expect(mockApiGet).toHaveBeenCalledWith("/api/notifications/unread-count");
    expect(result.current.initialCount).toBe(5);
  });

  it("leaves initialCount at 0 when REST count is 0", async () => {
    mockApiGet.mockResolvedValueOnce({ count: 0 });

    const { result } = renderHook(() => useNotifications());

    await act(async () => {});

    expect(result.current.initialCount).toBe(0);
  });

  it("starts with empty notifications and isLoading false", () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("fetchNotifications sets isLoading true during fetch and false after", async () => {
    const notif = makeNotification();
    // First call is the unread-count seed; second is fetchNotifications
    mockApiGet
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ notifications: [notif], hasMore: false });

    const { result } = renderHook(() => useNotifications());

    await act(async () => {});

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.id).toBe("notif-1");
  });

  it("fetchNotifications calls /api/notifications with limit 10", async () => {
    mockApiGet
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ notifications: [], hasMore: false });

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(mockApiGet).toHaveBeenCalledWith("/api/notifications", { limit: 10 });
  });

  it("markRead PATCHes the notification and updates local state to read", async () => {
    const notif = makeNotification({ id: "notif-2", read: false });
    mockApiGet
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ notifications: [notif], hasMore: false });
    mockApiMutate.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});

    await act(async () => {
      await result.current.fetchNotifications();
    });

    await act(async () => {
      await result.current.markRead(notif);
    });

    expect(mockApiMutate).toHaveBeenCalledWith(
      "/api/notifications/notif-2/read",
      { method: "PATCH" },
    );
    expect(result.current.notifications[0]?.read).toBe(true);
  });

  it("markRead does not PATCH if notification is already read", async () => {
    const notif = makeNotification({ id: "notif-3", read: true });
    mockApiGet
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ notifications: [notif], hasMore: false });

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});

    await act(async () => {
      await result.current.fetchNotifications();
    });

    await act(async () => {
      await result.current.markRead(notif);
    });

    expect(mockApiMutate).not.toHaveBeenCalled();
  });

  it("markRead navigates to actionUrl when present", async () => {
    const originalHref = window.location.href;
    const notif = makeNotification({ id: "notif-4", read: false, actionUrl: "/content/some-slug" });
    mockApiGet
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ notifications: [notif], hasMore: false });
    mockApiMutate.mockResolvedValueOnce(undefined);

    // Spy on window.location.href setter
    const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      href: originalHref,
    } as Location);
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});

    await act(async () => {
      await result.current.fetchNotifications();
    });

    await act(async () => {
      await result.current.markRead(notif);
    });

    expect(window.location.href).toBe("/content/some-slug");

    locationSpy.mockRestore();
  });

  it("markAllRead POSTs to read-all, marks all notifications read, resets initialCount", async () => {
    const notif1 = makeNotification({ id: "n1", read: false });
    const notif2 = makeNotification({ id: "n2", read: false });
    mockApiGet
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ notifications: [notif1, notif2], hasMore: false });
    mockApiMutate.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useNotifications());
    await act(async () => {});

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(result.current.initialCount).toBe(3);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockApiMutate).toHaveBeenCalledWith(
      "/api/notifications/read-all",
      { method: "POST" },
    );
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
    expect(result.current.initialCount).toBe(0);
  });

  it("handles REST errors gracefully without throwing", async () => {
    mockApiGet.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useNotifications());

    // Should not throw
    await act(async () => {});

    expect(result.current.initialCount).toBe(0);
    expect(result.current.notifications).toHaveLength(0);
  });
});
