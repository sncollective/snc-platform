import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCreatorListItem } from "../../helpers/creator-fixtures.js";
import { makeMockPlan } from "../../helpers/subscription-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createAuthMock } from "../../helpers/auth-mock.js";

// ── Hoisted Mocks ──

const { mockUseSession, mockCreateCheckout, mockNavigateExternal } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockCreateCheckout: vi.fn(),
  mockNavigateExternal: vi.fn(),
}));

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession }),
);

vi.mock("../../../src/lib/subscription.js", () => ({
  createCheckout: mockCreateCheckout,
}));

vi.mock("../../../src/lib/url.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, navigateExternal: mockNavigateExternal };
});

vi.mock("@tanstack/react-router", () => createRouterMock());

// ── Import component under test (after mocks) ──

import { CreatorHeader } from "../../../src/components/creator/creator-header.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseSession.mockReturnValue({ data: { user: { id: "user-1" } } });
  mockCreateCheckout.mockResolvedValue("https://checkout.stripe.com/test");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("CreatorHeader", () => {
  // ── Existing tests (preserved, adapted to new mocks) ──

  it("renders display name as heading", () => {
    const creator = makeMockCreatorListItem({ displayName: "Alice Music" });
    render(<CreatorHeader creator={creator} />);
    expect(screen.getByRole("heading", { level: 1, name: "Alice Music" })).toBeInTheDocument();
  });

  it("renders banner image when bannerUrl is present", () => {
    const creator = makeMockCreatorListItem({
      displayName: "Alice Music",
      bannerUrl: "/api/creators/creator-1/banner",
    });
    render(<CreatorHeader creator={creator} />);
    const banner = screen.getByRole("img", { name: "Alice Music banner" });
    expect(banner).toHaveAttribute("src", "/api/creators/creator-1/banner");
  });

  it("renders banner placeholder when bannerUrl is null", () => {
    const creator = makeMockCreatorListItem({ bannerUrl: null });
    render(<CreatorHeader creator={creator} />);
    expect(screen.queryByRole("img", { name: /banner/ })).toBeNull();
  });

  it("renders avatar image when avatarUrl is present", () => {
    const creator = makeMockCreatorListItem({
      displayName: "Alice Music",
      avatarUrl: "/api/creators/creator-1/avatar",
    });
    render(<CreatorHeader creator={creator} />);
    const avatar = screen.getByRole("img", { name: "Alice Music avatar" });
    expect(avatar).toHaveAttribute("src", "/api/creators/creator-1/avatar");
  });

  it("renders avatar placeholder when avatarUrl is null", () => {
    const creator = makeMockCreatorListItem({ avatarUrl: null });
    render(<CreatorHeader creator={creator} />);
    expect(screen.queryByRole("img", { name: /avatar/ })).toBeNull();
  });

  it("renders bio paragraphs split on double newlines", () => {
    const creator = makeMockCreatorListItem({
      bio: "First paragraph.\n\nSecond paragraph.",
    });
    render(<CreatorHeader creator={creator} />);
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
  });

  it("does not render bio when bio is null", () => {
    const creator = makeMockCreatorListItem({
      displayName: "No Bio Creator",
      bio: null,
    });
    render(<CreatorHeader creator={creator} />);
    expect(screen.getByText("No Bio Creator")).toBeInTheDocument();
    expect(screen.queryByText("A test creator bio")).toBeNull();
  });

  it("renders single-paragraph bio without splitting", () => {
    const creator = makeMockCreatorListItem({
      bio: "Just one paragraph of bio text.",
    });
    render(<CreatorHeader creator={creator} />);
    expect(screen.getByText("Just one paragraph of bio text.")).toBeInTheDocument();
  });

  // ── New tests: subscribe button hidden when no plans ──

  it("does not render subscribe button when plans is undefined", () => {
    const creator = makeMockCreatorListItem();
    render(<CreatorHeader creator={creator} />);
    expect(screen.queryByRole("button", { name: /subscribe/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /subscribe/i })).toBeNull();
  });

  it("does not render subscribe button when plans is empty", () => {
    const creator = makeMockCreatorListItem();
    render(<CreatorHeader creator={creator} plans={[]} />);
    expect(screen.queryByRole("button", { name: /subscribe/i })).toBeNull();
  });

  // ── New tests: subscribed state ──

  it("shows 'Subscribed' disabled badge when isSubscribed is true", () => {
    const creator = makeMockCreatorListItem();
    const plans = [makeMockPlan({ type: "creator", creatorId: creator.userId })];
    render(<CreatorHeader creator={creator} plans={plans} isSubscribed />);
    const button = screen.getByRole("button", { name: /subscribed/i });
    expect(button).toBeDisabled();
  });

  it("'Subscribed' button has accessible label", () => {
    const creator = makeMockCreatorListItem();
    const plans = [makeMockPlan({ type: "creator", creatorId: creator.userId })];
    render(<CreatorHeader creator={creator} plans={plans} isSubscribed />);
    expect(
      screen.getByLabelText("Already subscribed to this creator"),
    ).toBeInTheDocument();
  });

  // ── New tests: unauthenticated ──

  it("shows login link for unauthenticated users when plans exist", () => {
    mockUseSession.mockReturnValue({ data: null });
    const creator = makeMockCreatorListItem();
    const plans = [makeMockPlan({ type: "creator", creatorId: creator.userId })];
    render(<CreatorHeader creator={creator} plans={plans} />);
    const link = screen.getByRole("link", { name: /subscribe/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  // ── New tests: single plan ──

  it("renders subscribe button with price for single plan", () => {
    const creator = makeMockCreatorListItem();
    const plans = [makeMockPlan({ price: 999, interval: "month", type: "creator", creatorId: creator.userId })];
    render(<CreatorHeader creator={creator} plans={plans} />);
    const button = screen.getByRole("button", { name: /subscribe/i });
    expect(button).toBeInTheDocument();
    expect(button.textContent).toContain("$9.99");
    expect(button.textContent).toContain("mo");
  });

  it("subscribe button calls createCheckout with plan ID on click", async () => {
    const user = userEvent.setup();
    const creator = makeMockCreatorListItem();
    const plans = [makeMockPlan({ id: "plan-creator-1", type: "creator", creatorId: creator.userId })];
    render(<CreatorHeader creator={creator} plans={plans} />);

    await user.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(mockCreateCheckout).toHaveBeenCalledWith("plan-creator-1");
  });

  it("subscribe button is disabled during checkout loading", async () => {
    const user = userEvent.setup();
    // Make createCheckout hang (never resolves) to test loading state
    mockCreateCheckout.mockReturnValue(new Promise(() => {}));
    const creator = makeMockCreatorListItem();
    const plans = [makeMockPlan({ type: "creator", creatorId: creator.userId })];
    render(<CreatorHeader creator={creator} plans={plans} />);

    await user.click(screen.getByRole("button", { name: /subscribe/i }));
    const button = screen.getByRole("button", { name: /subscribing/i });
    expect(button).toBeDisabled();
  });

  // ── New tests: multiple plans ──

  it("renders tier selector dropdown when multiple plans exist", () => {
    const creator = makeMockCreatorListItem();
    const plans = [
      makeMockPlan({ id: "p1", name: "Basic", price: 499, type: "creator", creatorId: creator.userId }),
      makeMockPlan({ id: "p2", name: "Premium", price: 999, type: "creator", creatorId: creator.userId }),
    ];
    render(<CreatorHeader creator={creator} plans={plans} />);
    const select = screen.getByRole("combobox", { name: /select subscription tier/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByText(/Basic/)).toBeInTheDocument();
    expect(screen.getByText(/Premium/)).toBeInTheDocument();
  });

  it("multi-plan subscribe button uses selected plan ID", async () => {
    const user = userEvent.setup();
    const creator = makeMockCreatorListItem();
    const plans = [
      makeMockPlan({ id: "p1", name: "Basic", price: 499, type: "creator", creatorId: creator.userId }),
      makeMockPlan({ id: "p2", name: "Premium", price: 999, type: "creator", creatorId: creator.userId }),
    ];
    render(<CreatorHeader creator={creator} plans={plans} />);

    const select = screen.getByRole("combobox", { name: /select subscription tier/i });
    await user.selectOptions(select, "p2");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(mockCreateCheckout).toHaveBeenCalledWith("p2");
  });
});
