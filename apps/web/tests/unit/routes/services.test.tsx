import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeMockService } from "../../helpers/booking-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";
import { createAuthMock } from "../../helpers/auth-mock.js";
import { extractRouteComponent } from "../../helpers/route-test-utils.js";

// ── Hoisted Mocks ──

const {
  mockUseLoaderData,
  mockUseSession,
  mockNavigate,
  mockCreateBooking,
  mockIsFeatureEnabled,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUseSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockCreateBooking: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useLoaderData: mockUseLoaderData,
    useNavigate: () => mockNavigate,
    redirect: vi.fn(),
  }),
);

vi.mock("../../../src/lib/auth.js", () =>
  createAuthMock({ useSession: mockUseSession }),
);

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchApiServer: vi.fn(),
}));

vi.mock("../../../src/lib/booking.js", () => ({
  fetchServices: vi.fn(),
  createBooking: mockCreateBooking,
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

// ── Component Under Test ──

const ServicesPage = extractRouteComponent(() => import("../../../src/routes/services.js"));

// ── Test Lifecycle ──

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(true);
  mockUseLoaderData.mockReturnValue([
    makeMockService({ id: "svc-1", name: "Recording Session", pricingInfo: "$50/hour" }),
    makeMockService({ id: "svc-2", name: "Label Services", pricingInfo: "Contact for pricing" }),
  ]);
  mockUseSession.mockReturnValue({ data: { user: { id: "u1" } } });
  mockCreateBooking.mockResolvedValue({});
  mockNavigate.mockReset();
});

// ── Tests ──

describe("ServicesPage", () => {
  it("renders page heading 'Studio & Label Services'", () => {
    render(<ServicesPage />);

    expect(
      screen.getByRole("heading", { name: "Studio & Label Services" }),
    ).toBeDefined();
  });

  it("renders service cards from loader data", () => {
    render(<ServicesPage />);

    expect(screen.getByText("Recording Session")).toBeDefined();
    expect(screen.getByText("Label Services")).toBeDefined();
  });

  it("shows empty state when loader returns no services", () => {
    mockUseLoaderData.mockReturnValue([]);

    render(<ServicesPage />);

    expect(
      screen.getByText("No services are currently available."),
    ).toBeDefined();
  });

  it("clicking 'Request Booking' expands booking form (authenticated)", async () => {
    const user = userEvent.setup();

    render(<ServicesPage />);

    const buttons = screen.getAllByRole("button", { name: "Request Booking" });
    await user.click(buttons[0]!);

    await waitFor(() => {
      expect(screen.getByText(/^Book:/)).toBeDefined();
    });
  });

  it("clicking 'Request Booking' redirects to /login (unauthenticated)", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: null });

    render(<ServicesPage />);

    const buttons = screen.getAllByRole("button", { name: "Request Booking" });
    await user.click(buttons[0]!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    });
  });

  it("only one booking form visible at a time", async () => {
    const user = userEvent.setup();

    render(<ServicesPage />);

    const buttons = screen.getAllByRole("button", { name: "Request Booking" });

    // Expand form for svc-1
    await user.click(buttons[0]!);
    await waitFor(() => {
      expect(screen.getByText(/^Book:/)).toBeDefined();
    });

    // Expand form for svc-2 (should collapse svc-1 form)
    await user.click(buttons[1]!);
    await waitFor(() => {
      const bookHeadings = screen.getAllByText(/^Book:/);
      expect(bookHeadings).toHaveLength(1);
    });
  });

  it("successful submission shows confirmation message and collapses form", async () => {
    const user = userEvent.setup();

    render(<ServicesPage />);

    // Expand form for svc-1
    const buttons = screen.getAllByRole("button", { name: "Request Booking" });
    await user.click(buttons[0]!);

    await waitFor(() => {
      expect(screen.getByText(/^Book:/)).toBeDefined();
    });

    // Fill in a date
    const dateInput = screen.getByLabelText("Preferred date 1");
    await user.type(dateInput, "March 15, 2026");

    // Submit the form
    await user.click(screen.getByRole("button", { name: "Submit Request" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status"),
      ).toBeDefined();
      expect(
        screen.getByRole("status").textContent,
      ).toContain("Your booking request has been submitted");
    });

    // Form should be gone
    expect(screen.queryByText(/^Book:/)).toBeNull();
  });

  it("cancel button collapses the form", async () => {
    const user = userEvent.setup();

    render(<ServicesPage />);

    // Expand form
    const buttons = screen.getAllByRole("button", { name: "Request Booking" });
    await user.click(buttons[0]!);

    await waitFor(() => {
      expect(screen.getByText(/^Book:/)).toBeDefined();
    });

    // Click Cancel
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText(/^Book:/)).toBeNull();
    });
  });

  it("renders Coming Soon when booking feature is disabled", () => {
    mockIsFeatureEnabled.mockImplementation((flag: string) => flag !== "booking");

    render(<ServicesPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Services — Coming Soon" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });
});
