import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const { mockUseGuestRedirect } = vi.hoisted(() => ({
  mockUseGuestRedirect: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => createRouterMock());

vi.mock("../../../src/hooks/use-guest-redirect.js", () => ({
  useGuestRedirect: mockUseGuestRedirect,
}));

vi.mock("../../../src/lib/auth-client.js", () => ({
  authClient: {
    forgetPassword: vi.fn(),
  },
}));

// ── Component Under Test ──

const Page = extractRouteComponent(
  () => import("../../../src/routes/forgot-password.js"),
);

// ── Tests ──

describe("ForgotPasswordPage", () => {
  it("renders heading and form when guest", () => {
    mockUseGuestRedirect.mockReturnValue(true);
    render(<Page />);

    expect(
      screen.getByRole("heading", { name: /reset your password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders login link", () => {
    mockUseGuestRedirect.mockReturnValue(true);
    render(<Page />);

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("renders nothing when authenticated (guest redirect)", () => {
    mockUseGuestRedirect.mockReturnValue(false);
    const { container } = render(<Page />);

    expect(container.innerHTML).toBe("");
  });
});
