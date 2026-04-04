"use no memo";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type React from "react";
import type { ReactNode } from "react";

import Uppy from "@uppy/core";
import type { Body, Meta, UppyFile } from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import type { UploadPurpose } from "@snc/shared";
import { MULTIPART_THRESHOLD, MULTIPART_CHUNK_SIZE } from "@snc/shared";

import {
  presignUpload,
  createMultipartUpload,
  signPart,
  completeMultipartUpload,
  abortMultipartUpload,
  listParts,
  completeUpload,
  retryWithBackoff,
} from "../lib/uploads.js";
import { uploadContentFile } from "../lib/content.js";
import { apiUpload } from "../lib/fetch-utils.js";

// ── Public Types ──

export interface ActiveUpload {
  readonly id: string;
  readonly filename: string;
  readonly progress: number; // 0-100
  readonly status: "uploading" | "completing" | "complete" | "error";
  readonly error?: string;
}

export interface UploadState {
  readonly activeUploads: readonly ActiveUpload[];
  readonly isUploading: boolean;
  readonly isExpanded: boolean;
}

export interface StartUploadOptions {
  readonly file: File;
  readonly purpose: UploadPurpose;
  readonly resourceId: string;
  readonly onComplete?: ((key: string) => void) | undefined;
  readonly onError?: ((error: Error) => void) | undefined;
}

export interface UploadActions {
  readonly startUpload: (options: StartUploadOptions) => void;
  readonly cancelUpload: (fileId: string) => void;
  readonly cancelAll: () => void;
  readonly dismissCompleted: () => void;
  readonly toggleExpanded: () => void;
}

export interface UploadContextValue {
  readonly state: UploadState;
  readonly actions: UploadActions;
}

// ── Constants ──

export const INITIAL_UPLOAD_STATE: UploadState = {
  activeUploads: [],
  isUploading: false,
  isExpanded: false,
};

// ── Reducer ──

type UploadAction =
  | { readonly type: "ADD_UPLOAD"; readonly id: string; readonly filename: string }
  | { readonly type: "UPDATE_PROGRESS"; readonly id: string; readonly progress: number }
  | { readonly type: "SET_STATUS"; readonly id: string; readonly status: ActiveUpload["status"]; readonly error?: string }
  | { readonly type: "REMOVE_UPLOAD"; readonly id: string }
  | { readonly type: "CLEAR_COMPLETED" }
  | { readonly type: "TOGGLE_EXPANDED" };

const isStillUploading = (uploads: readonly ActiveUpload[]): boolean =>
  uploads.some((u) => u.status === "uploading" || u.status === "completing");

export function uploadReducer(
  state: UploadState,
  action: UploadAction,
): UploadState {
  switch (action.type) {
    case "ADD_UPLOAD": {
      const upload: ActiveUpload = {
        id: action.id,
        filename: action.filename,
        progress: 0,
        status: "uploading",
      };
      const activeUploads = [...state.activeUploads, upload];
      return {
        ...state,
        activeUploads,
        isUploading: true,
      };
    }
    case "UPDATE_PROGRESS": {
      const activeUploads = state.activeUploads.map((u) =>
        u.id === action.id ? { ...u, progress: action.progress } : u,
      );
      return { ...state, activeUploads };
    }
    case "SET_STATUS": {
      const activeUploads = state.activeUploads.map((u) =>
        u.id === action.id
          ? { ...u, status: action.status, ...(action.error !== undefined && { error: action.error }) }
          : u,
      );
      return { ...state, activeUploads, isUploading: isStillUploading(activeUploads) };
    }
    case "REMOVE_UPLOAD": {
      const activeUploads = state.activeUploads.filter((u) => u.id !== action.id);
      return { ...state, activeUploads, isUploading: isStillUploading(activeUploads) };
    }
    case "CLEAR_COMPLETED": {
      const activeUploads = state.activeUploads.filter(
        (u) => u.status === "uploading" || u.status === "completing",
      );
      return { ...state, activeUploads };
    }
    case "TOGGLE_EXPANDED":
      return { ...state, isExpanded: !state.isExpanded };
  }
}

// ── Private Helpers ──

async function probeS3Availability(
  s3AvailableRef: React.MutableRefObject<boolean | null>,
  params: { purpose: UploadPurpose; resourceId: string; filename: string; contentType: string; size: number },
): Promise<boolean> {
  if (s3AvailableRef.current !== null) return s3AvailableRef.current;
  try {
    await presignUpload(params);
    s3AvailableRef.current = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("S3_NOT_CONFIGURED") || message.includes("Direct uploads require S3")) {
      s3AvailableRef.current = false;
    } else {
      throw err; // Real S3 error — don't silently fall back
    }
  }
  return s3AvailableRef.current!;
}

