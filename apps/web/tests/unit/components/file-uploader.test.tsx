import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Hoisted Mocks ──

const { mockOn, mockOff, mockDestroy, mockSetFileMeta, mockUse, capturedOptions } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockOff: vi.fn(),
  mockDestroy: vi.fn(),
  mockSetFileMeta: vi.fn(),
  mockUse: vi.fn(),
  capturedOptions: { current: null as unknown },
}));

vi.mock("@uppy/core", () => {
  function MockUppy(this: any, options: unknown) {
    capturedOptions.current = options;
    this.use = mockUse.mockReturnThis();
    this.on = mockOn;
    this.off = mockOff;
    this.destroy = mockDestroy;
    this.setFileMeta = mockSetFileMeta;
  }
  return { default: MockUppy };
});

vi.mock("@uppy/aws-s3", () => ({ default: vi.fn() }));

vi.mock("@uppy/react/dashboard", () => ({
  Dashboard: vi.fn(({ uppy }: { uppy: unknown }) => (
    <div data-testid="uppy-dashboard" />
  )),
}));

// Mock CSS imports
vi.mock("@uppy/core/css/style.min.css", () => ({}));
vi.mock("@uppy/dashboard/css/style.min.css", () => ({}));

// ── Import component under test (after mocks) ──

import { FileUploader } from "../../../src/components/upload/file-uploader.js";

// ── Test Lifecycle ──

const defaultProps = {
  purpose: "content-media" as const,
  resourceId: "res_123",
  acceptedTypes: ["video/mp4", "audio/mp3"],
  maxFileSize: 500 * 1024 * 1024,
  onUploadComplete: vi.fn(),
  onUploadError: vi.fn(),
};

beforeEach(() => {
  capturedOptions.current = null;
  mockOn.mockClear();
  mockOff.mockClear();
  mockDestroy.mockClear();
  mockSetFileMeta.mockClear();
  mockUse.mockClear().mockReturnThis();
  defaultProps.onUploadComplete = vi.fn();
  defaultProps.onUploadError = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──

describe("FileUploader", () => {
  it("renders Uppy Dashboard", () => {
    render(<FileUploader {...defaultProps} />);

    expect(screen.getByTestId("uppy-dashboard")).toBeInTheDocument();
  });

  it("creates Uppy instance with file restrictions from props", () => {
    render(
      <FileUploader
        {...defaultProps}
        maxFileSize={100 * 1024 * 1024}
        maxFiles={3}
        acceptedTypes={["image/jpeg", "image/png"]}
      />,
    );

    expect(capturedOptions.current).toMatchObject({
      restrictions: {
        maxFileSize: 100 * 1024 * 1024,
        maxNumberOfFiles: 3,
        allowedFileTypes: ["image/jpeg", "image/png"],
      },
    });
  });

  it("defaults maxFiles to 1 when not provided", () => {
    const { purpose, resourceId, acceptedTypes, maxFileSize, onUploadComplete } = defaultProps;
    render(
      <FileUploader
        purpose={purpose}
        resourceId={resourceId}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
        onUploadComplete={onUploadComplete}
      />,
    );

    expect(capturedOptions.current).toMatchObject({
      restrictions: expect.objectContaining({
        maxNumberOfFiles: 1,
      }),
    });
  });

  it("registers upload-success and upload-error event listeners on mount", () => {
    render(<FileUploader {...defaultProps} />);

    expect(mockOn).toHaveBeenCalledWith("upload-success", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("upload-error", expect.any(Function));
  });

  it("removes event listeners on unmount", () => {
    const { unmount } = render(<FileUploader {...defaultProps} />);

    unmount();

    expect(mockOff).toHaveBeenCalledWith("upload-success", expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith("upload-error", expect.any(Function));
  });

  it("destroys Uppy instance on unmount", () => {
    const { unmount } = render(<FileUploader {...defaultProps} />);

    unmount();

    expect(mockDestroy).toHaveBeenCalled();
  });

  it("uses AwsS3 plugin", () => {
    render(<FileUploader {...defaultProps} />);

    expect(mockUse).toHaveBeenCalled();
  });
});
