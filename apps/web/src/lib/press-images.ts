import { libraryRawPath } from "@snc/shared";
import type {
  PressImageCrop,
  PressImageSlotName,
} from "@snc/shared";

import { throwIfNotOk } from "./fetch-utils.js";

export type PressImageDescriptor = {
  src: string;
  srcSet: string;
  sizes: string;
};

/** Immutable public raw URL for a structurally valid content-library key. */
export const contentLibraryRawUrl = (key: string): string =>
  `/api/library/raw/${libraryRawPath(key)}`;

/** Request the server-signed descriptor used by eventual press delivery. */
export const requestPressImagePreview = async (input: {
  creatorId: string;
  key: string;
  crop: PressImageCrop;
  slot: PressImageSlotName;
  width: number;
  signal?: AbortSignal;
}): Promise<PressImageDescriptor> => {
  const response = await fetch(
    `/api/creators/${encodeURIComponent(input.creatorId)}/press/image-preview`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: input.key,
        crop: input.crop,
        slot: input.slot,
        width: input.width,
      }),
      ...(input.signal ? { signal: input.signal } : {}),
    },
  );
  await throwIfNotOk(response);
  return (await response.json()) as PressImageDescriptor;
};
