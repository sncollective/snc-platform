import {
  PressContentSchema,
  PressHighlightSchema,
  PressImageSchema,
  PressMemberSchema,
  PRESS_IMAGE_SLOT_WIDTHS,
  type PressContent,
  type PressHighlight,
  type PressImage,
  type PressImageSlot,
  type PressMember,
} from "@snc/shared";

import { buildPressImageUrl } from "./imgproxy.js";

export interface PressImageDelivery {
  readonly src: string;
  readonly srcSet: string;
  readonly sizes: string;
}

export type DeliveredPressImage = PressImage & PressImageDelivery;

export interface DeliveredPressContent
  extends Omit<
    PressContent,
    "banner" | "aboutPhoto" | "members" | "highlights" | "gallery"
  > {
  readonly banner?: DeliveredPressImage | null;
  readonly aboutPhoto?: DeliveredPressImage | null;
  readonly members: readonly (Omit<PressMember, "photo"> & {
    readonly photo?: DeliveredPressImage | null;
  })[];
  readonly highlights: readonly (Omit<PressHighlight, "coverArt"> & {
    readonly coverArt?: DeliveredPressImage | null;
  })[];
  readonly gallery: readonly DeliveredPressImage[];
}

export const DeliveredPressImageSchema = PressImageSchema.extend({
  src: PressImageSchema.shape.key,
  srcSet: PressImageSchema.shape.key,
  sizes: PressImageSchema.shape.key,
});

export const DeliveredPressContentSchema = PressContentSchema.extend({
  banner: DeliveredPressImageSchema.nullable().optional(),
  aboutPhoto: DeliveredPressImageSchema.nullable().optional(),
  members: PressMemberSchema.extend({
    photo: DeliveredPressImageSchema.nullable().optional(),
  }).array(),
  highlights: PressHighlightSchema.extend({
    coverArt: DeliveredPressImageSchema.nullable().optional(),
  }).array(),
  gallery: DeliveredPressImageSchema.array(),
});

const deliver = (
  image: PressImage | null | undefined,
  slot: keyof PressImageSlot,
  width: number,
): DeliveredPressImage | null =>
  image ? { ...image, ...buildPressImageUrl(image, slot, width) } : null;

/** Resolve raw press image metadata into signed responsive public URLs. */
export const resolvePressPageContent = (
  content: PressContent,
): DeliveredPressContent => ({
  ...content,
  banner: deliver(content.banner, "banner", PRESS_IMAGE_SLOT_WIDTHS.banner),
  aboutPhoto: deliver(content.aboutPhoto, "about", PRESS_IMAGE_SLOT_WIDTHS.about),
  members: content.members.map((member) => ({
    ...member,
    photo: deliver(member.photo, "member", PRESS_IMAGE_SLOT_WIDTHS.member),
  })),
  highlights: content.highlights.map((highlight) => ({
    ...highlight,
    coverArt: deliver(highlight.coverArt, "cover", PRESS_IMAGE_SLOT_WIDTHS.cover),
  })),
  gallery: content.gallery.map((image) =>
    deliver(image, "gallery", PRESS_IMAGE_SLOT_WIDTHS.gallery)!),
});
