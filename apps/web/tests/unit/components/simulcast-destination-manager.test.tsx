import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  SimulcastDestination,
  CreateSimulcastDestination,
  UpdateSimulcastDestination,
} from "@snc/shared";

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
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

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
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

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
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

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
