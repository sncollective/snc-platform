import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockApiMutate } = vi.hoisted(() => ({
  mockApiMutate: vi.fn(),
}));

vi.mock("../../../../src/lib/fetch-utils.js", () => ({
  apiMutate: mockApiMutate,
  apiGet: vi.fn(),
  throwIfNotOk: vi.fn(),
}));

// ── Component Under Test ──

import { StudioInquiryForm } from "../../../../src/components/studio/studio-inquiry-form.js";

// ── Test Lifecycle ──

beforeEach(() => {
  mockApiMutate.mockReset();
  mockApiMutate.mockResolvedValue({ success: true });
});

// ── Helpers ──

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("Name"), "Jane Smith");
  await user.type(screen.getByLabelText("Email"), "jane@example.com");
  await user.type(
    screen.getByLabelText("Message"),
    "This is a test message that is long enough to pass validation.",
  );
};

// ── Tests ──

describe("StudioInquiryForm", () => {
  // ── Rendering ──

  it("renders name, email, service, and message fields", () => {
    render(<StudioInquiryForm />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Service")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("renders the service select with all studio services", () => {
    render(<StudioInquiryForm />);

    const select = screen.getByLabelText("Service");
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(4);
    expect(options[0]?.textContent).toBe("Recording");
    expect(options[1]?.textContent).toBe("Podcast Production");
    expect(options[2]?.textContent).toBe("Practice Space");
    expect(options[3]?.textContent).toBe("Venue Hire");
  });

  it("renders a submit button", () => {
    render(<StudioInquiryForm />);

    expect(screen.getByRole("button", { name: "Send Inquiry" })).toBeInTheDocument();
  });

  // ── Validation ──

  it("shows field errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    render(<StudioInquiryForm />);

    await user.click(screen.getByRole("button", { name: "Send Inquiry" }));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
    expect(mockApiMutate).not.toHaveBeenCalled();
  });

  it("shows email validation error for invalid email", async () => {
    const user = userEvent.setup();
    render(<StudioInquiryForm />);

    await user.type(screen.getByLabelText("Name"), "Jane");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Message"), "This is a valid message.");

    await user.click(screen.getByRole("button", { name: "Send Inquiry" }));

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address"),
      ).toBeInTheDocument();
    });
    expect(mockApiMutate).not.toHaveBeenCalled();
  });

  it("shows error when message is too short", async () => {
    const user = userEvent.setup();
    render(<StudioInquiryForm />);

    await user.type(screen.getByLabelText("Name"), "Jane");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Message"), "Too short");

    await user.click(screen.getByRole("button", { name: "Send Inquiry" }));

    await waitFor(() => {
      expect(
        screen.getByText("Message must be at least 10 characters"),
      ).toBeInTheDocument();
    });
    expect(mockApiMutate).not.toHaveBeenCalled();
  });

  // ── Submission ──

  it("calls the API with valid form data", async () => {
    const user = userEvent.setup();
    render(<StudioInquiryForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send Inquiry" }));

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/studio/inquiry",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            name: "Jane Smith",
            email: "jane@example.com",
            service: "recording",
          }),
        }),
      );
    });
  });

  it("shows success state after successful submission", async () => {
    const user = userEvent.setup();
    render(<StudioInquiryForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send Inquiry" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Inquiry Sent")).toBeInTheDocument();
      expect(
        screen.getByText(/thanks for getting in touch/i),
      ).toBeInTheDocument();
    });
  });

  it("shows server error message on API failure", async () => {
    mockApiMutate.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    render(<StudioInquiryForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send Inquiry" }));

    await waitFor(() => {
      expect(
        screen.getByText(/something went wrong/i),
      ).toBeInTheDocument();
    });
  });

  it("submit button is disabled while submitting", async () => {
    let resolveSubmit!: () => void;
    mockApiMutate.mockReturnValue(
      new Promise<{ success: true }>((resolve) => {
        resolveSubmit = () => resolve({ success: true });
      }),
    );

    const user = userEvent.setup();
    render(<StudioInquiryForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send Inquiry" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    });

    resolveSubmit();
  });
});
