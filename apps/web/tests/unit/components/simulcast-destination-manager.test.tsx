import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  SimulcastDestination,
  CreateSimulcastDestination,
  UpdateSimulcastDestination,
} from "@snc/shared";

// ── Toast mock (hoisted so vi.mock factory can reference it) ──
const { mockToasterSuccess } = vi.hoisted(() => ({
  mockToasterSuccess: vi.fn(),
}));

vi.mock("../../../src/components/ui/toast.js", () => ({
  toaster: {
    success: mockToasterSuccess,
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// ── Component Under Test ──

import { SimulcastDestinationManager } from "../../../src/components/simulcast/simulcast-destination-manager.js";

// ── Helpers ──

function makeDest(overrides: Partial<SimulcastDestination> = {}): SimulcastDestination {
  return {
    id: "dest-1",
    platform: "twitch",
    label: "My Twitch",
    rtmpUrl: "rtmp://live.twitch.tv/app",
    streamKeyPrefix: "sk_abc",
    isActive: true,
    creatorId: "creator-1",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Test Lifecycle ──

type FetchDestinations = () => Promise<{ destinations: SimulcastDestination[] }>;
type CreateDestination = (input: CreateSimulcastDestination) => Promise<unknown>;
type UpdateDestination = (id: string, input: UpdateSimulcastDestination) => Promise<unknown>;
type DeleteDestination = (id: string) => Promise<unknown>;

let mockFetchDestinations: Mock<FetchDestinations>;
let mockCreateDestination: Mock<CreateDestination>;
let mockUpdateDestination: Mock<UpdateDestination>;
let mockDeleteDestination: Mock<DeleteDestination>;

beforeEach(() => {
  mockFetchDestinations = vi.fn<FetchDestinations>().mockResolvedValue({ destinations: [] });
  mockCreateDestination = vi.fn<CreateDestination>().mockResolvedValue({});
  mockUpdateDestination = vi.fn<UpdateDestination>().mockResolvedValue({});
  mockDeleteDestination = vi.fn<DeleteDestination>().mockResolvedValue({});
  mockToasterSuccess.mockClear();
});

// ── Tests ──

describe("SimulcastDestinationManager – RTMP URL validation", () => {
  it("shows inline error and does not call createDestination when an https:// URL is submitted", async () => {
    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Destination" })).toBeInTheDocument();
    });

    // Open the add form
    fireEvent.click(screen.getByRole("button", { name: "Add Destination" }));

    // Fill in required fields — label and stream key
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "My Channel" } });
    fireEvent.change(screen.getByLabelText("Stream Key"), { target: { value: "sk_valid" } });

    // Clear the prefilled rtmpUrl and enter an https:// URL
    const rtmpInput = screen.getByLabelText("RTMP URL");
    fireEvent.change(rtmpInput, { target: { value: "https://example.com/stream" } });

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Inline error should appear
    await waitFor(() => {
      expect(screen.getByText("Must be an rtmp:// or rtmps:// URL")).toBeInTheDocument();
    });

    // API should NOT have been called
    expect(mockCreateDestination).not.toHaveBeenCalled();
  });

  it("clears inline error when the URL field changes", async () => {
    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Destination" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Destination" }));
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Test" } });
    fireEvent.change(screen.getByLabelText("Stream Key"), { target: { value: "sk_valid" } });

    const rtmpInput = screen.getByLabelText("RTMP URL");
    fireEvent.change(rtmpInput, { target: { value: "https://bad.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Must be an rtmp:// or rtmps:// URL")).toBeInTheDocument();
    });

    // Editing the field clears the error
    fireEvent.change(rtmpInput, { target: { value: "rtmp://live.twitch.tv/app" } });
    expect(screen.queryByText("Must be an rtmp:// or rtmps:// URL")).not.toBeInTheDocument();
  });

  it("calls createDestination when a valid rtmp:// URL is submitted", async () => {
    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Destination" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Destination" }));
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "My Twitch" } });
    fireEvent.change(screen.getByLabelText("Stream Key"), { target: { value: "sk_twitch_key" } });

    // Platform "twitch" pre-fills rtmpUrl; that prefix is already rtmp://
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockCreateDestination).toHaveBeenCalledWith(
        expect.objectContaining({ rtmpUrl: expect.stringMatching(/^rtmps?:\/\//) }),
      );
    });

    expect(screen.queryByText("Must be an rtmp:// or rtmps:// URL")).not.toBeInTheDocument();
  });

  it("renders list of destinations", async () => {
    mockFetchDestinations.mockResolvedValue({ destinations: [makeDest()] });

    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
        variant="list"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("My Twitch")).toBeInTheDocument();
    });
  });
});

