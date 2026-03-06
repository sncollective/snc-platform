import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

import { makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";

// ── Hoisted Mocks ──

const {
  mockFetchMySubscriptions,
  mockCancelSubscription,
  mockConfirm,
} = vi.hoisted(() => ({
  mockFetchMySubscriptions: vi.fn(),
  mockCancelSubscription: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
    }),
    redirect: vi.fn(),
    Link: ({
      to,
      children,
      className,
    }: Record<string, unknown>) =>
      React.createElement(
        "a",
        { href: to as string, className },
        children as React.ReactNode,
      ),
  };
});

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({ user: { id: "u1" }, roles: [] }),
}));

vi.mock("../../../src/lib/subscription.js", () => ({
  fetchMySubscriptions: mockFetchMySubscriptions,
  cancelSubscription: mockCancelSubscription,
}));

// ── Component Under Test ──

let SubscriptionManagementPage: () => React.ReactElement;

beforeAll(async () => {
  const mod = await import(
    "../../../src/routes/settings/subscriptions.js"
  );
  SubscriptionManagementPage = (
    mod.Route as unknown as { component: () => React.ReactElement }
  ).component;
});

// ── Test Lifecycle ──

beforeEach(() => {
  mockFetchMySubscriptions.mockResolvedValue([
    makeMockUserSubscription({ id: "sub-1", status: "active" }),
  ]);
  mockCancelSubscription.mockResolvedValue(undefined);
  mockConfirm.mockReturnValue(true);
  vi.stubGlobal("confirm", mockConfirm);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("SubscriptionManagementPage", () => {
  it("renders page heading 'My Subscriptions'", async () => {
    render(<SubscriptionManagementPage />);
    expect(
      screen.getByRole("heading", { name: "My Subscriptions" }),
    ).toBeInTheDocument();
  });

  it("shows loading state while fetching subscriptions", () => {
    mockFetchMySubscriptions.mockReturnValue(new Promise(() => {}));
    render(<SubscriptionManagementPage />);
    expect(screen.getByText("Loading subscriptions...")).toBeInTheDocument();
  });

  it("renders subscriptions via SubscriptionList after loading", async () => {
    render(<SubscriptionManagementPage />);
    await waitFor(() => {
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });
  });

  it("renders empty state when user has no subscriptions", async () => {
    mockFetchMySubscriptions.mockResolvedValue([]);
    render(<SubscriptionManagementPage />);
    await waitFor(() => {
      expect(screen.getByText("No active subscriptions")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /browse plans/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("shows confirmation dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(false);

    render(<SubscriptionManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /cancel subscription/i }),
    );

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringContaining("Are you sure"),
    );
  });

  it("does not call cancelSubscription when user declines confirmation", async () => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(false);

    render(<SubscriptionManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /cancel subscription/i }),
    );

    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("calls cancelSubscription and refreshes list on confirmed cancel", async () => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(true);
    mockCancelSubscription.mockResolvedValue(undefined);
    // After cancel, refetch returns updated subscription
    mockFetchMySubscriptions
      .mockResolvedValueOnce([
        makeMockUserSubscription({ id: "sub-1", status: "active" }),
      ])
      .mockResolvedValue([
        makeMockUserSubscription({
          id: "sub-1",
          status: "active",
          cancelAtPeriodEnd: true,
        }),
      ]);

    render(<SubscriptionManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /cancel subscription/i }),
    );

    await waitFor(() => {
      expect(mockCancelSubscription).toHaveBeenCalledWith("sub-1");
    });

    // After refresh, SubscriptionList shows canceling state
    await waitFor(() => {
      expect(screen.getByText("Canceling")).toBeInTheDocument();
    });
  });

  it("shows error message when initial fetch fails", async () => {
    mockFetchMySubscriptions.mockRejectedValue(new Error("Network error"));

    render(<SubscriptionManagementPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load subscriptions",
      );
    });
  });

  it("shows error message when cancellation fails", async () => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(true);
    mockCancelSubscription.mockRejectedValue(
      new Error("Subscription already canceled"),
    );

    render(<SubscriptionManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /cancel subscription/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Subscription already canceled",
      );
    });
  });

  it("renders multiple subscriptions", async () => {
    mockFetchMySubscriptions.mockResolvedValue([
      makeMockUserSubscription({ id: "sub-1" }),
      makeMockUserSubscription({
        id: "sub-2",
        plan: {
          ...makeMockUserSubscription().plan,
          name: "Creator Tier",
          type: "creator",
        },
      }),
    ]);

    render(<SubscriptionManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });
    expect(screen.getByText("Creator Tier")).toBeInTheDocument();
  });

  it("confirmation message mentions access until billing period ends", async () => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(false);

    render(<SubscriptionManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /cancel subscription/i }),
    );

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringContaining("current billing period"),
    );
  });
});
