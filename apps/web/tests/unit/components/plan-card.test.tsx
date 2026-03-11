import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanCard } from "../../../src/components/subscription/plan-card.js";
import { makeMockPlan } from "../../helpers/subscription-fixtures.js";

describe("PlanCard", () => {
  it("renders plan name as heading", () => {
    const plan = makeMockPlan({ name: "Premium Monthly" });
    render(<PlanCard plan={plan} onSubscribe={vi.fn()} />);
    expect(screen.getByText("Premium Monthly")).toBeInTheDocument();
  });

  it("renders formatted price and interval", () => {
    const plan = makeMockPlan({ price: 999, interval: "month" });
    render(<PlanCard plan={plan} onSubscribe={vi.fn()} />);
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByText("/ month")).toBeInTheDocument();
  });

  it("renders yearly interval label", () => {
    const plan = makeMockPlan({ price: 9999, interval: "year" });
    render(<PlanCard plan={plan} onSubscribe={vi.fn()} />);
    expect(screen.getByText("$99.99")).toBeInTheDocument();
    expect(screen.getByText("/ year")).toBeInTheDocument();
  });

  it("calls onSubscribe with plan ID when subscribe button is clicked", async () => {
    const user = userEvent.setup();
    const onSubscribe = vi.fn();
    const plan = makeMockPlan({ id: "plan-42" });
    render(<PlanCard plan={plan} onSubscribe={onSubscribe} />);

    await user.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(onSubscribe).toHaveBeenCalledWith("plan-42");
  });

  it("shows 'Subscribed' badge when isSubscribed is true", () => {
    const plan = makeMockPlan();
    render(
      <PlanCard plan={plan} onSubscribe={vi.fn()} isSubscribed />,
    );
    const button = screen.getByRole("button", { name: /subscribed/i });
    expect(button).toBeDisabled();
  });

  it("shows loading state when isLoading is true", () => {
    const plan = makeMockPlan();
    render(
      <PlanCard plan={plan} onSubscribe={vi.fn()} isLoading />,
    );
    const button = screen.getByRole("button", { name: /subscribing/i });
    expect(button).toBeDisabled();
  });

  it("subscribe button is enabled by default", () => {
    const plan = makeMockPlan();
    render(<PlanCard plan={plan} onSubscribe={vi.fn()} />);
    const button = screen.getByRole("button", { name: /subscribe/i });
    expect(button).not.toBeDisabled();
  });
});
