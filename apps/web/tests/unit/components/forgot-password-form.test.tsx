import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockSendVerificationOtp, mockResetPassword } = vi.hoisted(() => ({
  mockSendVerificationOtp: vi.fn(),
  mockResetPassword: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: mockSendVerificationOtp,
      resetPassword: mockResetPassword,
    },
  },
}));

// ── Component Under Test ──

import { ForgotPasswordForm } from "../../../src/components/auth/forgot-password-form.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockSendVerificationOtp.mockReset();
  mockResetPassword.mockReset();
});

// ── Tests ──

describe("ForgotPasswordForm", () => {
  describe("step 1: email", () => {
    it("renders email field and send button", () => {
      render(<ForgotPasswordForm />);

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /send reset code/i }),
      ).toBeInTheDocument();
    });

    it("validates email format", async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("Email"), "not-an-email");
      await user.click(
        screen.getByRole("button", { name: /send reset code/i }),
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please enter a valid email address",
      );
    });

    it("sends OTP on valid email", async () => {
      const user = userEvent.setup();
      mockSendVerificationOtp.mockResolvedValue({ data: {}, error: null });
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: /send reset code/i }),
      );

      await waitFor(() => {
        expect(mockSendVerificationOtp).toHaveBeenCalledWith({
          email: "user@example.com",
          type: "forget-password",
        });
      });
    });

    it("advances to OTP step on success", async () => {
      const user = userEvent.setup();
      mockSendVerificationOtp.mockResolvedValue({ data: {}, error: null });
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: /send reset code/i }),
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Reset code")).toBeInTheDocument();
      });
    });

    it("shows error when send fails", async () => {
      const user = userEvent.setup();
      mockSendVerificationOtp.mockResolvedValue({
        data: null,
        error: { message: "Server error" },
      });
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: /send reset code/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Password reset is not available at this time",
        );
      });
    });

    it("shows error on network failure", async () => {
      const user = userEvent.setup();
      mockSendVerificationOtp.mockRejectedValue(new Error("Network error"));
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: /send reset code/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Password reset is not available at this time",
        );
      });
    });

    it("disables button while submitting", async () => {
      const user = userEvent.setup();
      mockSendVerificationOtp.mockReturnValue(new Promise(() => {}));
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: /send reset code/i }),
      );

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /sending/i });
        expect(button).toBeDisabled();
      });
    });
  });

  describe("step 2: reset password", () => {
    const advanceToOtpStep = async () => {
      const user = userEvent.setup();
      mockSendVerificationOtp.mockResolvedValue({ data: {}, error: null });
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: /send reset code/i }),
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Reset code")).toBeInTheDocument();
      });

      return user;
    };

    it("renders OTP and password fields", async () => {
      await advanceToOtpStep();

      expect(screen.getByLabelText("Reset code")).toBeInTheDocument();
      expect(screen.getByLabelText("New password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reset password/i }),
      ).toBeInTheDocument();
    });

    it("validates required fields", async () => {
      const user = await advanceToOtpStep();

      await user.click(
        screen.getByRole("button", { name: /reset password/i }),
      );

      await waitFor(() => {
        expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("validates password match", async () => {
      const user = await advanceToOtpStep();

      await user.type(screen.getByLabelText("Reset code"), "123456");
      await user.type(screen.getByLabelText("New password"), "newpassword1");
      await user.type(
        screen.getByLabelText("Confirm password"),
        "different123",
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Passwords do not match",
        );
      });
    });

    it("calls resetPassword with correct params", async () => {
      const user = await advanceToOtpStep();
      mockResetPassword.mockResolvedValue({ data: {}, error: null });

      await user.type(screen.getByLabelText("Reset code"), "123456");
      await user.type(screen.getByLabelText("New password"), "newpassword1");
      await user.type(
        screen.getByLabelText("Confirm password"),
        "newpassword1",
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i }),
      );

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith({
          email: "user@example.com",
          otp: "123456",
          password: "newpassword1",
        });
      });
    });

    it("shows success message on completion", async () => {
      const user = await advanceToOtpStep();
      mockResetPassword.mockResolvedValue({ data: {}, error: null });

      await user.type(screen.getByLabelText("Reset code"), "123456");
      await user.type(screen.getByLabelText("New password"), "newpassword1");
      await user.type(
        screen.getByLabelText("Confirm password"),
        "newpassword1",
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          "Your password has been reset successfully",
        );
      });
    });

    it("shows server error on reset failure", async () => {
      const user = await advanceToOtpStep();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: { message: "Invalid OTP" },
      });

      await user.type(screen.getByLabelText("Reset code"), "000000");
      await user.type(screen.getByLabelText("New password"), "newpassword1");
      await user.type(
        screen.getByLabelText("Confirm password"),
        "newpassword1",
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid OTP");
      });
    });

    it("shows error on network failure", async () => {
      const user = await advanceToOtpStep();
      mockResetPassword.mockRejectedValue(new Error("Network error"));

      await user.type(screen.getByLabelText("Reset code"), "123456");
      await user.type(screen.getByLabelText("New password"), "newpassword1");
      await user.type(
        screen.getByLabelText("Confirm password"),
        "newpassword1",
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Failed to reset password",
        );
      });
    });
  });
});
