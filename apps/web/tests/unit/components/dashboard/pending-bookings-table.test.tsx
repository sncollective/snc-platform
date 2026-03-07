import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

import { createFormatMock } from "../../../helpers/format-mock.js";

const { mockFormatRelativeDate } = vi.hoisted(() => ({
  mockFormatRelativeDate: vi.fn(),
}));

vi.mock("../../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../../src/lib/format.js")
  >();
  return createFormatMock({ formatRelativeDate: mockFormatRelativeDate }, actual);
});

// ── Import component under test (after mocks) ──

import type { ReviewBookingRequest } from "@snc/shared";

import { PendingBookingsTable } from "../../../../src/components/dashboard/pending-bookings-table.js";

// ── Test fixtures ──

import { makeMockPendingBookingItem } from "../../../helpers/dashboard-fixtures.js";

// ── Tests ──

describe("PendingBookingsTable", () => {
  let onReview: ReturnType<typeof vi.fn<(id: string, data: ReviewBookingRequest) => Promise<void>>>;

  beforeEach(() => {
    onReview = vi.fn<(id: string, data: ReviewBookingRequest) => Promise<void>>().mockResolvedValue(undefined);
    mockFormatRelativeDate.mockReturnValue("2d ago");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Empty State ──

  it("shows empty state when no bookings provided", () => {
    render(
      <PendingBookingsTable bookings={[]} onReview={onReview} />,
    );
    expect(
      screen.getByText("No pending booking requests"),
    ).toBeDefined();
  });

  // ── Row Rendering ──

  it("renders booking rows with requester name, service name, and submission date", () => {
    const booking1 = makeMockPendingBookingItem({
      id: "bk_001",
      requester: { id: "u1", name: "Jane Doe", email: "jane@example.com" },
      service: {
        id: "svc_001",
        name: "Recording Session",
        description: "Studio session",
        pricingInfo: "$50/hr",
        active: true,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const booking2 = makeMockPendingBookingItem({
      id: "bk_002",
      requester: { id: "u2", name: "John Smith", email: "john@example.com" },
      service: {
        id: "svc_002",
        name: "Mixing Session",
        description: "Mix session",
        pricingInfo: "$75/hr",
        active: true,
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    render(
      <PendingBookingsTable
        bookings={[booking1, booking2]}
        onReview={onReview}
      />,
    );

    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("John Smith").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recording Session").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mixing Session").length).toBeGreaterThan(0);
    expect(mockFormatRelativeDate).toHaveBeenCalledWith(booking1.createdAt);
    expect(screen.getAllByText("2d ago").length).toBeGreaterThan(0);
  });

  it("shows first preferred date with '+N more' suffix for multiple dates", () => {
    const booking = makeMockPendingBookingItem({
      preferredDates: ["2026-03-15", "2026-03-20", "2026-03-25"],
    });

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    expect(screen.getAllByText("2026-03-15 (+2 more)").length).toBeGreaterThan(
      0,
    );
  });

  it("sets title attribute with all preferred dates", () => {
    const booking = makeMockPendingBookingItem({
      preferredDates: ["2026-03-15", "2026-03-20", "2026-03-25"],
    });

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    const elementsWithTitle = document.querySelectorAll(
      '[title="2026-03-15, 2026-03-20, 2026-03-25"]',
    );
    expect(elementsWithTitle.length).toBeGreaterThan(0);
  });

  // ── Approve Action ──

  it("approve button triggers onReview with status 'approved'", async () => {
    const user = userEvent.setup();
    const booking = makeMockPendingBookingItem({ id: "bk_pending_001" });

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[0]!);

    expect(onReview).toHaveBeenCalledWith("bk_pending_001", {
      status: "approved",
    });
  });

  // ── Deny Flow ──

  it("deny button shows note input with confirm and cancel buttons", async () => {
    const user = userEvent.setup();
    const booking = makeMockPendingBookingItem();

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    const denyButtons = screen.getAllByRole("button", { name: "Deny" });
    await user.click(denyButtons[0]!);

    expect(screen.getAllByLabelText("Review note").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Confirm" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Cancel" }).length).toBeGreaterThan(0);
  });

  it("deny confirmation calls onReview with status 'denied' and reviewNote", async () => {
    const user = userEvent.setup();
    const booking = makeMockPendingBookingItem({ id: "bk_pending_001" });

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    const denyButtons = screen.getAllByRole("button", { name: "Deny" });
    await user.click(denyButtons[0]!);

    const noteInputs = screen.getAllByLabelText("Review note");
    await user.type(noteInputs[0]!, "Not available");

    const confirmButtons = screen.getAllByRole("button", { name: "Confirm" });
    await user.click(confirmButtons[0]!);

    expect(onReview).toHaveBeenCalledWith("bk_pending_001", {
      status: "denied",
      reviewNote: "Not available",
    });
  });

  it("deny confirmation omits reviewNote when note is empty", async () => {
    const user = userEvent.setup();
    const booking = makeMockPendingBookingItem({ id: "bk_pending_001" });

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    const denyButtons = screen.getAllByRole("button", { name: "Deny" });
    await user.click(denyButtons[0]!);

    const confirmButtons = screen.getAllByRole("button", { name: "Confirm" });
    await user.click(confirmButtons[0]!);

    expect(onReview).toHaveBeenCalledWith("bk_pending_001", {
      status: "denied",
    });
    expect(onReview).not.toHaveBeenCalledWith(
      "bk_pending_001",
      expect.objectContaining({ reviewNote: expect.anything() }),
    );
  });

  it("cancel deny hides the note input and restores action buttons", async () => {
    const user = userEvent.setup();
    const booking = makeMockPendingBookingItem();

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    const denyButtons = screen.getAllByRole("button", { name: "Deny" });
    await user.click(denyButtons[0]!);

    expect(screen.getAllByLabelText("Review note").length).toBeGreaterThan(0);

    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await user.click(cancelButtons[0]!);

    expect(screen.queryAllByLabelText("Review note").length).toBe(0);
    expect(screen.getAllByRole("button", { name: "Approve" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Deny" }).length).toBeGreaterThan(0);
  });

  // ── Loading State ──

  it("disables action buttons when reviewingId matches booking ID", () => {
    const booking = makeMockPendingBookingItem({ id: "bk_pending_001" });

    render(
      <PendingBookingsTable
        bookings={[booking]}
        onReview={onReview}
        reviewingId="bk_pending_001"
      />,
    );

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    const denyButtons = screen.getAllByRole("button", { name: "Deny" });

    for (const btn of approveButtons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
    for (const btn of denyButtons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("does not disable action buttons for other bookings", () => {
    const booking1 = makeMockPendingBookingItem({ id: "bk_001" });
    const booking2 = makeMockPendingBookingItem({
      id: "bk_002",
      requester: { id: "u2", name: "John Smith", email: "john@example.com" },
    });

    render(
      <PendingBookingsTable
        bookings={[booking1, booking2]}
        onReview={onReview}
        reviewingId="bk_001"
      />,
    );

    // booking2's buttons should be enabled — find them by proximity to "John Smith"
    // Since both rows exist in table + card layout, check that at least some approve buttons are enabled
    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    const enabledApprove = approveButtons.filter(
      (btn) => !(btn as HTMLButtonElement).disabled,
    );
    expect(enabledApprove.length).toBeGreaterThan(0);
  });

  // ── formatRelativeDate integration ──

  it("renders submission date using formatRelativeDate", () => {
    const booking = makeMockPendingBookingItem({
      createdAt: "2026-02-25T10:00:00.000Z",
    });
    mockFormatRelativeDate.mockReturnValue("custom date");

    render(
      <PendingBookingsTable bookings={[booking]} onReview={onReview} />,
    );

    expect(mockFormatRelativeDate).toHaveBeenCalledWith(
      "2026-02-25T10:00:00.000Z",
    );
    expect(screen.getAllByText("custom date").length).toBeGreaterThan(0);
  });
});
