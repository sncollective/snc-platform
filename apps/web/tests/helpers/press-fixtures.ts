import type {
  DeliveredPressContent,
  DeliveredPressImage,
  PressTemplateProps,
} from "../../src/components/press/press-types.js";

export const makeDeliveredPressImage = (
  key: string,
  overrides: Partial<DeliveredPressImage> = {},
): DeliveredPressImage => ({
  key,
  alt: `${key} alt`,
  credit: `${key} credit`,
  src: `https://images.example/${key}`,
  srcSet: `https://images.example/${key} 960w`,
  sizes: "100vw",
  ...overrides,
});

export const makeDeliveredPressContent = (
  overrides: Partial<DeliveredPressContent> = {},
): DeliveredPressContent => ({
  enabled: true,
  template: "A",
  tagline: "Socially conscious punk / alt-rock",
  shortBio: "Animal Future makes socially conscious rock that hits where it hurts.",
  longBio: "First biography paragraph.\n\nSecond biography paragraph.",
  forFansOf: ["IDLES", "Radiohead"],
  banner: makeDeliveredPressImage("banner"),
  aboutPhoto: makeDeliveredPressImage("about"),
  members: [
    { name: "LeAnna Warren", role: "Vocals, electric guitar", bio: "LeAnna biography", photo: makeDeliveredPressImage("leanna") },
    { name: "Charles Tyrie", role: "Drums", bio: "Charles biography", photo: makeDeliveredPressImage("charles") },
  ],
  streamingLinks: [
    { label: "Spotify", url: "https://open.spotify.com/artist/animal", service: "spotify" },
    { label: "Bandcamp", url: "https://animalfuture.bandcamp.com" },
    { label: "Official site", url: "https://animalfuture.example" },
  ],
  liveDatesUrl: "https://www.bandsintown.com/a/animal-future",
  standoutTrack: null,
  highlights: [
    { eyebrow: "New release", title: "The Illusionist", description: "First single", coverArt: makeDeliveredPressImage("illusionist") },
    { eyebrow: "Standout track", title: "Get to You", metric: "~14.5k streams", description: "and climbing", coverArt: makeDeliveredPressImage("get-to-you") },
    { eyebrow: "Coming", title: "Survived By", description: "Debut LP", coverArt: makeDeliveredPressImage("survived-by") },
    { eyebrow: "More", title: "Fourth Highlight", description: "Extra web content", coverArt: null },
  ],
  pressContactEmail: "press@s-nc.org",
  location: "Fort Collins, CO",
  photos: [],
  gallery: [
    makeDeliveredPressImage("gallery-one"),
    makeDeliveredPressImage("gallery-two"),
    makeDeliveredPressImage("gallery-three"),
    makeDeliveredPressImage("gallery-four"),
  ],
  releases: [],
  ...overrides,
});

export const makePressTemplateProps = (
  contentOverrides: Partial<DeliveredPressContent> = {},
): PressTemplateProps => ({
  creator: {
    id: "creator-1",
    handle: "animalfuture",
    displayName: "Animal Future",
    location: "Fort Collins, CO",
  },
  content: makeDeliveredPressContent(contentOverrides),
  fullPressPdfUrl: "/api/creators/creator-1/press/one-pager.pdf",
  oneSheetUrl: "/api/creators/creator-1/press/one-sheet.pdf",
});
