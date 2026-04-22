import { describe, it, expect } from "vitest";

import { deriveContentDisplayState } from "../../../src/hooks/use-content-display-state.js";
import type { ContentDisplayStateInputs } from "../../../src/hooks/use-content-display-state.js";
import type { ActiveUpload } from "../../../src/contexts/upload-context.js";

// ── Helpers ──

function makeUpload(overrides: Partial<ActiveUpload> = {}): ActiveUpload {
  return {
    id: "uppy-1",
    filename: "video.mp4",
    progress: 50,
    status: "uploading",
    resourceId: "content-1",
    purpose: "content-media",
    ...overrides,
  };
}

function inputs(overrides: Partial<ContentDisplayStateInputs> = {}): ContentDisplayStateInputs {
  return {
    mediaUrl: null,
    processingStatus: null,
    activeUpload: undefined,
    ...overrides,
  };
}

// ── Tests ──

describe("deriveContentDisplayState", () => {
  it("returns no-media when mediaUrl null, processingStatus null, no upload", () => {
    const result = deriveContentDisplayState(inputs());
    expect(result).toEqual({ phase: "no-media" });
  });

  it("returns uploading when activeUpload status is 'uploading'", () => {
    const upload = makeUpload({ status: "uploading" });
    const result = deriveContentDisplayState(inputs({ activeUpload: upload }));
    expect(result).toEqual({ phase: "uploading", upload });
  });

  it("returns uploading when activeUpload status is 'completing'", () => {
    const upload = makeUpload({ status: "completing" });
    const result = deriveContentDisplayState(inputs({ activeUpload: upload }));
    expect(result).toEqual({ phase: "uploading", upload });
  });

  it("returns processing when processingStatus is 'uploaded'", () => {
    const result = deriveContentDisplayState(inputs({ processingStatus: "uploaded" }));
    expect(result).toEqual({ phase: "processing", status: "uploaded" });
  });

  it("returns processing when processingStatus is 'processing'", () => {
    const result = deriveContentDisplayState(inputs({ processingStatus: "processing" }));
    expect(result).toEqual({ phase: "processing", status: "processing" });
  });

  it("returns ready when mediaUrl present and processingStatus is 'ready'", () => {
    const result = deriveContentDisplayState(inputs({ mediaUrl: "https://cdn.example.com/v.mp4", processingStatus: "ready" }));
    expect(result).toEqual({ phase: "ready" });
  });

  it("returns ready when mediaUrl present and processingStatus is null", () => {
    const result = deriveContentDisplayState(inputs({ mediaUrl: "https://cdn.example.com/v.mp4", processingStatus: null }));
    expect(result).toEqual({ phase: "ready" });
  });

  it("returns failed when processingStatus is 'failed'", () => {
    const result = deriveContentDisplayState(inputs({ processingStatus: "failed" }));
    expect(result).toEqual({ phase: "failed" });
  });

  it("upload with status 'complete' does NOT show uploading phase — falls through to processingStatus", () => {
    const upload = makeUpload({ status: "complete" });
    // processingStatus is "uploaded" — should show processing, not uploading
    const result = deriveContentDisplayState(inputs({ activeUpload: upload, processingStatus: "uploaded" }));
    expect(result).toEqual({ phase: "processing", status: "uploaded" });
  });

  it("upload with status 'error' does NOT show uploading phase — falls through", () => {
    const upload = makeUpload({ status: "error", error: "Network failure" });
    // No processingStatus, no mediaUrl — should show no-media
    const result = deriveContentDisplayState(inputs({ activeUpload: upload }));
    expect(result).toEqual({ phase: "no-media" });
  });

  it("failed phase takes priority over processing phase when processingStatus is failed", () => {
    // processingStatus "failed" has higher priority than "uploaded"/"processing"
    const result = deriveContentDisplayState(inputs({ processingStatus: "failed" }));
    expect(result.phase).toBe("failed");
  });

  it("uploading phase takes priority over processing phase", () => {
    const upload = makeUpload({ status: "uploading" });
    // Even if processingStatus is "processing", active upload wins
    const result = deriveContentDisplayState(inputs({ activeUpload: upload, processingStatus: "processing" }));
    expect(result).toEqual({ phase: "uploading", upload });
  });
});
