import { ContentAssetUploadResponseSchema } from "@snc/shared";
import type { ContentAssetUploadResponse } from "@snc/shared";

export interface MediaPickerUploadOptions {
  readonly signal: AbortSignal;
  readonly onProgress: (percent: number) => void;
}

const readUploadError = (xhr: XMLHttpRequest): string => {
  try {
    const body = JSON.parse(xhr.responseText) as { error?: { message?: string } };
    return body.error?.message ?? xhr.statusText ?? "Upload failed";
  } catch {
    return xhr.statusText || "Upload failed";
  }
};

/** Upload one private library image with observable progress and cancellation. */
export const uploadMediaPickerImage = (
  creatorId: string,
  file: File,
  options: MediaPickerUploadOptions,
): Promise<ContentAssetUploadResponse> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = (): void => xhr.abort();
    options.signal.addEventListener("abort", abort, { once: true });

    xhr.open(
      "POST",
      `/api/creators/${encodeURIComponent(creatorId)}/library/assets`,
    );
    xhr.withCredentials = true;
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      options.onProgress(Math.max(1, Math.min(99, Math.round(event.loaded / event.total * 100))));
    });
    xhr.addEventListener("load", () => {
      options.signal.removeEventListener("abort", abort);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(readUploadError(xhr)));
        return;
      }
      try {
        options.onProgress(100);
        resolve(ContentAssetUploadResponseSchema.parse(JSON.parse(xhr.responseText)));
      } catch {
        reject(new Error("The upload response was invalid"));
      }
    });
    xhr.addEventListener("error", () => {
      options.signal.removeEventListener("abort", abort);
      reject(new Error("The connection was interrupted. Your library was not changed."));
    });
    xhr.addEventListener("abort", () => {
      options.signal.removeEventListener("abort", abort);
      reject(new DOMException("Upload canceled", "AbortError"));
    });

    const form = new FormData();
    form.append("file", file);
    form.append("sharing", "private");
    xhr.send(form);
  });
