import type {
  PressContent,
  PressHighlight,
  PressImage,
  PressMember,
} from "@snc/shared";

export const PRESS_EDITOR_TABS = [
  { id: "appearance", label: "Appearance & media" },
  { id: "about", label: "About" },
  { id: "members", label: "Members" },
  { id: "highlights", label: "Highlights" },
  { id: "gallery", label: "Gallery" },
  { id: "links", label: "Links & contact" },
] as const;

export type PressEditorTab = (typeof PRESS_EDITOR_TABS)[number]["id"];
export type PdfScheme = "light" | "dark" | "accent";

export interface PressEditorIssue {
  readonly tab: PressEditorTab;
  readonly fieldId: string;
  readonly message: string;
}

const optionalText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

const cleanImage = (image: PressImage | null | undefined): PressImage | null =>
  image
    ? {
        ...image,
        alt: image.alt.trim(),
        credit: image.credit?.trim() || null,
      }
    : null;

/** Fill optional arrays/values so the editor always has one cohesive draft object. */
export function normalizeEditorContent(input: PressContent): PressContent {
  return {
    ...input,
    enabled: input.enabled ?? false,
    template: input.template ?? "A",
    tagline: input.tagline ?? null,
    shortBio: input.shortBio ?? null,
    longBio: input.longBio ?? null,
    forFansOf: input.forFansOf ?? [],
    banner: input.banner ?? null,
    aboutPhoto: input.aboutPhoto ?? null,
    members: input.members ?? [],
    streamingLinks: input.streamingLinks ?? [],
    liveDatesUrl: input.liveDatesUrl ?? null,
    standoutTrack: input.standoutTrack ?? null,
    highlights: input.highlights ?? [],
    pressContactEmail: input.pressContactEmail ?? null,
    location: input.location ?? null,
    photos: input.photos ?? [],
    gallery: input.gallery ?? [],
    releases: input.releases ?? [],
  };
}

/** Normalize draft strings and image metadata at the PATCH boundary. */
export function cleanEditorContent(input: PressContent): PressContent {
  const gallery = input.gallery.map((image) => cleanImage(image)!);
  return {
    ...input,
    tagline: optionalText(input.tagline),
    shortBio: optionalText(input.shortBio),
    longBio: optionalText(input.longBio),
    forFansOf: input.forFansOf.map((value) => value.trim()).filter(Boolean),
    banner: cleanImage(input.banner),
    aboutPhoto: cleanImage(input.aboutPhoto),
    members: input.members.map((member): PressMember => ({
      ...member,
      name: member.name.trim(),
      role: optionalText(member.role),
      bio: optionalText(member.bio),
      photo: cleanImage(member.photo),
    })),
    streamingLinks: input.streamingLinks.map((link) => ({
      ...link,
      label: link.label.trim(),
      url: link.url.trim(),
    })),
    liveDatesUrl: optionalText(input.liveDatesUrl),
    highlights: input.highlights.map((highlight): PressHighlight => ({
      ...highlight,
      eyebrow: highlight.eyebrow.trim(),
      title: highlight.title.trim(),
      description: optionalText(highlight.description),
      metric: optionalText(highlight.metric),
      url: optionalText(highlight.url),
      coverArt: cleanImage(highlight.coverArt),
    })),
    pressContactEmail: optionalText(input.pressContactEmail),
    location: optionalText(input.location),
    gallery,
    photos: gallery.map((image) => image.key),
  };
}

const isWebUrl = (value: string | null | undefined): boolean => {
  if (!value?.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const imageIssue = (
  issues: PressEditorIssue[],
  image: PressImage | null | undefined,
  tab: PressEditorTab,
  fieldId: string,
  label: string,
): void => {
  if (image && !image.alt.trim()) {
    issues.push({ tab, fieldId, message: `${label} needs alternative text` });
  }
};

/** Cross-tab publish validation. Drafts may still be saved while these issues exist. */
export function validatePressDraft(content: PressContent): PressEditorIssue[] {
  const issues: PressEditorIssue[] = [];

  imageIssue(issues, content.banner, "appearance", "press-banner-image-alt", "Banner image");
  imageIssue(issues, content.aboutPhoto, "about", "press-about-image-alt", "About photo");

  content.members.forEach((member, index) => {
    if (!member.name.trim()) {
      issues.push({
        tab: "members",
        fieldId: `press-member-${index}-name`,
        message: `Member ${index + 1} needs a name`,
      });
    }
    imageIssue(
      issues,
      member.photo,
      "members",
      `press-member-${index}-photo-alt`,
      `${member.name.trim() || `Member ${index + 1}`} photo`,
    );
  });

  content.highlights.forEach((highlight, index) => {
    if (!highlight.title.trim()) {
      issues.push({
        tab: "highlights",
        fieldId: `press-highlight-${index}-title`,
        message: `Highlight ${index + 1} needs a title`,
      });
    }
    if (!isWebUrl(highlight.url)) {
      issues.push({
        tab: "highlights",
        fieldId: `press-highlight-${index}-url`,
        message: `${highlight.title.trim() || `Highlight ${index + 1}`} needs a full URL`,
      });
    }
    imageIssue(
      issues,
      highlight.coverArt,
      "highlights",
      `press-highlight-${index}-cover-alt`,
      `${highlight.title.trim() || `Highlight ${index + 1}`} cover art`,
    );
  });

  content.gallery.forEach((image, index) => {
    imageIssue(
      issues,
      image,
      "gallery",
      `press-gallery-${index}-image-alt`,
      `Gallery image ${index + 1}`,
    );
  });

  content.streamingLinks.forEach((link, index) => {
    if (!link.label.trim()) {
      issues.push({
        tab: "links",
        fieldId: `press-link-${index}-label`,
        message: `Listening link ${index + 1} needs a label`,
      });
    }
    if (!isWebUrl(link.url) || !link.url.trim()) {
      issues.push({
        tab: "links",
        fieldId: `press-link-${index}-url`,
        message: `${link.label.trim() || `Listening link ${index + 1}`} needs a full URL`,
      });
    }
  });

  if (!isWebUrl(content.liveDatesUrl)) {
    issues.push({
      tab: "links",
      fieldId: "press-live-dates",
      message: "Live dates needs a full URL",
    });
  }

  const email = content.pressContactEmail?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({
      tab: "links",
      fieldId: "press-contact-email",
      message: "Press contact needs a valid email address",
    });
  }

  return issues;
}

export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
