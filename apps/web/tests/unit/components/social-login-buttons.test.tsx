import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockSignInSocial, mockOnMastodonClick } = vi.hoisted(() => ({
  mockSignInSocial: vi.fn(),
  mockOnMastodonClick: vi.fn(),
}));

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    signIn: { social: mockSignInSocial },
  },
}));

// ── Config mock — no providers enabled by default ──

const mockSocialProviders = vi.hoisted(() => ({
  google: false,
  apple: false,
  twitch: false,
  mastodon: false,
}));

vi.mock("../../../src/lib/config.js", () => ({
  socialProviders: mockSocialProviders,
}));

// ── Import component under test (after mocks) ──

import { SocialLoginButtons } from "../../../src/components/auth/social-login-buttons.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockSignInSocial.mockReset();
  mockOnMastodonClick.mockReset();
  mockSocialProviders.google = false;
  mockSocialProviders.apple = false;
  mockSocialProviders.twitch = false;
  mockSocialProviders.mastodon = false;
});

// ── Tests ──

describe("SocialLoginButtons", () => {
  it("renders nothing when no providers are enabled", () => {
    const { container } = render(
      <SocialLoginButtons callbackURL="/feed" onMastodonClick={mockOnMastodonClick} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders divider and buttons when providers are enabled", () => {
    mockSocialProviders.google = true;

    render(
      <SocialLoginButtons callbackURL="/feed" onMastodonClick={mockOnMastodonClick} />,
    );

    expect(screen.getByText("or continue with")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
  });

  it("renders only enabled providers", () => {
    mockSocialProviders.google = true;
    mockSocialProviders.twitch = true;

    render(
      <SocialLoginButtons callbackURL="/feed" onMastodonClick={mockOnMastodonClick} />,
    );

    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Twitch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apple" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mastodon" })).toBeNull();
  });

  it("calls authClient.signIn.social on Google button click", async () => {
    const user = userEvent.setup();
    mockSocialProviders.google = true;
    mockSignInSocial.mockResolvedValue({});

    render(
      <SocialLoginButtons callbackURL="/dashboard" onMastodonClick={mockOnMastodonClick} />,
    );

    await user.click(screen.getByRole("button", { name: "Google" }));

    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/dashboard",
    });
  });

  it("calls authClient.signIn.social on Twitch button click", async () => {
    const user = userEvent.setup();
    mockSocialProviders.twitch = true;
    mockSignInSocial.mockResolvedValue({});

    render(
      <SocialLoginButtons callbackURL="/feed" onMastodonClick={mockOnMastodonClick} />,
    );

    await user.click(screen.getByRole("button", { name: "Twitch" }));

    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: "twitch",
      callbackURL: "/feed",
    });
  });

  it("calls onMastodonClick when Mastodon button is clicked", async () => {
    const user = userEvent.setup();
    mockSocialProviders.mastodon = true;

    render(
      <SocialLoginButtons callbackURL="/feed" onMastodonClick={mockOnMastodonClick} />,
    );

    await user.click(screen.getByRole("button", { name: "Mastodon" }));

    expect(mockOnMastodonClick).toHaveBeenCalledOnce();
    expect(mockSignInSocial).not.toHaveBeenCalled();
  });

  it("renders all four providers when all are enabled", () => {
    mockSocialProviders.google = true;
    mockSocialProviders.apple = true;
    mockSocialProviders.twitch = true;
    mockSocialProviders.mastodon = true;

    render(
      <SocialLoginButtons callbackURL="/feed" onMastodonClick={mockOnMastodonClick} />,
    );

    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Twitch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mastodon" })).toBeInTheDocument();
  });
});
