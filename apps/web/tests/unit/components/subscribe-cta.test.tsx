import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockPlan } from "../../helpers/subscription-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockCreateCheckout, mockUsePlatformAuth, mockNavigateExternal } = vi.hoisted(
  () => ({
    mockCreateCheckout: vi.fn(),
    mockUsePlatformAuth: vi.fn(),
    mockNavigateExternal: vi.fn(),
  }),
);

vi.mock("../../../src/lib/subscription.js", () => ({
  createCheckout: mockCreateCheckout,
}));

vi.mock("../../../src/hooks/use-platform-auth.js", () => ({
  usePlatformAuth: mockUsePlatformAuth,
}));

vi.mock("../../../src/lib/url.js", () => ({
  navigateExternal: mockNavigateExternal,
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Component Under Test ──

import { SubscribeCta } from "../../../src/components/content/subscribe-cta.js";

// ── Lifecycle ──

beforeEach(() => {
  mockUsePlatformAuth.mockReturnValue({ isAuthenticated: true, isSubscribed: false });
  mockCreateCheckout.mockResolvedValue("https://checkout.stripe.com/test");
});

// ── Tests ──

describe("SubscribeCta", () => {
  it('renders "Subscribe to watch" heading for video content type', () => {
    render(<SubscribeCta contentType="video" plans={[makeMockPlan()]} />);
    expect(screen.getByText("Subscribe to watch")).toBeInTheDocument();
  });

  it('renders "Subscribe to listen" heading for audio content type', () => {
    render(<SubscribeCta contentType="audio" plans={[makeMockPlan()]} />);
    expect(screen.getByText("Subscribe to listen")).toBeInTheDocument();
  });

  it('renders "Subscribe to read" heading for written content type', () => {
    render(<SubscribeCta contentType="written" plans={[makeMockPlan()]} />);
    expect(screen.getByText("Subscribe to read")).toBeInTheDocument();
  });

  it("shows plan price and Subscribe button when plans exist", () => {
    render(
      <SubscribeCta
        contentType="video"
        plans={[makeMockPlan({ price: 999, interval: "month" })]}
      />,
    );
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
  });

  it("Subscribe button calls createCheckout with plan ID", async () => {
    const user = userEvent.setup();
    const plan = makeMockPlan({ id: "plan-42" });

    render(<SubscribeCta contentType="video" plans={[plan]} />);

    await user.click(screen.getByRole("button", { name: /^subscribe$/i }));
    expect(mockCreateCheckout).toHaveBeenCalledWith("plan-42");
  });

  it("shows link to /pricing page", () => {
    render(<SubscribeCta contentType="video" plans={[makeMockPlan()]} />);
    expect(screen.getByRole("link", { name: /subscribe to the platform/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("unauthenticated user sees Subscribe link pointing to /login", () => {
    mockUsePlatformAuth.mockReturnValue({ isAuthenticated: false, isSubscribed: false });

    render(<SubscribeCta contentType="video" plans={[makeMockPlan()]} />);

    const subscribeLink = screen.getByRole("link", { name: /^subscribe$/i });
    expect(subscribeLink).toHaveAttribute("href", "/login");
  });

  it("shows only pricing link when creator has no plans", () => {
    render(<SubscribeCta contentType="video" plans={[]} />);
    expect(screen.queryByText("$")).toBeNull();
    expect(screen.getByRole("link", { name: /subscribe to the platform/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("selects cheapest plan when multiple plans provided", () => {
    const plans = [
      makeMockPlan({ id: "expensive", price: 1999, interval: "month" }),
      makeMockPlan({ id: "cheap", price: 499, interval: "month" }),
      makeMockPlan({ id: "mid", price: 999, interval: "month" }),
    ];
    render(<SubscribeCta contentType="video" plans={plans} />);
    expect(screen.getByText("$4.99")).toBeInTheDocument();
  });
});
