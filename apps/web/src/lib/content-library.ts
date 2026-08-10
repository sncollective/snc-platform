import type {
  ContentAssetList,
  ContentAssetUploadResponse,
} from "@snc/shared";

import { apiGet, apiUpload } from "./fetch-utils.js";
import { contentLibraryRawUrl } from "./press-images.js";

/** Upload an immutable private image registration to a creator's content library. */
export const uploadContentLibraryImage = async (
  creatorId: string,
  file: File,
  usage?: "avatar" | "banner",
): Promise<ContentAssetUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  if (usage) formData.append("usage", usage);
  else formData.append("sharing", "private");
  return apiUpload<ContentAssetUploadResponse>(
    `/api/creators/${encodeURIComponent(creatorId)}/library/assets`,
    formData,
  );
};

/** Browse the creator's own and shared-pool library registrations. */
export const fetchContentLibraryImages = async (
  creatorId: string,
  before?: string,
  signal?: AbortSignal,
): Promise<ContentAssetList> =>
  apiGet<ContentAssetList>(
    `/api/creators/${encodeURIComponent(creatorId)}/library/assets`,
    before ? { before } : undefined,
    signal,
  );

/** Public immutable thumbnail URL for a library asset. */
export const contentLibraryThumbnailUrl = contentLibraryRawUrl;
