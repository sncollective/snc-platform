import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockChangePassword } = vi.hoisted(() => ({
  mockChangePassword: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    changePassword: mockChangePassword,
  },
}));

// ── Component Under Test ──

import { ChangePasswordForm } from "../../../src/components/auth/change-password-form.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockChangePassword.mockReset();
});

// ── Tests ──

describe("ChangePasswordForm", () => {
  it("renders three password fields", () => {
    render(<ChangePasswordForm />);

    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("validates empty current password", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(screen.getByText("Current password is required")).toBeInTheDocument();
  });

  it("validates short new password", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "oldpass");
    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm new password"), "short");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(
      screen.getByText("New password must be at least 8 characters"),
    ).toBeInTheDocument();
  });

  it("validates password mismatch", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "oldpass123");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm new password"), "different1");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("calls authClient.changePassword on valid submit", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue({ data: {}, error: null });
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "oldpass123");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: "oldpass123",
        newPassword: "newpass123",
        revokeOtherSessions: true,
      });
    });
  });

  it("shows success message and clears fields", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue({ data: {}, error: null });
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "oldpass123");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Password changed successfully",
      );
    });

    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("shows server error on failure", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue({
      data: null,
      error: { message: "Incorrect password" },
    });
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "wrongpass1");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Incorrect password");
    });
  });

  it("shows generic error on network failure", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockRejectedValue(new Error("Network error"));
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "oldpass123");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to change password",
      );
    });
  });

  it("disables submit button while submitting", async () => {
    const user = userEvent.setup();
    mockChangePassword.mockReturnValue(new Promise(() => {}));
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "oldpass123");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /changing password/i });
      expect(button).toBeDisabled();
    });
  });
});
