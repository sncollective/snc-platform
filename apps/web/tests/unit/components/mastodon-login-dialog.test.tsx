import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockApiMutate, mockNavigateExternal, mockOnClose } = vi.hoisted(() => ({
  mockApiMutate: vi.fn(),
  mockNavigateExternal: vi.fn(),
  mockOnClose: vi.fn(),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiMutate: mockApiMutate,
}));

vi.mock("../../../src/lib/url.js", () => ({
  navigateExternal: mockNavigateExternal,
}));

// ── Import component under test (after mocks) ──

import { MastodonLoginDialog } from "../../../src/components/auth/mastodon-login-dialog.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockApiMutate.mockReset();
  mockNavigateExternal.mockReset();
  mockOnClose.mockReset();
  // jsdom doesn't implement showModal/close on <dialog>; simulate open attribute
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

// ── Tests ──

describe("MastodonLoginDialog", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <MastodonLoginDialog open={false} onClose={mockOnClose} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when open is true", () => {
    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    expect(screen.getByText("Log in with Mastodon")).toBeInTheDocument();
    expect(screen.getByLabelText("Your Mastodon instance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("disables submit when domain is empty", () => {
    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("enables submit when domain is entered", async () => {
    const user = userEvent.setup();
    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.type(screen.getByLabelText("Your Mastodon instance"), "mastodon.social");

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("strips protocol prefix from domain before submitting", async () => {
    const user = userEvent.setup();
    mockApiMutate.mockResolvedValue({ authorizationUrl: "https://mastodon.social/oauth/authorize" });

    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.type(screen.getByLabelText("Your Mastodon instance"), "https://mastodon.social");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/auth/mastodon/start",
        { body: { domain: "mastodon.social" } },
      );
    });
  });

  it("strips trailing slash from domain before submitting", async () => {
    const user = userEvent.setup();
    mockApiMutate.mockResolvedValue({ authorizationUrl: "https://mastodon.social/oauth/authorize" });

    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.type(screen.getByLabelText("Your Mastodon instance"), "mastodon.social/");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/auth/mastodon/start",
        { body: { domain: "mastodon.social" } },
      );
    });
  });

  it("strips @ prefix from domain before submitting", async () => {
    const user = userEvent.setup();
    mockApiMutate.mockResolvedValue({ authorizationUrl: "https://mastodon.social/oauth/authorize" });

    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.type(screen.getByLabelText("Your Mastodon instance"), "@mastodon.social");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/auth/mastodon/start",
        { body: { domain: "mastodon.social" } },
      );
    });
  });

  it("redirects to authorizationUrl on success", async () => {
    const user = userEvent.setup();
    const authUrl = "https://mastodon.social/oauth/authorize?client_id=xyz";
    mockApiMutate.mockResolvedValue({ authorizationUrl: authUrl });

    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.type(screen.getByLabelText("Your Mastodon instance"), "mastodon.social");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mockNavigateExternal).toHaveBeenCalledWith(authUrl);
    });
  });

  it("shows error message on API failure", async () => {
    const user = userEvent.setup();
    mockApiMutate.mockRejectedValue(new Error("Instance not found"));

    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.type(screen.getByLabelText("Your Mastodon instance"), "bad.instance");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Instance not found");
    });
    expect(mockNavigateExternal).not.toHaveBeenCalled();
  });

  it("shows submitting state while loading", async () => {
    const user = userEvent.setup();
    mockApiMutate.mockReturnValue(new Promise(() => {}));

    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.type(screen.getByLabelText("Your Mastodon instance"), "mastodon.social");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connecting/i })).toBeDisabled();
    });
  });

  it("calls onClose when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<MastodonLoginDialog open={true} onClose={mockOnClose} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockOnClose).toHaveBeenCalledOnce();
  });
});
