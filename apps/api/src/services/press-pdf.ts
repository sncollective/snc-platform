import { createElement, type ReactElement, type ReactNode } from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { isOwnedPressKey } from "@snc/shared";
import type { PressContent, ReleaseOneSheet } from "@snc/shared";

import { rootLogger } from "../logging/logger.js";
import { storage } from "../storage/index.js";

// ── Private Constants ──

const PRESS_EMAIL = "press@s-nc.org";
const BRAND_NAVY = "#111827";
const BRAND_CORAL = "#e85d4a";
const MUTED = "#5b6473";
const RULE = "#d8dde5";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: BRAND_NAVY,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.45,
    paddingBottom: 40,
    paddingHorizontal: 42,
    paddingTop: 38,
  },
  brand: {
    color: BRAND_CORAL,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 2.2,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
    lineHeight: 1.05,
  },
  subtitle: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
  },
  rule: {
    backgroundColor: BRAND_CORAL,
    height: 3,
    marginBottom: 18,
    marginTop: 16,
    width: 54,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: BRAND_CORAL,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.4,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  body: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  columns: {
    flexDirection: "row",
  },
  column: {
    flexGrow: 1,
    flexBasis: 0,
  },
  columnLeft: {
    marginRight: 24,
  },
  metadataRow: {
    borderBottomColor: RULE,
    borderBottomWidth: 0.6,
    flexDirection: "row",
    paddingBottom: 4,
    paddingTop: 4,
  },
  metadataLabel: {
    color: MUTED,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    width: 82,
  },
  metadataValue: {
    flexGrow: 1,
    fontSize: 9,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: BRAND_CORAL,
    borderRadius: 3,
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  hero: {
    height: 190,
    marginBottom: 18,
    objectFit: "cover",
    width: "100%",
  },
  standout: {
    backgroundColor: "#f3f4f6",
    borderLeftColor: BRAND_CORAL,
    borderLeftWidth: 4,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  standoutTitle: {
    fontSize: 14,
    fontWeight: 700,
  },
  link: {
    borderBottomColor: RULE,
    borderBottomWidth: 0.6,
    fontSize: 8.5,
    paddingBottom: 3,
    paddingTop: 3,
  },
  footer: {
    bottom: 18,
    color: MUTED,
    fontSize: 7.5,
    left: 42,
    position: "absolute",
    right: 42,
    textAlign: "center",
  },
});

// ── Private Helpers ──

const section = (title: string, children: ReactNode): ReactElement =>
  createElement(
    View,
    { style: styles.section },
    createElement(Text, { style: styles.sectionTitle }, title),
    children,
  );

const metadataRow = (label: string, value: string | null | undefined): ReactElement | null =>
  value
    ? createElement(
        View,
        { key: label, style: styles.metadataRow },
        createElement(Text, { style: styles.metadataLabel }, label),
        createElement(Text, { style: styles.metadataValue }, value),
      )
    : null;

const readPressImageBuffer = async (
  key: string,
  creatorId: string,
): Promise<Buffer | null> => {
  if (!isOwnedPressKey(key, creatorId)) return null;

  try {
    const result = await storage.download(key);
    if (!result.ok) throw result.error;

    const reader = result.value.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  } catch (error) {
    rootLogger.warn(
      { error: error instanceof Error ? error.message : String(error), key },
      "Press PDF image could not be loaded; rendering without it",
    );
    return null;
  }
};

const oneSheetDocument = (release: ReleaseOneSheet) => {
  const releaseDetails = [
    metadataRow("Catalog #", release.catalogNumber),
    metadataRow("Release date", release.releaseDate),
    metadataRow("Format", release.format),
    metadataRow("Genre", release.genre),
    metadataRow("ISRC", release.isrc),
    metadataRow("UPC", release.upc),
    metadataRow("Duration", release.duration),
  ].filter((row): row is ReactElement => row !== null);

  const creditDetails = [
    metadataRow("Written by", release.writtenBy),
    metadataRow("Produced by", release.producedBy),
    metadataRow("Mixed / mastered", release.mixedMasteredBy),
  ].filter((row): row is ReactElement => row !== null);

  const rights = [release.label, release.publisherLine, release.copyrightLine].filter(
    (value): value is string => Boolean(value),
  );

  return createElement(
    Document,
    { author: "Signal to Noise Collective", subject: "Release one-sheet", title: release.title },
    createElement(
      Page,
      { size: "A4", style: styles.page, wrap: false },
      createElement(Text, { style: styles.brand }, "S/NC Records · Release One-Sheet"),
      createElement(Text, { style: styles.title }, release.title),
      createElement(Text, { style: styles.subtitle }, release.label ?? "Signal to Noise Collective"),
      createElement(View, { style: styles.rule }),
      createElement(
        View,
        { style: styles.columns },
        createElement(
          View,
          { style: [styles.column, styles.columnLeft] },
          section("Release details", createElement(View, null, ...releaseDetails)),
          release.fcc
            ? createElement(Text, { style: styles.badge }, `FCC ${release.fcc}`)
            : null,
        ),
        createElement(
          View,
          { style: styles.column },
          release.personnel.length > 0
            ? section(
                "Personnel",
                createElement(
                  View,
                  null,
                  ...release.personnel.map((person) =>
                    createElement(Text, { key: person, style: styles.body }, person),
                  ),
                ),
              )
            : null,
          creditDetails.length > 0
            ? section("Credits", createElement(View, null, ...creditDetails))
            : null,
          rights.length > 0
            ? section(
                "Label & rights",
                createElement(
                  View,
                  null,
                  ...rights.map((line) =>
                    createElement(Text, { key: line, style: styles.body }, line),
                  ),
                ),
              )
            : null,
        ),
      ),
      createElement(Text, { fixed: true, style: styles.footer }, `Press contact · ${PRESS_EMAIL}`),
    ),
  );
};

const onePagerDocument = (
  input: {
    creator: { displayName: string; handle: string | null };
    content: PressContent;
  },
  hero: Buffer | null,
) => {
  const { creator, content } = input;
  const contact = content.pressContactEmail ?? PRESS_EMAIL;

  return createElement(
    Document,
    {
      author: "Signal to Noise Collective",
      subject: "Creator press one-pager",
      title: `${creator.displayName} Press One-Pager`,
    },
    createElement(
      Page,
      { size: "A4", style: styles.page, wrap: false },
      createElement(Text, { style: styles.brand }, "Signal to Noise Collective · Press"),
      hero ? createElement(Image, { src: hero, style: styles.hero }) : null,
      createElement(Text, { style: styles.title }, creator.displayName),
      createElement(
        Text,
        { style: styles.subtitle },
        [content.location, creator.handle ? `@${creator.handle}` : null]
          .filter(Boolean)
          .join(" · "),
      ),
      createElement(View, { style: styles.rule }),
      content.shortBio
        ? section("About", createElement(Text, { style: styles.body }, content.shortBio))
        : null,
      content.forFansOf.length > 0
        ? section(
            "For fans of",
            createElement(Text, { style: styles.body }, content.forFansOf.join(" · ")),
          )
        : null,
      content.standoutTrack
        ? createElement(
            View,
            { style: styles.standout },
            createElement(Text, { style: styles.sectionTitle }, "Standout track"),
            createElement(Text, { style: styles.standoutTitle }, content.standoutTrack.title),
            content.standoutTrack.streamsLabel
              ? createElement(Text, { style: styles.body }, content.standoutTrack.streamsLabel)
              : null,
            content.standoutTrack.url
              ? createElement(Text, { style: styles.link }, content.standoutTrack.url)
              : null,
          )
        : null,
      content.streamingLinks.length > 0
        ? section(
            "Listen",
            createElement(
              View,
              null,
              ...content.streamingLinks.map((link) =>
                createElement(Text, { key: link.url, style: styles.link }, `${link.label} · ${link.url}`),
              ),
            ),
          )
        : null,
      section(
        "Contact",
        createElement(
          View,
          null,
          createElement(Text, { style: styles.body }, contact),
          content.location
            ? createElement(Text, { style: styles.body }, content.location)
            : null,
        ),
      ),
      createElement(Text, { fixed: true, style: styles.footer }, `Press contact · ${contact}`),
    ),
  );
};

// ── Public API ──

/** Render a release-specific, single-page press one-sheet. */
export const renderOneSheetPdf = async (release: ReleaseOneSheet): Promise<Buffer> =>
  renderToBuffer(oneSheetDocument(release));

/** Render a creator's single-page press one-pager, embedding its first readable photo. */
export const renderOnePagerPdf = async (input: {
  creator: { id: string; displayName: string; handle: string | null };
  content: PressContent;
}): Promise<Buffer> => {
  const photoKey = input.content.photos[0];
  const hero = photoKey
    ? await readPressImageBuffer(photoKey, input.creator.id)
    : null;
  return renderToBuffer(onePagerDocument(input, hero));
};
