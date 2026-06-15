import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const {
  mockUseSession,
  mockSendVerificationOtp,
  mockSignInEmailOtp,
  mockApiMutate,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockSendVerificationOtp: vi.fn(),
  mockSignInEmailOtp: vi.fn(),
  mockApiMutate: vi.fn(),
}));

vi.mock("../../../src/lib/auth.js", () => ({ useSession: mockUseSession }));
vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mockSendVerificationOtp },
    signIn: { emailOtp: mockSignInEmailOtp },
  },
}));
vi.mock("../../../src/lib/fetch-utils.js", () => ({ apiMutate: mockApiMutate }));

import { NotifyMeForm } from "../../../src/components/live/notify-me-form.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSession.mockReturnValue({ data: null });
  mockSendVerificationOtp.mockResolvedValue({ error: null });
  mockSignInEmailOtp.mockResolvedValue({ error: null });
  mockApiMutate.mockResolvedValue({ ok: true });
});

const renderForm = () =>
  render(<NotifyMeForm channelId="ch-1" channelName="S/NC TV" />);

describe("NotifyMeForm", () => {
  it("logged-in: one-click subscribe calls the API and confirms", async () => {
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } } });
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: /Notify me when S\/NC TV is live/ }),
    );

    await waitFor(() =>
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/notify-when-live",
        expect.objectContaining({ body: expect.objectContaining({ channelId: "ch-1" }) }),
      ),
    );
    expect(screen.getByText(/we'll email you/)).toBeInTheDocument();
  });

  it("anonymous: requires consent before submitting", async () => {
    renderForm();
    const submit = screen.getByRole("button", { name: "Notify me" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Notify me when S\/NC TV is live/), "x@y.com");
    expect(submit).toBeDisabled(); // still — no consent

    await userEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("anonymous: sending the email advances to the OTP step", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/Notify me when S\/NC TV is live/), "x@y.com");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Notify me" }));

    await waitFor(() =>
      expect(mockSendVerificationOtp).toHaveBeenCalledWith({
        email: "x@y.com",
        type: "sign-in",
      }),
    );
    expect(screen.getByLabelText(/Enter the code/)).toBeInTheDocument();
  });

  it("anonymous: verifying the OTP signs in and subscribes", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/Notify me when S\/NC TV is live/), "x@y.com");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Notify me" }));

    await userEvent.type(await screen.findByLabelText(/Enter the code/), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mockSignInEmailOtp).toHaveBeenCalled());
    await waitFor(() => expect(mockApiMutate).toHaveBeenCalled());
    expect(screen.getByText(/we'll email you/)).toBeInTheDocument();
  });
});