// ── Private Legacy Helper ──

async function uploadLegacy(
  file: File,
  purpose: UploadPurpose,
  resourceId: string,
): Promise<void> {
  switch (purpose) {
    case "content-media":
      await uploadContentFile(resourceId, "media", file);
      break;
    case "content-thumbnail":
      await uploadContentFile(resourceId, "thumbnail", file);
      break;
    case "creator-avatar": {
      const fd = new FormData();
      fd.append("file", file);
      await apiUpload(`/api/creators/${encodeURIComponent(resourceId)}/avatar`, fd);
      break;
    }
    case "creator-banner": {
      const fd = new FormData();
      fd.append("file", file);
      await apiUpload(`/api/creators/${encodeURIComponent(resourceId)}/banner`, fd);
      break;
    }
  }
}

// ── Context ──

const UploadContext = createContext<UploadContextValue | null>(null);

// ── Provider ──

/** Manage file uploads via Uppy with S3 multipart support and legacy fallback. Tracks per-file progress, completion, and errors. Consume with `useUpload`. */
export function UploadProvider({
  children,
}: Readonly<{ children: ReactNode }>): React.ReactElement {
  const [state, dispatch] = useReducer(uploadReducer, INITIAL_UPLOAD_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const uppyRef = useRef<Uppy | null>(null);
  const s3AvailableRef = useRef<boolean | null>(null); // null = unknown
  const callbacksRef = useRef<
    Map<string, { onComplete?: ((key: string) => void) | undefined; onError?: ((error: Error) => void) | undefined }>
  >(new Map());

  // Lazy Uppy initialization
  if (!uppyRef.current) {
    uppyRef.current = new Uppy({
      autoProceed: true,
    }).use(AwsS3, {
      shouldUseMultipart: (file) => (file.size ?? 0) > MULTIPART_THRESHOLD,
      getChunkSize: () => MULTIPART_CHUNK_SIZE,

      async getUploadParameters(file) {
        const resp = await presignUpload({
          purpose: file.meta.purpose as UploadPurpose,
          resourceId: file.meta.resourceId as string,
          filename: file.name ?? "upload",
          contentType: file.type ?? "application/octet-stream",
          size: file.size ?? 0,
        });
        uppyRef.current?.setFileMeta(file.id, { key: resp.key });
        return {
          method: "PUT",
          url: resp.url,
          headers: { "Content-Type": file.type ?? "application/octet-stream" },
        };
      },

      async createMultipartUpload(file) {
        const resp = await createMultipartUpload({
          purpose: file.meta.purpose as UploadPurpose,
          resourceId: file.meta.resourceId as string,
          filename: file.name ?? "upload",
          contentType: file.type ?? "application/octet-stream",
          size: file.size ?? 0,
        });
        uppyRef.current?.setFileMeta(file.id, { key: resp.key });
        return resp;
      },

      async signPart(_file, opts) {
        const resp = await signPart(opts.uploadId, opts.partNumber, opts.key);
        return { url: resp.url };
      },

      async completeMultipartUpload(_file, opts) {
        const parts = opts.parts
          .filter((p): p is typeof p & { PartNumber: number; ETag: string } =>
            p.PartNumber != null && p.ETag != null,
          );
        await completeMultipartUpload(opts.uploadId, opts.key, parts);
        return {};
      },

      async abortMultipartUpload(_file, opts) {
        await abortMultipartUpload(opts.uploadId!, opts.key);
      },

      async listParts(_file, opts) {
        return listParts(opts.uploadId!, opts.key);
      },
    });
  }

  // Uppy event listeners
  useEffect(() => {
    const uppy = uppyRef.current;
    if (!uppy) return;

    const onProgress = (file: UppyFile<Meta, Body> | undefined, progress: { bytesUploaded: number; bytesTotal: number | null }) => {
      if (file?.id && progress.bytesUploaded != null && progress.bytesTotal) {
        const pct = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
        const current = stateRef.current.activeUploads.find((u) => u.id === file.id);
        if (!current || pct > current.progress) {
          dispatch({ type: "UPDATE_PROGRESS", id: file.id, progress: pct });
        }
      }
    };

    const onSuccess = (file: UppyFile<Meta, Body> | undefined, response: NonNullable<UppyFile<Meta, Body>["response"]>) => {
      const key = (response.body as Record<string, unknown> | undefined)?.key as string ?? file?.meta?.key as string ?? "";
      const fileId = file?.id;
      if (!fileId) return;

      dispatch({ type: "SET_STATUS", id: fileId, status: "completing" });

      const purpose = file.meta.purpose as UploadPurpose;
      const resourceId = file.meta.resourceId as string;

      retryWithBackoff(() => completeUpload({ key, purpose, resourceId }), 3)
        .then(() => {
          dispatch({ type: "SET_STATUS", id: fileId, status: "complete" });
          callbacksRef.current.get(fileId)?.onComplete?.(key);
          callbacksRef.current.delete(fileId);
        })
        .catch((err: Error) => {
          uppyRef.current?.removeFile(fileId);
          dispatch({ type: "SET_STATUS", id: fileId, status: "error", error: err.message });
          callbacksRef.current.get(fileId)?.onError?.(err);
          callbacksRef.current.delete(fileId);
        });
    };

    const onError = (file: UppyFile<Meta, Body> | undefined, error: Error) => {
      const fileId = file?.id;
      if (!fileId) return;
      // Remove file from Uppy to clean up stale multipart state (uploadId, parts).
      // This triggers the AwsS3 plugin's abortMultipartUpload handler if a
      // multipart upload was in progress, preventing "already exists" on retry.
      uppyRef.current?.removeFile(fileId);
      dispatch({ type: "SET_STATUS", id: fileId, status: "error", error: error.message });
      callbacksRef.current.get(fileId)?.onError?.(error);
      callbacksRef.current.delete(fileId);
    };

    uppy.on("upload-progress", onProgress);
    uppy.on("upload-success", onSuccess);
    uppy.on("upload-error", onError);

    return () => {
      uppy.off("upload-progress", onProgress);
      uppy.off("upload-success", onSuccess);
      uppy.off("upload-error", onError);
    };
  }, []);

  // beforeunload guard
  useEffect(() => {
    if (!state.isUploading) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.isUploading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      uppyRef.current?.destroy();
      uppyRef.current = null;
    };
  }, []);

  // Memoized actions
  const actions = useMemo<UploadActions>(() => ({
    startUpload: (options: StartUploadOptions) => {
      const { file, purpose, resourceId, onComplete, onError } = options;

      // Probe S3 availability on first call, then fire-and-forget
      const doUpload = async () => {
        const s3 = await probeS3Availability(s3AvailableRef, {
          purpose,
          resourceId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });

        if (s3) {
          // S3 path: add file to Uppy (autoProceed handles upload start)
          const uppy = uppyRef.current;
          if (!uppy) return;
          const fileId = uppy.addFile({
            name: file.name,
            type: file.type,
            data: file,
            meta: { purpose, resourceId },
          });
          callbacksRef.current.set(fileId, { onComplete, onError });
          dispatch({ type: "ADD_UPLOAD", id: fileId, filename: file.name });
        } else {
          // Legacy fallback path (STORAGE_TYPE=local)
          const legacyId = `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          callbacksRef.current.set(legacyId, { onComplete, onError });
          dispatch({ type: "ADD_UPLOAD", id: legacyId, filename: file.name });

          try {
            await uploadLegacy(file, purpose, resourceId);
            dispatch({ type: "SET_STATUS", id: legacyId, status: "complete" });
            callbacksRef.current.get(legacyId)?.onComplete?.("");
          } catch (err) {
            const error = err instanceof Error ? err : new Error("Upload failed");
            dispatch({ type: "SET_STATUS", id: legacyId, status: "error", error: error.message });
            callbacksRef.current.get(legacyId)?.onError?.(error);
          } finally {
            callbacksRef.current.delete(legacyId);
          }
        }
      };

      doUpload().catch((err) => {
        const error = err instanceof Error ? err : new Error("Upload failed");
        onError?.(error);
      });
    },

    cancelUpload: (fileId: string) => {
      if (fileId.startsWith("legacy-")) {
        // Can't cancel legacy uploads — just remove from state
        dispatch({ type: "REMOVE_UPLOAD", id: fileId });
      } else {
        uppyRef.current?.removeFile(fileId);
        dispatch({ type: "REMOVE_UPLOAD", id: fileId });
      }
      callbacksRef.current.delete(fileId);
    },

    cancelAll: () => {
      uppyRef.current?.cancelAll();
      const current = stateRef.current.activeUploads;
      for (const upload of current) {
        callbacksRef.current.delete(upload.id);
        dispatch({ type: "REMOVE_UPLOAD", id: upload.id });
      }
    },

    dismissCompleted: () => {
      dispatch({ type: "CLEAR_COMPLETED" });
    },

    toggleExpanded: () => {
      dispatch({ type: "TOGGLE_EXPANDED" });
    },
  }), []);
  // Note: actions are stable (no deps) because they use refs and dispatch

  const value = useMemo<UploadContextValue>(
    () => ({ state, actions }),
    [state, actions],
  );

  return (
    <UploadContext value={value}>
      {children}
    </UploadContext>
  );
}

// ── Consumer Hook ──

export function useUpload(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
