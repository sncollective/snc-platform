import {
  PressConfigPatchSchema,
  ValidationError,
  isLibraryAssetKey,
  isOwnedPressKey,
} from "@snc/shared";
import type { z } from "zod";

import { canUseAsset } from "./library.js";
import type { LibraryActor } from "./library.js";

type PressKeyReference = { readonly path: string; readonly key: string };

const collectPressKeyReferences = (
  patch: z.infer<typeof PressConfigPatchSchema>,
): PressKeyReference[] => {
  const references: PressKeyReference[] = [];
  const add = (path: string, key: string | null | undefined): void => {
    if (key) references.push({ path, key });
  };

  add("banner.key", patch.banner?.key);
  add("aboutPhoto.key", patch.aboutPhoto?.key);
  patch.members?.forEach((member, index) =>
    add(`members[${index}].photo.key`, member.photo?.key));
  patch.highlights?.forEach((highlight, index) =>
    add(`highlights[${index}].coverArt.key`, highlight.coverArt?.key));
  patch.gallery?.forEach((image, index) => add(`gallery[${index}].key`, image.key));
  patch.photos?.forEach((key, index) => add(`photos[${index}]`, key));
  patch.releases?.forEach((release, index) =>
    add(`releases[${index}].artKey`, release.artKey));

  return references;
};

/** Authorize every unique storage key referenced by a press-config mutation. */
export const validateOwnedPressKeys = async (
  patch: z.infer<typeof PressConfigPatchSchema>,
  actor: LibraryActor,
): Promise<void> => {
  const byKey = new Map<string, string[]>();
  for (const reference of collectPressKeyReferences(patch)) {
    const paths = byKey.get(reference.key) ?? [];
    paths.push(reference.path);
    byKey.set(reference.key, paths);
  }

  for (const [key, paths] of byKey) {
    if (isOwnedPressKey(key, actor.creatorId)) continue;
    if (isLibraryAssetKey(key) && await canUseAsset(actor, key)) continue;
    throw new ValidationError(
      `Press image at ${paths.join(", ")} is not available to this creator`,
    );
  }
};
