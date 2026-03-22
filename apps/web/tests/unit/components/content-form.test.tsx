import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Hoisted Mocks ──

const { mockCreateContent, mockStartUpload, mockUseUpload } = vi.hoisted(() => ({
  mockCreateContent: vi.fn(),
  mockStartUpload: vi.fn(),
  mockUseUpload: vi.fn(),
}));

vi.mock("../../../src/lib/content.js", () => ({
  createContent: mockCreateContent,
}));

vi.mock("../../../src/contexts/upload-context.js", () => ({
  useUpload: mockUseUpload,
}));

// ── Component Under Test ──

import { ContentForm } from "../../../src/components/content/content-form.js";

// ── Lifecycle ──

beforeEach(() => {
  mockCreateContent.mockReset();
  mockStartUpload.mockReset();
  mockUseUpload.mockReturnValue({
    state: { activeUploads: [], isUploading: false, isExpanded: false },
    actions: {
      startUpload: mockStartUpload,
      cancelUpload: vi.fn(),
      cancelAll: vi.fn(),
      dismissCompleted: vi.fn(),
      toggleExpanded: vi.fn(),
    },
  });
});

// ── Tests ──

describe("ContentForm", () => {
  it("renders the create content form with title and type fields", () => {
    render(
      <ContentForm creatorId="creator-1" onSuccess={vi.fn()} />,
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
  });

  it("does not render save-as-draft checkbox even when written type selected", () => {
    render(
      <ContentForm creatorId="creator-1" onSuccess={vi.fn()} />,
    );

    // Switch to written type
    const typeSelect = screen.getByLabelText(/type/i);
    fireEvent.change(typeSelect, { target: { value: "written" } });

    // Should not find the checkbox
    expect(
      screen.queryByLabelText(/save as draft/i),
    ).toBeNull();
    expect(
      screen.queryByText(/don.t publish immediately/i),
    ).toBeNull();
  });

  it("shows Draft created success message when no files attached", async () => {
    mockCreateContent.mockResolvedValue({
      id: "new-content",
      type: "written",
      title: "My Post",
      creatorId: "creator-1",
      slug: null,
      body: "some body",
      description: null,
      visibility: "public",
      sourceType: "upload",
      thumbnailUrl: null,
      mediaUrl: null,
      publishedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    render(
      <ContentForm creatorId="creator-1" onSuccess={vi.fn()} />,
    );

    // Switch to written, fill in body
    const typeSelect = screen.getByLabelText(/type/i);
    fireEvent.change(typeSelect, { target: { value: "written" } });

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: "My Post" } });

    const bodyTextarea = screen.getByLabelText(/body/i);
    fireEvent.change(bodyTextarea, { target: { value: "Some content here" } });

    fireEvent.click(screen.getByRole("button", { name: /create content/i }));

    await waitFor(() => {
      expect(screen.getByText("Draft created")).toBeInTheDocument();
    });
  });

  it("renders thumbnail input for written content type", () => {
    render(
      <ContentForm creatorId="creator-1" onSuccess={vi.fn()} />,
    );

    const typeSelect = screen.getByLabelText(/type/i);
    fireEvent.change(typeSelect, { target: { value: "written" } });

    expect(screen.getByLabelText(/thumbnail/i)).toBeInTheDocument();
  });

  it("does not render thumbnail input for audio content type", () => {
    render(
      <ContentForm creatorId="creator-1" onSuccess={vi.fn()} />,
    );

    // Audio is the default type
    expect(screen.queryByLabelText(/thumbnail/i)).toBeNull();
  });

  it("renders thumbnail input for video content type", () => {
    render(
      <ContentForm creatorId="creator-1" onSuccess={vi.fn()} />,
    );

    const typeSelect = screen.getByLabelText(/type/i);
    fireEvent.change(typeSelect, { target: { value: "video" } });

    expect(screen.getByLabelText(/thumbnail/i)).toBeInTheDocument();
  });

  it("does not send publishImmediately field in createContent call", async () => {
    mockCreateContent.mockResolvedValue({
      id: "new-content",
      type: "written",
      title: "My Post",
      creatorId: "creator-1",
      slug: null,
      body: "some body",
      description: null,
      visibility: "public",
      sourceType: "upload",
      thumbnailUrl: null,
      mediaUrl: null,
      publishedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    render(
      <ContentForm creatorId="creator-1" onSuccess={vi.fn()} />,
    );

    const typeSelect = screen.getByLabelText(/type/i);
    fireEvent.change(typeSelect, { target: { value: "written" } });

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: "My Post" } });

    const bodyTextarea = screen.getByLabelText(/body/i);
    fireEvent.change(bodyTextarea, { target: { value: "Some content" } });

    fireEvent.click(screen.getByRole("button", { name: /create content/i }));

    await waitFor(() => {
      expect(mockCreateContent).toHaveBeenCalled();
    });

    const callArg = mockCreateContent.mock.calls[0]![0];
    expect(callArg).not.toHaveProperty("publishImmediately");
  });
});
