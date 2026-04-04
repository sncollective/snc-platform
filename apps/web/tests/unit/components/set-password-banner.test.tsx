import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockApiGet, mockSendVerificationOtp } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockSendVerificationOtp: vi.fn(),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiGet: mockApiGet,
}));

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: mockSendVerificationOtp,
    },
  },
}));

// ── Component Under Test ──

import { SetPasswordBanner } from "../../../src/components/auth/set-password-banner.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockApiGet.mockReset();
  mockSendVerificationOtp.mockReset();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ── Tests ──

describe("SetPasswordBanner", () => {
  it("does not render when user has a password", async () => {
    mockApiGet.mockResolvedValue({ hasPassword: true });

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/api/me/providers");
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders banner when user has no password", async () => {
    mockApiGet.mockResolvedValue({ hasPassword: false });

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    expect(screen.getByText(/Set up an S\/NC password/)).toBeInTheDocument();
  });

  it("does not render when dismissed via localStorage", async () => {
    localStorage.setItem("snc-set-password-dismissed", "true");
    mockApiGet.mockResolvedValue({ hasPassword: false });

    render(<SetPasswordBanner email="user@example.com" />);

    // Give it time to potentially render
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // Should not even call the API when already dismissed
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("hides banner and persists dismissal to localStorage on dismiss", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({ hasPassword: false });

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(localStorage.getItem("snc-set-password-dismissed")).toBe("true");
  });

  it("shows form when Set password is clicked", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({ hasPassword: false });

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(screen.getByRole("button", { name: "Send verification code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls emailOtp API and shows success message on submit", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({ hasPassword: false });
    mockSendVerificationOtp.mockResolvedValue({});

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Set password" }));
    await user.click(screen.getByRole("button", { name: "Send verification code" }));

    await waitFor(() => {
      expect(mockSendVerificationOtp).toHaveBeenCalledWith({
        email: "user@example.com",
        type: "forget-password",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Check your email/)).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: "forgot password page" });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("shows error message on API failure", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({ hasPassword: false });
    mockSendVerificationOtp.mockRejectedValue(new Error("Network error"));

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Set password" }));
    await user.click(screen.getByRole("button", { name: "Send verification code" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to start password setup. Try again later.",
      );
    });
  });

  it("disables submit button while submitting", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({ hasPassword: false });
    mockSendVerificationOtp.mockReturnValue(new Promise(() => {}));

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Set password" }));
    await user.click(screen.getByRole("button", { name: "Send verification code" }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Sending code/i });
      expect(button).toBeDisabled();
    });
  });

  it("returns to actions view when Cancel is clicked", async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({ hasPassword: false });

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Set password" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("silently fails and does not show banner on API error", async () => {
    mockApiGet.mockRejectedValue(new Error("Network error"));

    render(<SetPasswordBanner email="user@example.com" />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
