import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockNavigate, mockSignInEmail, mockSignUpEmail } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignInEmail: vi.fn(),
  mockSignUpEmail: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useNavigate: () => mockNavigate }),
);

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    signIn: { email: mockSignInEmail },
    signUp: { email: mockSignUpEmail },
    signOut: vi.fn(),
  },
}));

// ── Import components under test (after mocks) ──

import { LoginForm } from "../../../src/components/auth/login-form.js";
import { RegisterForm } from "../../../src/components/auth/register-form.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockSignInEmail.mockReset();
  mockSignUpEmail.mockReset();
  mockNavigate.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("LoginForm", () => {
  it("validates email format", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter a valid email address",
    );
  });

  it("requires password", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Password is required");
  });

  it("calls signIn.email on valid submit", async () => {
    const user = userEvent.setup();
    mockSignInEmail.mockResolvedValue({ data: {}, error: null });
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/feed" });
  });

  it("shows server error on failed login", async () => {
    const user = userEvent.setup();
    mockSignInEmail.mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    });
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid email or password",
      );
    });
  });

  it("disables submit button while submitting", async () => {
    const user = userEvent.setup();
    mockSignInEmail.mockReturnValue(new Promise(() => {}));
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /logging in/i });
      expect(button).toBeDisabled();
    });
  });
});

describe("RegisterForm", () => {
  it("requires name", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
  });

  it("validates email format", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "bad-email");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter a valid email address",
    );
  });

  it("enforces minimum password length", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "shor");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Password must be at least 8 characters",
    );
  });

  it("calls signUp.email on valid submit", async () => {
    const user = userEvent.setup();
    mockSignUpEmail.mockResolvedValue({ data: {}, error: null });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUpEmail).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/feed" });
  });

  it("shows server error on duplicate email", async () => {
    const user = userEvent.setup();
    mockSignUpEmail.mockResolvedValue({
      data: null,
      error: { message: "Email already in use" },
    });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Email already in use",
      );
    });
  });

  it("disables submit button while submitting", async () => {
    const user = userEvent.setup();
    mockSignUpEmail.mockReturnValue(new Promise(() => {}));
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /creating account/i });
      expect(button).toBeDisabled();
    });
  });
});
