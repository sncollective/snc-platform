import { isLibraryAssetKey, libraryRawPath } from "@snc/shared";

import { config } from "../config.js";
import { buildImgproxyUrl, buildSrcSet } from "./imgproxy.js";

/** No-imgproxy fallback URL for a content-addressed library key. */
export const libraryRawUrl = (key: string): string =>
  `/api/library/raw/${libraryRawPath(key)}`;

/** Resolve a library key to an imgproxy image or immutable raw fallback. */
export const resolveLibraryImage = (key: string, widths: readonly number[]) =>
  isLibraryAssetKey(key)
    ? {
        src: config.IMGPROXY_URL
          ? buildImgproxyUrl(key, widths[0]!)
          : libraryRawUrl(key),
        srcSet: config.IMGPROXY_URL ? buildSrcSet(key, widths) : undefined,
        sizes: undefined as string | undefined,
      }
    : null;