describe("SimulcastDestinationManager – delete flow", () => {
  // ResponsiveTable renders both table and card views in the DOM simultaneously
  // in auto mode (CSS container query hides one). Each row's actions appear in
  // both views, so queries use getAllByRole and target the first match.

  it("clicking Delete opens the confirm dialog without calling deleteDestination", async () => {
    const user = userEvent.setup();
    mockFetchDestinations.mockResolvedValue({ destinations: [makeDest()] });

    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Delete" })[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]!);

    // Dialog should appear
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/Delete destination\?/i)).toBeInTheDocument();

    // API not called yet
    expect(mockDeleteDestination).not.toHaveBeenCalled();
  });

  it("confirming the dialog calls deleteDestination with the right id and reloads", async () => {
    const user = userEvent.setup();
    mockFetchDestinations.mockResolvedValue({ destinations: [makeDest({ id: "dest-99" })] });

    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Delete" })[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]!);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete destination" }));

    await waitFor(() => {
      expect(mockDeleteDestination).toHaveBeenCalledWith("dest-99");
    });

    // Reloads the list after delete
    expect(mockFetchDestinations).toHaveBeenCalledTimes(2);
  });

  it("cancelling the dialog closes it without calling deleteDestination", async () => {
    const user = userEvent.setup();
    mockFetchDestinations.mockResolvedValue({ destinations: [makeDest()] });

    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Delete" })[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]!);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    expect(mockDeleteDestination).not.toHaveBeenCalled();
  });
});

describe("SimulcastDestinationManager – toggle active feedback", () => {
  // ResponsiveTable renders both table and card views in the DOM simultaneously
  // in auto mode (CSS container query hides one). Each row's actions appear in
  // both views, so queries use getAllByRole and target the first match.

  it("shows 'Destination deactivated' toast when toggling an active destination off", async () => {
    const user = userEvent.setup();
    // dest is active; toggle → deactivate
    mockFetchDestinations.mockResolvedValue({ destinations: [makeDest({ isActive: true })] });

    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Deactivate" })[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Deactivate" })[0]!);

    await waitFor(() => {
      expect(mockToasterSuccess).toHaveBeenCalledWith({ title: "Destination deactivated" });
    });
  });

  it("shows 'Destination activated' toast when toggling an inactive destination on", async () => {
    const user = userEvent.setup();
    // dest is inactive; toggle → activate
    mockFetchDestinations.mockResolvedValue({ destinations: [makeDest({ isActive: false })] });

    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Activate" })[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Activate" })[0]!);

    await waitFor(() => {
      expect(mockToasterSuccess).toHaveBeenCalledWith({ title: "Destination activated" });
    });
  });

  it("does not show a toast when the toggle fails", async () => {
    const user = userEvent.setup();
    mockFetchDestinations.mockResolvedValue({ destinations: [makeDest({ isActive: true })] });
    mockUpdateDestination.mockRejectedValue(new Error("Network error"));

    render(
      <SimulcastDestinationManager
        fetchDestinations={mockFetchDestinations}
        createDestination={mockCreateDestination}
        updateDestination={mockUpdateDestination}
        deleteDestination={mockDeleteDestination}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Deactivate" })[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Deactivate" })[0]!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(mockToasterSuccess).not.toHaveBeenCalled();
  });
});
