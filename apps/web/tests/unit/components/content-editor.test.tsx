import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeMockFeedItem } from "../../helpers/content-fixtures.js";
import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const {
  mockVideoDetail,
  mockAudioDetail,
  mockWrittenDetail,
  mockNavigate,
  mockInvalidate,
  mockUseContentManagement,
  mockStartEditing,
  mockSave,
  mockPublish,
  mockUnpublish,
  mockRemove,
} = vi.hoisted(() => ({
  mockVideoDetail: vi.fn(),
  mockAudioDetail: vi.fn(),
  mockWrittenDetail: vi.fn(),
  mockNavigate: vi.fn(),
  mockInvalidate: vi.fn().mockResolvedValue(undefined),
  mockUseContentManagement: vi.fn(),
  mockStartEditing: vi.fn(),
  mockSave: vi.fn().mockResolvedValue(undefined),
  mockPublish: vi.fn().mockResolvedValue(undefined),
  mockUnpublish: vi.fn().mockResolvedValue(undefined),
  mockRemove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    useNavigate: () => mockNavigate,
    useRouter: () => ({ invalidate: mockInvalidate }),
  }),
);

vi.mock("../../../src/hooks/use-content-management.js", () => ({
  useContentManagement: mockUseContentManagement,
}));

vi.mock("../../../src/contexts/upload-context.js", () => ({
  useUpload: () => ({
    state: { activeUploads: [], isUploading: false, isExpanded: false },
    actions: { startUpload: vi.fn(), cancelUpload: vi.fn(), cancelAll: vi.fn(), dismissCompleted: vi.fn(), toggleExpanded: vi.fn() },
  }),
}));

vi.mock("../../../src/components/content/video-detail.js", () => ({
  VideoDetail: (props: Record<string, unknown>) => {
    mockVideoDetail(props);
    return <div data-testid="video-detail" />;
  },
}));

vi.mock("../../../src/components/content/audio-detail.js", () => ({
  AudioDetail: (props: Record<string, unknown>) => {
    mockAudioDetail(props);
    return <div data-testid="audio-detail" />;
  },
}));

vi.mock("../../../src/components/content/written-detail.js", () => ({
  WrittenDetail: (props: Record<string, unknown>) => {
    mockWrittenDetail(props);
    return <div data-testid="written-detail" />;
  },
}));

// ── Component Under Test ──

import { ContentEditor } from "../../../src/components/content/content-editor.js";

// ── Helpers ──

function makeManagementReturn(overrides?: Partial<ReturnType<typeof makeDefaultManagement>>) {
  return { ...makeDefaultManagement(), ...overrides };
}

function makeDefaultManagement() {
  return {
    isEditing: true,
    editingItem: makeMockFeedItem(),
    editCallbacks: undefined,
    startEditing: mockStartEditing,
    cancelEditing: vi.fn(),
    isSaving: false,
    isPublishing: false,
    isDeleting: false,
    error: null,
    save: mockSave,
    publish: mockPublish,
    unpublish: mockUnpublish,
    remove: mockRemove,
  };
}

// ── Lifecycle ──

beforeEach(() => {
  mockVideoDetail.mockReset();
  mockAudioDetail.mockReset();
  mockWrittenDetail.mockReset();
  mockNavigate.mockReset();
  mockInvalidate.mockReset().mockResolvedValue(undefined);
  mockStartEditing.mockReset();
  mockSave.mockReset().mockResolvedValue(undefined);
  mockPublish.mockReset().mockResolvedValue(undefined);
  mockUnpublish.mockReset().mockResolvedValue(undefined);
  mockRemove.mockReset().mockResolvedValue(undefined);
  mockUseContentManagement.mockReturnValue(makeDefaultManagement());
});

// ── Tests ──

describe("ContentEditor", () => {
  it("renders Save button", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders Publish button for draft content", () => {
    const item = makeMockFeedItem({ type: "written", publishedAt: null });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("renders Unpublish button for published content", () => {
    const item = makeMockFeedItem({ publishedAt: "2026-01-01T00:00:00.000Z" });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("renders Delete button", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("dispatches to VideoDetail for video content", () => {
    const item = makeMockFeedItem({ type: "video" });
    render(<ContentEditor item={item} />);
    expect(screen.getByTestId("video-detail")).toBeInTheDocument();
  });

  it("dispatches to AudioDetail for audio content", () => {
    const item = makeMockFeedItem({ type: "audio" });
    render(<ContentEditor item={item} />);
    expect(screen.getByTestId("audio-detail")).toBeInTheDocument();
  });

  it("dispatches to WrittenDetail for written content", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(screen.getByTestId("written-detail")).toBeInTheDocument();
  });

  it("calls useContentManagement with initialEdit=true", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(mockUseContentManagement).toHaveBeenCalledWith(item, true);
  });

  it("calls startEditing on mount", () => {
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(mockStartEditing).toHaveBeenCalled();
  });

  it("Save button shows 'Saving...' when isSaving", () => {
    mockUseContentManagement.mockReturnValue(makeManagementReturn({ isSaving: true }));
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeInTheDocument();
  });

  it("Save button is disabled when isSaving", () => {
    mockUseContentManagement.mockReturnValue(makeManagementReturn({ isSaving: true }));
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("Publish button is disabled for video without media", () => {
    const item = makeMockFeedItem({ type: "video", mediaUrl: null, publishedAt: null });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("Publish button is enabled for written content without media", () => {
    const item = makeMockFeedItem({ type: "written", mediaUrl: null, publishedAt: null });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("button", { name: "Publish" })).not.toBeDisabled();
  });

  it("shows error message when mgmt.error is set", () => {
    mockUseContentManagement.mockReturnValue(makeManagementReturn({ error: "Save failed" }));
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
  });

  it("passes isEditing from management hook to detail component", () => {
    mockUseContentManagement.mockReturnValue(makeManagementReturn({ isEditing: true }));
    const item = makeMockFeedItem({ type: "written" });
    render(<ContentEditor item={item} />);
    expect(mockWrittenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ isEditing: true }),
    );
  });
});
