/** Resolve avatar/banner URLs for a creator profile. */
export const resolveCreatorUrls = (
  profile: { id: string; avatarKey: string | null; bannerKey: string | null },
): { avatarUrl: string | null; bannerUrl: string | null } => ({
  avatarUrl: profile.avatarKey
    ? `/api/creators/${profile.id}/avatar`
    : null,
  bannerUrl: profile.bannerKey
    ? `/api/creators/${profile.id}/banner`
    : null,
});
