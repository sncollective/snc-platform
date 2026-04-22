import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { InlineUploadProgress } from "../../../src/components/content/inline-upload-progress.js";
import type { ActiveUpload } from "../../../src/contexts/upload-context.js";

// ── Helpers ──

function makeUpload(overrides: Partial<ActiveUpload> = {}): ActiveUpload {
  return {
    id: "uppy-1",
    filename: "video.mp4",
    progress: 55,
    status: "uploading",
    resourceId: "content-1",
    purpose: "content-media",
    ...overrides,
  };
}

// ── Tests ──

describe("InlineUploadProgress", () => {
  it("renders filename for video variant", () => {
    const upload = makeUpload({ filename: "my-video.mp4" });
    render(<InlineUploadProgress upload={upload} variant="video" />);
    expect(screen.getByText("my-video.mp4")).toBeInTheDocument();
  });

  it("renders filename for audio variant", () => {
    const upload = makeUpload({ filename: "my-track.mp3" });
    render(<InlineUploadProgress upload={upload} variant="audio" />);
    expect(screen.getByText("my-track.mp3")).toBeInTheDocument();
  });

  it("renders progress percentage for video variant", () => {
    const upload = makeUpload({ progress: 42 });
    render(<InlineUploadProgress upload={upload} variant="video" />);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("renders progress percentage for audio variant", () => {
    const upload = makeUpload({ progress: 78 });
    render(<InlineUploadProgress upload={upload} variant="audio" />);
    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("shows 'Finalizing...' when upload status is completing", () => {
    const upload = makeUpload({ status: "completing", progress: 100 });
    render(<InlineUploadProgress upload={upload} variant="video" />);
    expect(screen.getByText("Finalizing...")).toBeInTheDocument();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("shows 'Finalizing...' for audio variant when completing", () => {
    const upload = makeUpload({ status: "completing", progress: 100 });
    render(<InlineUploadProgress upload={upload} variant="audio" />);
    expect(screen.getByText("Finalizing...")).toBeInTheDocument();
  });

  it("progress bar scaleX matches upload.progress / 100", () => {
    const upload = makeUpload({ progress: 60 });
    const { container } = render(<InlineUploadProgress upload={upload} variant="video" />);

    const progressFill = container.querySelector("[role='progressbar']") as HTMLElement;
    expect(progressFill).toBeTruthy();
    expect(progressFill.style.transform).toBe("scaleX(0.6)");
  });

  it("progress bar scaleX is 0 when progress is 0", () => {
    const upload = makeUpload({ progress: 0 });
    const { container } = render(<InlineUploadProgress upload={upload} variant="video" />);

    const progressFill = container.querySelector("[role='progressbar']") as HTMLElement;
    expect(progressFill.style.transform).toBe("scaleX(0)");
  });

  it("progress bar scaleX is 1 when progress is 100", () => {
    const upload = makeUpload({ progress: 100, status: "uploading" });
    const { container } = render(<InlineUploadProgress upload={upload} variant="video" />);

    const progressFill = container.querySelector("[role='progressbar']") as HTMLElement;
    expect(progressFill.style.transform).toBe("scaleX(1)");
  });

  it("sets aria-valuenow on progress bar", () => {
    const upload = makeUpload({ progress: 33 });
    const { container } = render(<InlineUploadProgress upload={upload} variant="video" />);

    const progressFill = container.querySelector("[role='progressbar']") as HTMLElement;
    expect(progressFill).toHaveAttribute("aria-valuenow", "33");
  });
});
