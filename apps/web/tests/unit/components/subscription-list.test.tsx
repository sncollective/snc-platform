import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../helpers/router-mock.js";
import { createFormatMock } from "../../helpers/format-mock.js";

const { mockFormatDate } = vi.hoisted(() => ({
  mockFormatDate: vi.fn(),
}));

vi.mock("../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/format.js")>();
  return createFormatMock({ formatDate: mockFormatDate }, actual);
});

vi.mock("@tanstack/react-router", () => createRouterMock());

import { SubscriptionList } from "../../../src/components/subscription/subscription-list.js";
import { makeMockUserSubscription } from "../../helpers/subscription-fixtures.js";

beforeEach(() => {
  mockFormatDate.mockReturnValue("Mar 1, 2026");
});

describe("SubscriptionList", () => {
  it("renders empty state with link to pricing when no subscriptions", () => {
    render(<SubscriptionList subscriptions={[]} onCancel={vi.fn()} />);
    expect(screen.getByText("No active subscriptions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse plans/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("renders subscription plan name", () => {
    const sub = makeMockUserSubscription();
    render(<SubscriptionList subscriptions={[sub]} onCancel={vi.fn()} />);
    expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
  });

  it("renders subscription status as 'Active'", () => {
    const sub = makeMockUserSubscription({ status: "active", cancelAtPeriodEnd: false });
    render(<SubscriptionList subscriptions={[sub]} onCancel={vi.fn()} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows next billing date for active subscriptions", () => {
    const sub = makeMockUserSubscription({ status: "active", cancelAtPeriodEnd: false });
    render(<SubscriptionList subscriptions={[sub]} onCancel={vi.fn()} />);
    expect(screen.getByText(/next billing/i)).toBeInTheDocument();
  });

  it("shows 'Canceling' status and access-until message when cancelAtPeriodEnd is true", () => {
    const sub = makeMockUserSubscription({
      status: "active",
      cancelAtPeriodEnd: true,
    });
    render(<SubscriptionList subscriptions={[sub]} onCancel={vi.fn()} />);
    expect(screen.getByText("Canceling")).toBeInTheDocument();
    expect(screen.getByText(/canceling — access until/i)).toBeInTheDocument();
  });

  it("cancel button calls onCancel with subscription ID", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const sub = makeMockUserSubscription({ id: "sub-99" });
    render(<SubscriptionList subscriptions={[sub]} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel subscription/i }));
    expect(onCancel).toHaveBeenCalledWith("sub-99");
  });

  it("cancel button is disabled when cancelAtPeriodEnd is true", () => {
    const sub = makeMockUserSubscription({ cancelAtPeriodEnd: true });
    render(<SubscriptionList subscriptions={[sub]} onCancel={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /cancel subscription/i }),
    ).toBeDisabled();
  });

  it("cancel button is disabled when status is not active", () => {
    const sub = makeMockUserSubscription({ status: "canceled" });
    render(<SubscriptionList subscriptions={[sub]} onCancel={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /cancel subscription/i }),
    ).toBeDisabled();
  });

  it("renders multiple subscriptions", () => {
    const subs = [
      makeMockUserSubscription({ id: "sub-1" }),
      makeMockUserSubscription({
        id: "sub-2",
        plan: {
          ...makeMockUserSubscription().plan,
          name: "Creator Tier",
          type: "creator",
        },
      }),
    ];
    render(<SubscriptionList subscriptions={subs} onCancel={vi.fn()} />);
    expect(screen.getByText("S/NC All Access")).toBeInTheDocument();
    expect(screen.getByText("Creator Tier")).toBeInTheDocument();
  });

  it("shows plan type label", () => {
    const sub = makeMockUserSubscription();
    render(<SubscriptionList subscriptions={[sub]} onCancel={vi.fn()} />);
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });
});
