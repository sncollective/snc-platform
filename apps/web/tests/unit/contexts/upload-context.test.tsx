import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

// ── Hoisted Mocks ──

const {
  mockUppyOn,
  mockUppyOff,
  mockUppyCancelAll,
  mockUppyAddFile,
  mockUppyRemoveFile,
  mockUppyGetFile,
  mockUppyDestroy,
  mockUppySetFileMeta,
  mockUppyUse,
} = vi.hoisted(() => ({
  mockUppyOn: vi.fn(),
  mockUppyOff: vi.fn(),
  mockUppyCancelAll: vi.fn(),
  mockUppyAddFile: vi.fn().mockReturnValue("uppy-file-id"),
  mockUppyRemoveFile: vi.fn(),
  mockUppyGetFile: vi.fn().mockReturnValue(undefined),
  mockUppyDestroy: vi.fn(),
  mockUppySetFileMeta: vi.fn(),
  mockUppyUse: vi.fn(),
}));

vi.mock("@uppy/core", () => {
  function MockUppy(this: any) {
    this.on = mockUppyOn;
    this.off = mockUppyOff;
    this.cancelAll = mockUppyCancelAll;
    this.addFile = mockUppyAddFile;
    this.removeFile = mockUppyRemoveFile;
    this.getFile = mockUppyGetFile;
    this.destroy = mockUppyDestroy;
    this.setFileMeta = mockUppySetFileMeta;
    this.use = mockUppyUse.mockReturnThis();
  }
  return { default: MockUppy };
});

vi.mock("@uppy/aws-s3", () => ({ default: vi.fn() }));
vi.mock("@uppy/tus", () => ({ default: vi.fn() }));

vi.mock("../../../src/lib/uploads.js", () => ({
  presignUpload: vi.fn().mockRejectedValue(new Error("S3_NOT_CONFIGURED")),
  createMultipartUpload: vi.fn(),
  signPart: vi.fn(),
  completeMultipartUpload: vi.fn(),
  abortMultipartUpload: vi.fn(),
  listParts: vi.fn(),
  completeUpload: vi.fn().mockResolvedValue(undefined),
  retryWithBackoff: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../../../src/lib/content.js", () => ({
  uploadContentFile: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../src/lib/fetch-utils.js", () => ({
  apiUpload: vi.fn().mockResolvedValue({}),
}));

// ── Import after mocks ──

import {
  uploadReducer,
  INITIAL_UPLOAD_STATE,
  UploadProvider,
  useUpload,
} from "../../../src/contexts/upload-context.js";
import type { UploadState } from "../../../src/contexts/upload-context.js";

// ── Wrapper ──

