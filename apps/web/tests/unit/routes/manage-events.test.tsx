import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCalendarEvent } from "../../helpers/calendar-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockFetchCreatorEvents,
  mockDeleteCreatorEvent,
  mockIsFeatureEnabled,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockFetchCreatorEvents: vi.fn(),
  mockDeleteCreatorEvent: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    getRouteApi: () => ({
      useLoaderData: mockUseLoaderData,
      useParams: () => ({}),
      useRouteContext: () => ({}),
    }),
  }),
);

vi.mock("../../../src/lib/calendar.js", () => ({
  fetchCreatorEvents: mockFetchCreatorEvents,
  deleteCreatorEvent: mockDeleteCreatorEvent,
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../../src/components/calendar/event-form.js", () => ({
  EventForm: ({
    creatorId,
    onCancel,
  }: {
    creatorId: string;
    onCancel: () => void;
  }) => (
    <div data-testid="event-form" data-creator-id={creatorId}>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

vi.mock("../../../src/components/calendar/event-list.js", () => ({
  EventList: ({ events }: { events: unknown[] }) => (
    <div data-testid="event-list" data-count={events.length} />
  ),
}));

vi.mock("../../../src/styles/detail-section.module.css", () => ({
  default: { section: "section", sectionHeading: "sectionHeading" },
}));

vi.mock(
  "../../../src/routes/creators/$creatorId/manage/events-manage.module.css",
  () => ({
    default: {
      eventsManage: "eventsManage",
      headerRow: "headerRow",
      newEventButton: "newEventButton",
      error: "error",
      navRow: "navRow",
      navButton: "navButton",
      monthLabel: "monthLabel",
      filterRow: "filterRow",
      filterSelect: "filterSelect",
      formWrapper: "formWrapper",
      status: "status",
    },
  }),
);

// ── Component Under Test ──

const ManageEventsPage = extractRouteComponent(
  () =>
    import(
      "../../../src/routes/creators/$creatorId/manage/events.js"
    ),
);

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockUseLoaderData.mockReturnValue({
    creator: { id: "creator-uuid-123", displayName: "Test Creator" },
    memberRole: "owner",
    isAdmin: false,
    userId: "user-1",
  });
  mockFetchCreatorEvents.mockResolvedValue({
    items: [makeMockCalendarEvent()],
    nextCursor: null,
  });
  mockDeleteCreatorEvent.mockResolvedValue(undefined);
});

// ── Tests ──

describe("ManageEventsPage", () => {
  it("renders the Events heading", () => {
    render(<ManageEventsPage />);
    expect(
      screen.getByRole("heading", { name: "Events" }),
    ).toBeInTheDocument();
  });

  it("renders the New Event button", () => {
    render(<ManageEventsPage />);
    expect(
      screen.getByRole("button", { name: "New Event" }),
    ).toBeInTheDocument();
  });

  it("renders month navigation buttons", () => {
    render(<ManageEventsPage />);
    expect(
      screen.getByRole("button", { name: "Previous" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("renders a category filter select", () => {
    render(<ManageEventsPage />);
    expect(
      screen.getByRole("combobox"),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<ManageEventsPage />);
    expect(screen.getByText(/loading events/i)).toBeInTheDocument();
  });

  it("shows the event list after loading", async () => {
    render(<ManageEventsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("event-list")).toBeInTheDocument();
    });
  });

  it("fetches events with the creator id", async () => {
    render(<ManageEventsPage />);
    await waitFor(() => {
      expect(mockFetchCreatorEvents).toHaveBeenCalledWith(
        "creator-uuid-123",
        expect.any(Object),
      );
    });
  });

  it("shows the EventForm when New Event is clicked", async () => {
    const user = userEvent.setup();
    render(<ManageEventsPage />);

    await user.click(screen.getByRole("button", { name: "New Event" }));

    expect(screen.getByTestId("event-form")).toBeInTheDocument();
    expect(screen.getByTestId("event-form")).toHaveAttribute(
      "data-creator-id",
      "creator-uuid-123",
    );
  });

  it("hides the EventForm when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ManageEventsPage />);

    await user.click(screen.getByRole("button", { name: "New Event" }));
    expect(screen.getByTestId("event-form")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("event-form")).not.toBeInTheDocument();
  });
});
