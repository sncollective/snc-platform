import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PRIVACY_POLICY_VERSION } from "@snc/shared";

import { extractRouteComponent } from "../../helpers/route-test-utils.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData, mockUseSession,
  mockSendVerificationOtp, mockSignInEmailOtp, mockUpdateUser,
  mockApiMutate, mockHandleCheckout,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUseSession: vi.fn(),
  mockSendVerificationOtp: vi.fn(),
  mockSignInEmailOtp: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockApiMutate: vi.fn(),
  mockHandleCheckout: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useLoaderData: mockUseLoaderData }),
);
vi.mock("../../../src/lib/auth.js", () => ({ useSession: mockUseSession }));
vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mockSendVerificationOtp },
    signIn: { emailOtp: mockSignInEmailOtp },
    updateUser: mockUpdateUser,
  },
}));
vi.mock("../../../src/lib/fetch-utils.js", () => ({ apiMutate: mockApiMutate }));
vi.mock("../../../src/lib/api-server.js", () => ({ fetchApiServer: vi.fn() }));
vi.mock("../../../src/hooks/use-checkout.js", () => ({
  useCheckout: () => ({ checkoutLoading: false, handleCheckout: mockHandleCheckout }),
}));

const JoinPage = extractRouteComponent(() => import("../../../src/routes/join/$handle.js"));

const PAYLOAD = (overrides: Record<string, unknown> = {}) => ({
  creator: { id: "c1", handle: "band", displayName: "The Band", avatar: null, banner: null },
  config: { incentiveText: "Free sticker", showSncExplainer: true, showSubscribeCta: true },
  followerCount: 10,
  creatorPlans: [{ id: "p1", name: "Supporter", price: 500, interval: "month" }],
  sncPlans: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSession.mockReturnValue({ data: null, isPending: false });
  mockUseLoaderData.mockReturnValue(PAYLOAD());
  mockSendVerificationOtp.mockResolvedValue({ error: null });
  mockSignInEmailOtp.mockResolvedValue({ error: null });
  mockUpdateUser.mockResolvedValue({});
  mockApiMutate.mockResolvedValue({ ok: true });
});

describe("Join flow", () => {
  it("anonymous happy path: capture → code → welcome (one OTP email, no others)", async () => {
    render(<JoinPage />);

    await userEvent.type(screen.getByLabelText("Your name"), "Fan");
    await userEvent.type(screen.getByLabelText("Email"), "fan@example.com");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(mockSendVerificationOtp).toHaveBeenCalledWith({ email: "fan@example.com", type: "sign-in" }),
    );

    await userEvent.type(await screen.findByLabelText(/Enter the code/), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mockSignInEmailOtp).toHaveBeenCalled());
    expect(mockUpdateUser).toHaveBeenCalledWith({ name: "Fan" });
    expect(mockApiMutate).toHaveBeenCalledWith(
      "/api/join/c1/complete",
      { body: { consent: true, policyVersion: PRIVACY_POLICY_VERSION } },
    );
    expect(await screen.findByText(/You're in/)).toBeInTheDocument();
    // No outbound email other than the OTP send.
    expect(mockSendVerificationOtp).toHaveBeenCalledTimes(1);
  });

  it("consent unchecked → cannot request OTP", async () => {
    render(<JoinPage />);
    await userEvent.type(screen.getByLabelText("Your name"), "Fan");
    await userEvent.type(screen.getByLabelText("Email"), "fan@example.com");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("authed visitor short-circuits to one-tap follow", async () => {
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    render(<JoinPage />);

    await userEvent.click(screen.getByRole("button", { name: /Follow The Band/ }));
    await waitFor(() =>
      expect(mockApiMutate).toHaveBeenCalledWith("/api/join/c1/complete", {
        body: { consent: true, policyVersion: PRIVACY_POLICY_VERSION },
      }),
    );
    // No OTP for an already-authed visitor.
    expect(mockSendVerificationOtp).not.toHaveBeenCalled();
  });

  it("logged-in session resolving AFTER mount shows the one-tap path (not a dead-end)", async () => {
    // The bug: useSession starts pending/null on the client and resolves post-mount.
    // Seeding step from the initial isLoggedIn left a logged-in fan stranded.
    mockUseSession.mockReturnValue({ data: null, isPending: true });
    const { rerender } = render(<JoinPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    // Session resolves to logged-in.
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    rerender(<JoinPage />);

    expect(screen.getByRole("button", { name: /Follow The Band/ })).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("explainer + CTA hidden when both config flags are off", async () => {
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    mockUseLoaderData.mockReturnValue(
      PAYLOAD({ config: { incentiveText: null, showSncExplainer: false, showSubscribeCta: false } }),
    );
    render(<JoinPage />);

    await userEvent.click(screen.getByRole("button", { name: /Follow The Band/ }));
    // preferences step
    await userEvent.click(await screen.findByRole("button", { name: "Save & continue" }));
    // both flags off → skip explainer straight to done
    expect(await screen.findByText(/all set/)).toBeInTheDocument();
    expect(screen.queryByText(/What is S\/NC/)).not.toBeInTheDocument();
  });
});