function wrapper({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  return <UploadProvider>{children}</UploadProvider>;
}

// ── Reducer Tests ──

describe("uploadReducer", () => {
  it("ADD_UPLOAD adds upload to array and sets isUploading true", () => {
    const result = uploadReducer(INITIAL_UPLOAD_STATE, {
      type: "ADD_UPLOAD",
      id: "file-1",
      filename: "video.mp4",
      resourceId: "content-1",
      purpose: "content-media",
    });

    expect(result.activeUploads).toHaveLength(1);
    expect(result.activeUploads[0]).toEqual({
      id: "file-1",
      filename: "video.mp4",
      progress: 0,
      status: "uploading",
      resourceId: "content-1",
      purpose: "content-media",
    });
    expect(result.isUploading).toBe(true);
  });

  it("ADD_UPLOAD with resourceId and purpose stores both fields on the upload entry", () => {
    const result = uploadReducer(INITIAL_UPLOAD_STATE, {
      type: "ADD_UPLOAD",
      id: "file-2",
      filename: "audio.mp3",
      resourceId: "content-42",
      purpose: "content-thumbnail",
    });

    const upload = result.activeUploads[0];
    expect(upload?.resourceId).toBe("content-42");
    expect(upload?.purpose).toBe("content-thumbnail");
  });

  it("resourceId persists through UPDATE_PROGRESS", () => {
    const afterAdd = uploadReducer(INITIAL_UPLOAD_STATE, {
      type: "ADD_UPLOAD",
      id: "file-1",
      filename: "video.mp4",
      resourceId: "content-7",
      purpose: "content-media",
    });

    const afterProgress = uploadReducer(afterAdd, {
      type: "UPDATE_PROGRESS",
      id: "file-1",
      progress: 75,
    });

    expect(afterProgress.activeUploads[0]?.resourceId).toBe("content-7");
    expect(afterProgress.activeUploads[0]?.purpose).toBe("content-media");
  });

  it("resourceId persists through SET_STATUS", () => {
    const afterAdd = uploadReducer(INITIAL_UPLOAD_STATE, {
      type: "ADD_UPLOAD",
      id: "file-1",
      filename: "video.mp4",
      resourceId: "content-7",
      purpose: "content-media",
    });

    const afterStatus = uploadReducer(afterAdd, {
      type: "SET_STATUS",
      id: "file-1",
      status: "completing",
    });

    expect(afterStatus.activeUploads[0]?.resourceId).toBe("content-7");
    expect(afterStatus.activeUploads[0]?.purpose).toBe("content-media");
  });

  it("UPDATE_PROGRESS updates the correct upload's progress", () => {
    const state: UploadState = {
      ...INITIAL_UPLOAD_STATE,
      activeUploads: [
        { id: "file-1", filename: "a.mp4", progress: 0, status: "uploading", resourceId: "c-1", purpose: "content-media" },
        { id: "file-2", filename: "b.mp4", progress: 0, status: "uploading", resourceId: "c-2", purpose: "content-media" },
      ],
      isUploading: true,
    };

    const result = uploadReducer(state, {
      type: "UPDATE_PROGRESS",
      id: "file-1",
      progress: 50,
    });

    expect(result.activeUploads[0]!.progress).toBe(50);
    expect(result.activeUploads[1]!.progress).toBe(0);
  });

  it("SET_STATUS updates status and recalculates isUploading", () => {
    const state: UploadState = {
      ...INITIAL_UPLOAD_STATE,
      activeUploads: [
        { id: "file-1", filename: "a.mp4", progress: 100, status: "uploading", resourceId: "c-1", purpose: "content-media" },
      ],
      isUploading: true,
    };

    const result = uploadReducer(state, {
      type: "SET_STATUS",
      id: "file-1",
      status: "complete",
    });

    expect(result.activeUploads[0]!.status).toBe("complete");
    expect(result.isUploading).toBe(false);
  });

  it("SET_STATUS with error sets error message", () => {
    const state: UploadState = {
      ...INITIAL_UPLOAD_STATE,
      activeUploads: [
        { id: "file-1", filename: "a.mp4", progress: 0, status: "uploading", resourceId: "c-1", purpose: "content-media" },
      ],
      isUploading: true,
    };

    const result = uploadReducer(state, {
      type: "SET_STATUS",
      id: "file-1",
      status: "error",
      error: "Network failure",
    });

    expect(result.activeUploads[0]!.status).toBe("error");
    expect(result.activeUploads[0]!.error).toBe("Network failure");
  });

  it("REMOVE_UPLOAD removes upload and recalculates isUploading", () => {
    const state: UploadState = {
      ...INITIAL_UPLOAD_STATE,
      activeUploads: [
        { id: "file-1", filename: "a.mp4", progress: 0, status: "uploading", resourceId: "c-1", purpose: "content-media" },
        { id: "file-2", filename: "b.mp4", progress: 0, status: "uploading", resourceId: "c-2", purpose: "content-media" },
      ],
      isUploading: true,
    };

    const result = uploadReducer(state, {
      type: "REMOVE_UPLOAD",
      id: "file-1",
    });

    expect(result.activeUploads).toHaveLength(1);
    expect(result.activeUploads[0]!.id).toBe("file-2");
    expect(result.isUploading).toBe(true);
  });

  it("REMOVE_UPLOAD sets isUploading false when all removed", () => {
    const state: UploadState = {
      ...INITIAL_UPLOAD_STATE,
      activeUploads: [
        { id: "file-1", filename: "a.mp4", progress: 0, status: "uploading", resourceId: "c-1", purpose: "content-media" },
      ],
      isUploading: true,
    };

    const result = uploadReducer(state, {
      type: "REMOVE_UPLOAD",
      id: "file-1",
    });

    expect(result.activeUploads).toHaveLength(0);
    expect(result.isUploading).toBe(false);
  });

  it("CLEAR_COMPLETED removes complete and error uploads, keeps active", () => {
    const state: UploadState = {
      ...INITIAL_UPLOAD_STATE,
      activeUploads: [
        { id: "file-1", filename: "a.mp4", progress: 100, status: "complete", resourceId: "c-1", purpose: "content-media" },
        { id: "file-2", filename: "b.mp4", progress: 0, status: "uploading", resourceId: "c-2", purpose: "content-media" },
        { id: "file-3", filename: "c.mp4", progress: 0, status: "error", error: "fail", resourceId: "c-3", purpose: "content-media" },
      ],
      isUploading: true,
    };

    const result = uploadReducer(state, { type: "CLEAR_COMPLETED" });

    expect(result.activeUploads).toHaveLength(1);
    expect(result.activeUploads[0]!.id).toBe("file-2");
  });

  it("TOGGLE_EXPANDED flips the isExpanded boolean", () => {
    const result = uploadReducer(INITIAL_UPLOAD_STATE, { type: "TOGGLE_EXPANDED" });
    expect(result.isExpanded).toBe(true);

    const result2 = uploadReducer(result, { type: "TOGGLE_EXPANDED" });
    expect(result2.isExpanded).toBe(false);
  });
});

// ── Provider + Hook Tests ──

describe("useUpload", () => {
  beforeEach(() => {
    mockUppyOn.mockReset();
    mockUppyOff.mockReset();
    mockUppyAddFile.mockReturnValue("uppy-file-id");
    mockUppyGetFile.mockReturnValue(undefined);
  });

  it("throws when used outside UploadProvider", () => {
    expect(() => {
      renderHook(() => useUpload());
    }).toThrow("useUpload must be used within an UploadProvider");
  });

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useUpload(), { wrapper });

    expect(result.current.state).toEqual(INITIAL_UPLOAD_STATE);
  });

  it("startUpload dispatches ADD_UPLOAD via legacy path (S3 not configured)", async () => {
    const { result } = renderHook(() => useUpload(), { wrapper });

    const file = new File(["data"], "audio.mp3", { type: "audio/mpeg" });

    await act(async () => {
      result.current.actions.startUpload({
        file,
        purpose: "content-media",
        resourceId: "content-1",
      });
      // Allow async probe to settle
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.activeUploads.length).toBeGreaterThan(0);
  });

  it("startUpload includes resourceId and purpose on the created upload entry", async () => {
    const { result } = renderHook(() => useUpload(), { wrapper });

    const file = new File(["data"], "audio.mp3", { type: "audio/mpeg" });

    await act(async () => {
      result.current.actions.startUpload({
        file,
        purpose: "content-media",
        resourceId: "content-99",
      });
      await new Promise((r) => setTimeout(r, 10));
    });

    const upload = result.current.state.activeUploads[0];
    expect(upload?.resourceId).toBe("content-99");
    expect(upload?.purpose).toBe("content-media");
  });

  it("cancelUpload removes upload from state", async () => {
    const { result } = renderHook(() => useUpload(), { wrapper });

    const file = new File(["data"], "audio.mp3", { type: "audio/mpeg" });

    await act(async () => {
      result.current.actions.startUpload({
        file,
        purpose: "content-media",
        resourceId: "content-1",
      });
      await new Promise((r) => setTimeout(r, 10));
    });

    const uploadId = result.current.state.activeUploads[0]?.id;
    expect(uploadId).toBeDefined();

    act(() => {
      result.current.actions.cancelUpload(uploadId!);
    });

    expect(result.current.state.activeUploads.find((u) => u.id === uploadId)).toBeUndefined();
  });

  it("toggleExpanded flips isExpanded", () => {
    const { result } = renderHook(() => useUpload(), { wrapper });

    expect(result.current.state.isExpanded).toBe(false);

    act(() => {
      result.current.actions.toggleExpanded();
    });

    expect(result.current.state.isExpanded).toBe(true);
  });

  it("dismissCompleted clears completed uploads", async () => {
    const { result } = renderHook(() => useUpload(), { wrapper });

    const file = new File(["data"], "audio.mp3", { type: "audio/mpeg" });

    await act(async () => {
      result.current.actions.startUpload({
        file,
        purpose: "content-media",
        resourceId: "content-1",
      });
      await new Promise((r) => setTimeout(r, 20));
    });

    act(() => {
      result.current.actions.dismissCompleted();
    });

    expect(
      result.current.state.activeUploads.filter(
        (u) => u.status === "complete" || u.status === "error",
      ),
    ).toHaveLength(0);
  });

  it("beforeunload listener registered when isUploading", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    const { result } = renderHook(() => useUpload(), { wrapper });

    const file = new File(["data"], "audio.mp3", { type: "audio/mpeg" });

    await act(async () => {
      result.current.actions.startUpload({
        file,
        purpose: "content-media",
        resourceId: "content-1",
      });
      await new Promise((r) => setTimeout(r, 5));
    });

    // If an upload is in uploading state, beforeunload should be registered
    if (result.current.state.isUploading) {
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function),
      );
    }

    addEventListenerSpy.mockRestore();
  });
});
