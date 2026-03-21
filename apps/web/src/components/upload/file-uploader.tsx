import { useEffect, useRef } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import { Dashboard } from "@uppy/react/dashboard";
import type { UploadPurpose } from "@snc/shared";
import { MULTIPART_THRESHOLD } from "@snc/shared";
import {
  presignUpload,
  createMultipartUpload,
  signPart,
  completeMultipartUpload,
  retryWithBackoff,
  abortMultipartUpload,
  listParts,
  completeUpload,
} from "../../lib/uploads.js";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

export type FileUploaderProps = {
  purpose: UploadPurpose;
  resourceId: string;
  acceptedTypes: readonly string[];
  maxFileSize: number;
  maxFiles?: number;
  onUploadComplete: (key: string) => void;
  onUploadError?: (error: Error) => void;
};

export function FileUploader({
  purpose,
  resourceId,
  acceptedTypes,
  maxFileSize,
  maxFiles = 1,
  onUploadComplete,
  onUploadError,
}: FileUploaderProps) {
  const uppyRef = useRef<Uppy | null>(null);

  if (!uppyRef.current) {
    uppyRef.current = new Uppy({
      restrictions: {
        maxFileSize,
        maxNumberOfFiles: maxFiles,
        allowedFileTypes: [...acceptedTypes],
      },
    }).use(AwsS3, {
      shouldUseMultipart: (file) => (file.size ?? 0) > MULTIPART_THRESHOLD,

      async getUploadParameters(file) {
        const resp = await presignUpload({
          purpose,
          resourceId,
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
        return createMultipartUpload({
          purpose,
          resourceId,
          filename: file.name ?? "upload",
          contentType: file.type ?? "application/octet-stream",
          size: file.size ?? 0,
        });
      },

      async signPart(file, opts) {
        const resp = await signPart(opts.uploadId, opts.partNumber, opts.key);
        return { url: resp.url };
      },

      async completeMultipartUpload(file, opts) {
        await completeMultipartUpload(opts.uploadId, opts.key, opts.parts);
        return {};
      },

      async abortMultipartUpload(file, opts) {
        await abortMultipartUpload(opts.uploadId, opts.key);
      },

      async listParts(file, opts) {
        return listParts(opts.uploadId, opts.key);
      },
    });
  }

  useEffect(() => {
    const uppy = uppyRef.current;
    if (!uppy) return;

    const onSuccess = (file: any, response: any) => {
      const key = response?.body?.key ?? file.meta?.key;
      if (key) {
        retryWithBackoff(() => completeUpload({ key, purpose, resourceId }), 3)
          .then(() => onUploadComplete(key))
          .catch((err: Error) => onUploadError?.(err));
      }
    };

    const onError = (file: any, error: Error) => {
      onUploadError?.(error);
    };

    uppy.on("upload-success", onSuccess);
    uppy.on("upload-error", onError);

    return () => {
      uppy.off("upload-success", onSuccess);
      uppy.off("upload-error", onError);
    };
  }, [purpose, resourceId, onUploadComplete, onUploadError]);

  useEffect(() => {
    return () => {
      uppyRef.current?.destroy();
      uppyRef.current = null;
    };
  }, []);

  return (
    <Dashboard
      uppy={uppyRef.current!}
      proudlyDisplayPoweredByUppy={false}
      showProgressDetails
      height={350}
    />
  );
}
