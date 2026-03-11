import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeMockBookingWithService } from "../../helpers/booking-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Helpers ──

function makeBookingsResponse(
  bookings: ReturnType<typeof makeMockBookingWithService>[],
  nextCursor: string | null = null,
): Response {
  return new Response(
    JSON.stringify({ items: bookings, nextCursor }),
    { status: 200 },
  );
}

// ── Mocks ──

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ redirect: vi.fn() }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({ user: { id: "u1" }, roles: [] }),
}));

// ── Component Under Test ──

const BookingManagementPage = extractRouteComponent(() => import("../../../src/routes/settings/bookings.js"));

// ── Lifecycle ──

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeBookingsResponse([
          makeMockBookingWithService({
            id: "bk-1",
            service: {
              ...makeMockBookingWithService().service,
              name: "Recording Session",
            },
          }),
        ]),
      ),
    ),
  );
});

// ── Tests ──

describe("BookingManagementPage", () => {
  it("renders page heading 'My Booking Requests'", () => {
    render(<BookingManagementPage />);
    expect(
      screen.getByRole("heading", { name: "My Booking Requests" }),
    ).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<BookingManagementPage />);
    expect(
      screen.getByText("Loading booking requests..."),
    ).toBeInTheDocument();
  });

  it("renders booking list after loading", async () => {
    render(<BookingManagementPage />);
    await waitFor(() => {
      expect(screen.getByText("Recording Session")).toBeInTheDocument();
    });
  });

  it("renders empty state when no bookings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(makeBookingsResponse([])),
      ),
    );
    render(<BookingManagementPage />);
    await waitFor(() => {
      expect(
        screen.getByText("You haven't submitted any booking requests yet."),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Load more' button when nextCursor is set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          makeBookingsResponse(
            [makeMockBookingWithService({ id: "bk-1" })],
            "cursor-abc",
          ),
        ),
      ),
    );
    render(<BookingManagementPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load more" }),
      ).toBeInTheDocument();
    });
  });

  it("hides 'Load more' button on last page", async () => {
    render(<BookingManagementPage />);
    await waitFor(() => {
      expect(screen.getByText("Recording Session")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("clicking 'Load more' appends next page items", async () => {
    const user = userEvent.setup();
    const firstBooking = makeMockBookingWithService({
      id: "bk-1",
      service: { ...makeMockBookingWithService().service, name: "Recording Session" },
    });
    const secondBooking = makeMockBookingWithService({
      id: "bk-2",
      service: { ...makeMockBookingWithService().service, name: "Mastering Session" },
    });

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            makeBookingsResponse([firstBooking], "cursor-xyz"),
          );
        }
        return Promise.resolve(makeBookingsResponse([secondBooking]));
      }),
    );

    render(<BookingManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Recording Session")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(screen.getByText("Mastering Session")).toBeInTheDocument();
    });
    expect(screen.getByText("Recording Session")).toBeInTheDocument();
  });

  it("'Load more' button is disabled while loading", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            makeBookingsResponse(
              [makeMockBookingWithService({ id: "bk-1" })],
              "cursor-xyz",
            ),
          );
        }
        return new Promise(() => {});
      }),
    );

    render(<BookingManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load more" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  });

  it("shows error message when initial fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    render(<BookingManagementPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("shows error message when load-more fails", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            makeBookingsResponse(
              [makeMockBookingWithService({ id: "bk-1" })],
              "cursor-xyz",
            ),
          );
        }
        return Promise.reject(new Error("Network error"));
      }),
    );

    render(<BookingManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Load more" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});
