import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockHistoryBack } = vi.hoisted(() => ({
  mockHistoryBack: vi.fn(),
}));

beforeEach(() => {
  window.history.back = mockHistoryBack;
});

// ── Component Under Test ──

const { ErrorPage } = await import("../../../../src/components/error/error-page.js");

// ── Tests ──

describe("ErrorPage", () => {
  it("renders status code", () => {
    render(<ErrorPage statusCode={404} title="Not found" />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders title as heading", () => {
    render(<ErrorPage statusCode={500} title="Something went wrong" />);
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <ErrorPage
        statusCode={404}
        title="Not found"
        description="The page doesn't exist."
      />,
    );
    expect(screen.getByText("The page doesn't exist.")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<ErrorPage statusCode={404} title="Not found" />);
    expect(
      screen.queryByText("The page doesn't exist."),
    ).not.toBeInTheDocument();
  });

  it("renders retry button when showRetry and onRetry are provided", () => {
    const onRetry = vi.fn();
    render(
      <ErrorPage statusCode={500} title="Error" showRetry onRetry={onRetry} />,
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("does not render retry button when showRetry is false", () => {
    render(<ErrorPage statusCode={404} title="Not found" />);
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ErrorPage statusCode={500} title="Error" showRetry onRetry={onRetry} />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders go back button", () => {
    render(<ErrorPage statusCode={404} title="Not found" />);
    expect(
      screen.getByRole("button", { name: "Go back" }),
    ).toBeInTheDocument();
  });

  it("calls router.history.back when go back is clicked", async () => {
    const user = userEvent.setup();
    render(<ErrorPage statusCode={404} title="Not found" />);
    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(mockHistoryBack).toHaveBeenCalledOnce();
  });

  it("renders go home link", () => {
    render(<ErrorPage statusCode={404} title="Not found" />);
    const link = screen.getByRole("link", { name: "Go home" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
