import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const { mockCreateBooking } = vi.hoisted(() => ({
  mockCreateBooking: vi.fn(),
}));

vi.mock("../../../src/lib/booking.js", () => ({
  createBooking: mockCreateBooking,
}));

// ── Import component under test (after mocks) ──

import { BookingForm } from "../../../src/components/booking/booking-form.js";
import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";

// ── Test Lifecycle ──

const defaultProps = {
  serviceId: "svc_test",
  serviceName: "Recording Session",
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  mockCreateBooking.mockReset();
  defaultProps.onSubmit = vi.fn();
  defaultProps.onCancel = vi.fn();
});

// ── Tests ──

describe("BookingForm", () => {
  // ── Rendering Tests ──

  it("renders service name as heading", () => {
    render(<BookingForm {...defaultProps} />);

    expect(
      screen.getByRole("heading", { name: /book: recording session/i }),
    ).toBeInTheDocument();
  });

  it("starts with one date input", () => {
    render(<BookingForm {...defaultProps} />);

    expect(screen.getByLabelText("Preferred date 1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Preferred date 2")).toBeNull();
  });

  // ── Date Management Tests ──

  it("'Add another date' button adds a date input", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /add another date/i }));

    expect(screen.getByLabelText("Preferred date 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Preferred date 2")).toBeInTheDocument();
  });

  it("adds date inputs up to maximum of 5", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add another date/i });
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(screen.getByLabelText("Preferred date 5")).toBeInTheDocument();
    expect(screen.queryByLabelText("Preferred date 6")).toBeNull();
    expect(screen.getByRole("button", { name: /add another date/i })).toBeDisabled();
  });

  it("'Add another date' button is disabled at 5 dates", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add another date/i });
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(addButton).toBeDisabled();
  });

  it("remove button removes a date input", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /add another date/i }));
    expect(screen.getByLabelText("Preferred date 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove date 2/i }));

    expect(screen.queryByLabelText("Preferred date 2")).toBeNull();
    expect(screen.getByLabelText("Preferred date 1")).toBeInTheDocument();
  });

  it("remove button is disabled when only 1 date input remains", () => {
    render(<BookingForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: /remove date 1/i })).toBeDisabled();
  });

  // ── Validation Tests ──

  it("validation rejects empty preferred dates", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Date cannot be empty");
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  it("validation rejects notes exceeding 2000 characters", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText("Preferred date 1"), "March 15, 2026");
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "a".repeat(2001) },
    });
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Notes cannot exceed 2000 characters",
    );
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  // ── Submission Tests ──

  it("submit calls createBooking with correct data", async () => {
    const user = userEvent.setup();
    mockCreateBooking.mockResolvedValue(makeMockBookingWithService());
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText("Preferred date 1"), "March 15, 2026");
    await user.type(screen.getByLabelText("Notes"), "Afternoon preferred");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(mockCreateBooking).toHaveBeenCalledWith({
        serviceId: "svc_test",
        preferredDates: ["March 15, 2026"],
        notes: "Afternoon preferred",
      });
    });
  });

  it("submit button is disabled while submitting", async () => {
    const user = userEvent.setup();
    mockCreateBooking.mockReturnValue(new Promise(() => {}));
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText("Preferred date 1"), "March 15, 2026");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
    });
  });

  it("on success, calls onSubmit callback", async () => {
    const user = userEvent.setup();
    mockCreateBooking.mockResolvedValue(makeMockBookingWithService());
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText("Preferred date 1"), "March 15, 2026");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("on API error, displays error message", async () => {
    const user = userEvent.setup();
    mockCreateBooking.mockRejectedValue(new Error("Service not found"));
    render(<BookingForm {...defaultProps} />);

    await user.type(screen.getByLabelText("Preferred date 1"), "March 15, 2026");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Service not found");
    });
  });

  // ── Cancel Test ──

  it("cancel button calls onCancel callback", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
