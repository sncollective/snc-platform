import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

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

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: vi.fn() }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({ user: { id: "u1" }, roles: [] }),
}));

vi.mock("../../../src/lib/subscription.js", () => ({
  fetchMySubscriptions: mockFetchMySubscriptions,
  cancelSubscription: mockCancelSubscription,
}));

// ── Component Under Test ──

const SubscriptionManagementPage = extractRouteComponent(() => import("../../../src/routes/settings/subscriptions.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockFetchMySubscriptions.mockResolvedValue([
    makeMockUserSubscription({ id: "sub-1", status: "active" }),
  ]);
  mockCancelSubscription.mockResolvedValue(
    makeMockUserSubscription({ id: "sub-1", status: "active", cancelAtPeriodEnd: true }),
  );
  mockConfirm.mockReturnValue(true);
  vi.stubGlobal("confirm", mockConfirm);
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

  it("calls cancelSubscription and updates list with returned data", async () => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(true);
    // cancelSubscription returns the updated subscription directly
    mockCancelSubscription.mockResolvedValue(
      makeMockUserSubscription({
        id: "sub-1",
        status: "active",
        cancelAtPeriodEnd: true,
      }),
    );

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

    // List updated optimistically with returned data (no refetch needed)
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
