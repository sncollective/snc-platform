import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted Mocks ──

const {
  mockCreateCalendarEvent,
  mockUpdateCalendarEvent,
  mockCreateCreatorEvent,
  mockUpdateCreatorEvent,
  mockFetchEventTypes,
  mockCreateCustomEventType,
} = vi.hoisted(() => ({
  mockCreateCalendarEvent: vi.fn(),
  mockUpdateCalendarEvent: vi.fn(),
  mockCreateCreatorEvent: vi.fn(),
  mockUpdateCreatorEvent: vi.fn(),
  mockFetchEventTypes: vi.fn(),
  mockCreateCustomEventType: vi.fn(),
}));

vi.mock("../../../src/lib/calendar.js", () => ({
  createCalendarEvent: mockCreateCalendarEvent,
  updateCalendarEvent: mockUpdateCalendarEvent,
  createCreatorEvent: mockCreateCreatorEvent,
  updateCreatorEvent: mockUpdateCreatorEvent,
  fetchEventTypes: mockFetchEventTypes,
  createCustomEventType: mockCreateCustomEventType,
}));

vi.mock("../../../src/lib/project.js", () => ({
  fetchProjects: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}));

// ── Import component under test (after mocks) ──

import { EventForm } from "../../../src/components/calendar/event-form.js";
import { makeMockCalendarEvent } from "../../helpers/calendar-fixtures.js";

// ── Helpers ──

const defaultProps = {
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

const mockEventTypes = {
  items: [
    { id: "et1", slug: "recording-session", label: "Recording Session" },
    { id: "et2", slug: "show", label: "Show" },
    { id: "et3", slug: "meeting", label: "Meeting" },
    { id: "et4", slug: "other", label: "Other" },
  ],
};

async function fillMinimalForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/title/i), "Test Event");
  // Wait for event types to load from the mock fetch
  await waitFor(() => {
    expect(screen.getByRole("option", { name: "Show" })).toBeInTheDocument();
  });
  await user.selectOptions(screen.getByLabelText(/event type/i), "show");
  await user.type(screen.getByLabelText(/start date/i), "2026-04-01");
}

// ── Test Lifecycle ──

beforeEach(() => {
  mockCreateCalendarEvent.mockReset();
  mockUpdateCalendarEvent.mockReset();
  mockCreateCreatorEvent.mockReset();
  mockUpdateCreatorEvent.mockReset();
  mockFetchEventTypes.mockResolvedValue(mockEventTypes);
  mockCreateCustomEventType.mockResolvedValue({ id: "et-new", slug: "new-type", label: "New Type" });
  defaultProps.onSuccess = vi.fn();
  defaultProps.onCancel = vi.fn();
});

// ── Tests ──

describe("EventForm", () => {
  it("renders the New Event heading when no event prop is given", () => {
    render(<EventForm {...defaultProps} />);
    expect(
      screen.getByRole("heading", { name: "New Event" }),
    ).toBeInTheDocument();
  });

  it("renders Edit Event heading when an event is provided", () => {
    const event = makeMockCalendarEvent();
    render(<EventForm {...defaultProps} event={event} />);
    expect(
      screen.getByRole("heading", { name: "Edit Event" }),
    ).toBeInTheDocument();
  });

  it("renders the event type input field", () => {
    render(<EventForm {...defaultProps} />);
    expect(screen.getByLabelText(/event type/i)).toBeInTheDocument();
  });

  it("shows a validation error if title is empty on submit", async () => {
    const user = userEvent.setup();
    render(<EventForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<EventForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it("fetches event types on mount", async () => {
    render(<EventForm {...defaultProps} />);
    await waitFor(() => {
      expect(mockFetchEventTypes).toHaveBeenCalled();
    });
  });
});

describe("EventForm with creatorId", () => {
  it("calls createCreatorEvent when creatorId is provided", async () => {
    const user = userEvent.setup();
    mockCreateCreatorEvent.mockResolvedValue(makeMockCalendarEvent());
    render(<EventForm {...defaultProps} creatorId="creator-123" />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(mockCreateCreatorEvent).toHaveBeenCalledOnce();
      expect(mockCreateCreatorEvent).toHaveBeenCalledWith(
        "creator-123",
        expect.objectContaining({ title: "Test Event" }),
      );
    });
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
    expect(defaultProps.onSuccess).toHaveBeenCalledOnce();
  });

  it("calls updateCreatorEvent when creatorId is provided and editing", async () => {
    const user = userEvent.setup();
    const event = makeMockCalendarEvent({ id: "evt-abc" });
    mockUpdateCreatorEvent.mockResolvedValue(event);
    render(<EventForm {...defaultProps} event={event} creatorId="creator-123" />);

    // Change the title to trigger form submit with a known value
    const titleInput = screen.getByRole("textbox", { name: /title/i });
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateCreatorEvent).toHaveBeenCalledOnce();
      expect(mockUpdateCreatorEvent).toHaveBeenCalledWith(
        "creator-123",
        "evt-abc",
        expect.objectContaining({ title: "Updated Title" }),
      );
    });
    expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();
    expect(defaultProps.onSuccess).toHaveBeenCalledOnce();
  });

  it("calls createCalendarEvent when creatorId is omitted", async () => {
    const user = userEvent.setup();
    mockCreateCalendarEvent.mockResolvedValue(makeMockCalendarEvent());
    render(<EventForm {...defaultProps} />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(mockCreateCalendarEvent).toHaveBeenCalledOnce();
    });
    expect(mockCreateCreatorEvent).not.toHaveBeenCalled();
    expect(defaultProps.onSuccess).toHaveBeenCalledOnce();
  });
});
