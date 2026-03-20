import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

// Mock DatePickerInput to simplify — renders a text input that accepts YYYY-MM-DD
vi.mock("../../../src/components/calendar/date-picker-input.js", () => ({
  DatePickerInput: ({ id, value, onChange, hasError }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    hasError?: boolean;
  }) => (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-has-error={hasError}
      data-testid={`date-picker-${id ?? "unknown"}`}
    />
  ),
}));

// Mock TimePickerSelect to simplify — renders simple inputs for hour/minute/period
vi.mock("../../../src/components/calendar/time-picker-select.js", () => ({
  TimePickerSelect: ({ id, value, onChange }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={`time-picker-${id ?? "unknown"}`}
      aria-label={id === "event-start-time" ? "Start time" : "End time"}
    />
  ),
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
  // Set start date on the DatePickerInput mock (label is "Start date")
  fireEvent.change(screen.getByLabelText(/start date/i), {
    target: { value: "2026-04-01" },
  });
  // Set start time on the TimePickerSelect mock
  fireEvent.change(screen.getByTestId("time-picker-event-start-time"), {
    target: { value: "10:00" },
  });
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

  it("shows start date picker input", () => {
    render(<EventForm {...defaultProps} />);
    expect(screen.getByTestId("date-picker-event-start-date")).toBeInTheDocument();
  });

  it("does not show end date picker by default for a new event", () => {
    render(<EventForm {...defaultProps} />);
    expect(screen.queryByTestId("date-picker-event-end-date")).not.toBeInTheDocument();
  });

  it("shows + Add end date button by default for a new event", () => {
    render(<EventForm {...defaultProps} />);
    expect(screen.getByRole("button", { name: /add end date/i })).toBeInTheDocument();
  });

  it("shows time input for start when not all-day", () => {
    render(<EventForm {...defaultProps} />);
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
  });

  it("does not show end time by default for a new event", () => {
    render(<EventForm {...defaultProps} />);
    expect(screen.queryByLabelText(/end time/i)).not.toBeInTheDocument();
  });

  it("clicking + Add end date shows end date and end time fields", async () => {
    const user = userEvent.setup();
    render(<EventForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /add end date/i }));

    expect(screen.getByTestId("date-picker-event-end-date")).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add end date/i })).not.toBeInTheDocument();
  });

  it("clicking Remove end hides end fields and shows + Add end date button again", async () => {
    const user = userEvent.setup();
    render(<EventForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /add end date/i }));
    expect(screen.getByTestId("date-picker-event-end-date")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove end/i }));

    expect(screen.queryByTestId("date-picker-event-end-date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/end time/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add end date/i })).toBeInTheDocument();
  });

  it("hides time inputs when all-day is checked", async () => {
    const user = userEvent.setup();
    render(<EventForm {...defaultProps} />);

    await user.click(screen.getByLabelText(/all day/i));

    expect(screen.queryByLabelText(/start time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/end time/i)).not.toBeInTheDocument();
  });

  it("pre-populates date picker when editing an event", () => {
    const event = makeMockCalendarEvent({
      startAt: "2026-03-20T14:00:00.000Z",
      endAt: "2026-03-20T18:00:00.000Z",
      allDay: false,
    });
    render(<EventForm {...defaultProps} event={event} />);
    // The date picker mock receives the pre-populated date value
    const startDateInput = screen.getByTestId("date-picker-event-start-date");
    expect(startDateInput).toBeInTheDocument();
    // The value is the date portion in local timezone — just verify it's a date string
    expect((startDateInput as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows end fields when editing an event that has an endAt", () => {
    const event = makeMockCalendarEvent({
      startAt: "2026-03-20T14:00:00.000Z",
      endAt: "2026-03-20T18:00:00.000Z",
      allDay: false,
    });
    render(<EventForm {...defaultProps} event={event} />);
    expect(screen.getByTestId("date-picker-event-end-date")).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add end date/i })).not.toBeInTheDocument();
  });

  it("hides end fields when editing an event with no endAt", () => {
    const event = makeMockCalendarEvent({
      startAt: "2026-03-20T14:00:00.000Z",
      endAt: null,
      allDay: false,
    });
    render(<EventForm {...defaultProps} event={event} />);
    expect(screen.queryByTestId("date-picker-event-end-date")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add end date/i })).toBeInTheDocument();
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

describe("EventForm with creatorOptions", () => {
  const mockCreatorOptions = [
    { id: "creator-a", name: "Creator A" },
    { id: "creator-b", name: "Creator B" },
  ];

  it("renders a creator dropdown when creatorOptions is provided and not editing", () => {
    render(<EventForm {...defaultProps} creatorOptions={mockCreatorOptions} />);
    expect(screen.getByLabelText(/creator \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "None (platform event)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Creator A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Creator B" })).toBeInTheDocument();
  });

  it("does not render a creator dropdown when creatorOptions is not provided", () => {
    render(<EventForm {...defaultProps} />);
    expect(screen.queryByLabelText(/creator \(optional\)/i)).not.toBeInTheDocument();
  });

  it("does not render creator dropdown when editing an existing event", () => {
    const event = makeMockCalendarEvent();
    render(<EventForm {...defaultProps} event={event} creatorOptions={mockCreatorOptions} />);
    expect(screen.queryByLabelText(/creator \(optional\)/i)).not.toBeInTheDocument();
  });

  it("calls createCreatorEvent with the selected creator when one is chosen", async () => {
    const user = userEvent.setup();
    mockCreateCreatorEvent.mockResolvedValue(makeMockCalendarEvent());
    render(<EventForm {...defaultProps} creatorOptions={mockCreatorOptions} />);

    await fillMinimalForm(user);

    await waitFor(() => {
      expect(screen.getByLabelText(/creator \(optional\)/i)).toBeInTheDocument();
    });
    await user.selectOptions(screen.getByLabelText(/creator \(optional\)/i), "creator-a");
    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(mockCreateCreatorEvent).toHaveBeenCalledOnce();
      expect(mockCreateCreatorEvent).toHaveBeenCalledWith(
        "creator-a",
        expect.objectContaining({ title: "Test Event" }),
      );
    });
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });

  it("calls createCalendarEvent when no creator is selected from options", async () => {
    const user = userEvent.setup();
    mockCreateCalendarEvent.mockResolvedValue(makeMockCalendarEvent());
    render(<EventForm {...defaultProps} creatorOptions={mockCreatorOptions} />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(mockCreateCalendarEvent).toHaveBeenCalledOnce();
    });
    expect(mockCreateCreatorEvent).not.toHaveBeenCalled();
  });
});
