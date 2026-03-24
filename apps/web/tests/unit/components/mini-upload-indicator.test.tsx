import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Hoisted Mocks ──

const {
  mockCancelAll,
  mockDismissCompleted,
  mockToggleExpanded,
  mockCancelUpload,
} = vi.hoisted(() => ({
  mockCancelAll: vi.fn(),
  mockDismissCompleted: vi.fn(),
  mockToggleExpanded: vi.fn(),
  mockCancelUpload: vi.fn(),
}));

const { mockUseUpload } = vi.hoisted(() => ({
  mockUseUpload: vi.fn(),
}));

vi.mock("../../../src/contexts/upload-context.js", () => ({
  useUpload: mockUseUpload,
}));

// ── Import component under test (after mocks) ──

import { MiniUploadIndicator } from "../../../src/components/upload/mini-upload-indicator.js";
import type { UploadContextValue } from "../../../src/contexts/upload-context.js";

// ── Helpers ──

function makeContext(overrides?: Partial<UploadContextValue["state"]>): UploadContextValue {
  return {
    state: {
      activeUploads: [],
      isUploading: false,
      isExpanded: false,
      ...overrides,
    },
    actions: {
      startUpload: vi.fn(),
      cancelUpload: mockCancelUpload,
      cancelAll: mockCancelAll,
      dismissCompleted: mockDismissCompleted,
      toggleExpanded: mockToggleExpanded,
    },
  };
}

// ── Lifecycle ──

beforeEach(() => {
  mockUseUpload.mockReturnValue(makeContext());
  mockCancelAll.mockReset();
  mockDismissCompleted.mockReset();
  mockToggleExpanded.mockReset();
  mockCancelUpload.mockReset();
});

afterEach(() => {
  document.body.style.removeProperty("--mini-upload-height");
  vi.clearAllTimers();
});

// ── Tests ──

describe("MiniUploadIndicator", () => {
  it("renders null when no active uploads", () => {
    const { container } = render(<MiniUploadIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it("sets --mini-upload-height to 48px when uploads exist", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "video.mp4", progress: 50, status: "uploading" }],
      isUploading: true,
    }));

    render(<MiniUploadIndicator />);

    expect(document.body.style.getPropertyValue("--mini-upload-height")).toBe("48px");
  });

  it("resets --mini-upload-height to 0px when uploads clear", () => {
    const { rerender } = render(<MiniUploadIndicator />);

    mockUseUpload.mockReturnValue(makeContext());
    rerender(<MiniUploadIndicator />);

    expect(document.body.style.getPropertyValue("--mini-upload-height")).toBe("0px");
  });

  it("renders compact view with filename for single upload", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "my-video.mp4", progress: 42, status: "uploading" }],
      isUploading: true,
    }));

    render(<MiniUploadIndicator />);

    expect(screen.getByText(/my-video\.mp4/)).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it("renders compact view with count for multiple uploads", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [
        { id: "u1", filename: "a.mp4", progress: 30, status: "uploading" },
        { id: "u2", filename: "b.mp4", progress: 50, status: "uploading" },
      ],
      isUploading: true,
    }));

    render(<MiniUploadIndicator />);

    expect(screen.getByText(/2 files/)).toBeInTheDocument();
  });

  it("shows 'Upload complete' when all done", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [
        { id: "u1", filename: "a.mp4", progress: 100, status: "complete" },
      ],
      isUploading: false,
    }));

    render(<MiniUploadIndicator />);

    expect(screen.getByText("Upload complete")).toBeInTheDocument();
  });

  it("shows 'Cancel all' button when uploading", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "a.mp4", progress: 50, status: "uploading" }],
      isUploading: true,
    }));

    render(<MiniUploadIndicator />);

    expect(screen.getByRole("button", { name: "Cancel all" })).toBeInTheDocument();
  });

  it("shows 'Dismiss' button when not uploading", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "a.mp4", progress: 100, status: "complete" }],
      isUploading: false,
    }));

    render(<MiniUploadIndicator />);

    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("Cancel all button calls cancelAll action", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "a.mp4", progress: 50, status: "uploading" }],
      isUploading: true,
    }));

    render(<MiniUploadIndicator />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel all" }));

    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });

  it("Dismiss button calls dismissCompleted action", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "a.mp4", progress: 100, status: "complete" }],
      isUploading: false,
    }));

    render(<MiniUploadIndicator />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(mockDismissCompleted).toHaveBeenCalledTimes(1);
  });

  it("expand toggle calls toggleExpanded action", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "a.mp4", progress: 50, status: "uploading" }],
      isUploading: true,
    }));

    render(<MiniUploadIndicator />);

    const expandBtn = screen.getByRole("button", { name: /expand upload details/i });
    fireEvent.click(expandBtn);

    expect(mockToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("expanded view shows per-file rows when isExpanded", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [
        { id: "u1", filename: "video.mp4", progress: 60, status: "uploading" },
      ],
      isUploading: true,
      isExpanded: true,
    }));

    render(<MiniUploadIndicator />);

    expect(screen.getByText("video.mp4")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("expanded view shows cancel button for uploading files", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [
        { id: "u1", filename: "video.mp4", progress: 60, status: "uploading" },
      ],
      isUploading: true,
      isExpanded: true,
    }));

    render(<MiniUploadIndicator />);

    expect(screen.getByRole("button", { name: /cancel upload for/i })).toBeInTheDocument();
  });

  it("per-file cancel button calls cancelUpload with file id", () => {
    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [
        { id: "u1", filename: "video.mp4", progress: 60, status: "uploading" },
      ],
      isUploading: true,
      isExpanded: true,
    }));

    render(<MiniUploadIndicator />);

    fireEvent.click(screen.getByRole("button", { name: /cancel upload for/i }));

    expect(mockCancelUpload).toHaveBeenCalledWith("u1");
  });

  it("auto-dismisses after 3 seconds when uploads complete", () => {
    vi.useFakeTimers();

    mockUseUpload.mockReturnValue(makeContext({
      activeUploads: [{ id: "u1", filename: "a.mp4", progress: 100, status: "complete" }],
      isUploading: false,
    }));

    render(<MiniUploadIndicator />);

    expect(mockDismissCompleted).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockDismissCompleted).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
