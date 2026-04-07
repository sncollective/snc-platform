import type { DprImage, ResponsiveImage } from "@snc/shared";

import { config } from "../config.js";
import { buildImgproxyUrl, buildDprSrcSet, buildSrcSet, BANNER_WIDTHS } from "./imgproxy.js";

const BANNER_SIZES = "100vw";

/** Resolve avatar/banner URLs for a creator profile, including responsive image data. */
export const resolveCreatorUrls = (
  profile: { id: string; avatarKey: string | null; bannerKey: string | null },
): {
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatar: DprImage | null;
  banner: ResponsiveImage | null;
} => {
  const avatarFallback = profile.avatarKey
    ? `/api/creators/${profile.id}/avatar`
    : null;
  const bannerFallback = profile.bannerKey
    ? `/api/creators/${profile.id}/banner`
    : null;

  if (!config.IMGPROXY_URL) {
    return {
      avatarUrl: avatarFallback,
      bannerUrl: bannerFallback,
      avatar: null,
      banner: null,
    };
  }

  const avatar: DprImage | null = profile.avatarKey
    ? {
        src: buildImgproxyUrl(profile.avatarKey, 96),
        srcSet: buildDprSrcSet(profile.avatarKey, 96, 96),
      }
    : null;

  const banner: ResponsiveImage | null = profile.bannerKey
    ? {
        src: buildImgproxyUrl(profile.bannerKey, 960),
        srcSet: buildSrcSet(profile.bannerKey, BANNER_WIDTHS),
        sizes: BANNER_SIZES,
      }
    : null;

  return {
    avatarUrl: avatarFallback,
    bannerUrl: bannerFallback,
    avatar,
    banner,
  };
};
