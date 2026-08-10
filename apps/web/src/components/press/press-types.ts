import type {
  PressContent,
  PressHighlight,
  PressImage,
  PressImageSlot,
  PressMember,
  PressPagePayload,
} from "@snc/shared";

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

export interface DeliveredPressPagePayload
  extends Omit<PressPagePayload, "content"> {
  readonly content: DeliveredPressContent;
}

export interface PressLiveDate {
  readonly id: string;
  readonly dateTime: string;
  readonly dateLabel: string;
  readonly venue: string;
  readonly city: string;
  readonly ticketUrl: string;
}

export interface PressTemplateProps {
  readonly creator: PressPagePayload["creator"];
  readonly content: DeliveredPressContent;
  readonly fullPressPdfUrl: string;
  readonly oneSheetUrl: string;
  readonly liveDates?: readonly PressLiveDate[];
}

export interface PressImageProps {
  readonly image: DeliveredPressImage | null | undefined;
  readonly slot: keyof PressImageSlot;
  readonly creditMode?: "caption" | "overlay";
  readonly loading?: "eager" | "lazy";
  readonly fetchPriority?: "high" | "auto" | "low";
  readonly className?: string;
}
