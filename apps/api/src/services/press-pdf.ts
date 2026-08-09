import { createElement, type ReactElement } from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

import { isLibraryAssetKey, isOwnedPressKey } from "@snc/shared";
import type {
  CreatorBrandColor,
  PressContent,
  PressImage,
  ReleaseOneSheet,
  SocialLink,
} from "@snc/shared";

import { rootLogger } from "../logging/logger.js";
import { storage } from "../storage/index.js";
import { renderBrowserPdf } from "./browser-pdf.js";

export const PDF_THEMES = ["light", "dark", "brand"] as const;
export type PdfTheme = (typeof PDF_THEMES)[number];
export const ONE_SHEET_ORIENTATIONS = ["auto", "horizontal", "vertical"] as const;
export type OneSheetOrientation = (typeof ONE_SHEET_ORIENTATIONS)[number];

const PRESS_EMAIL = "press@s-nc.org";
const DEFAULT_ACCENT = "#f5a623";
const DEFAULT_SECONDARY = "#5bb5b5";

const releaseStyles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#111827",
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.45,
    padding: 42,
  },
  brand: { color: "#e85d4a", fontSize: 9, fontWeight: 700, letterSpacing: 2, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 18 },
  columns: { flexDirection: "row" },
  column: { flexBasis: 0, flexGrow: 1, marginRight: 18 },
  heading: { color: "#e85d4a", fontSize: 8, fontWeight: 700, marginBottom: 6, marginTop: 12 },
  row: { borderBottomColor: "#d8dde5", borderBottomWidth: 0.6, paddingBottom: 4, paddingTop: 4 },
  footer: { bottom: 18, color: "#5b6473", fontSize: 7.5, left: 42, position: "absolute", right: 42, textAlign: "center" },
});

const releaseRows = (values: readonly (string | null | undefined)[]): ReactElement[] =>
  values.filter((value): value is string => Boolean(value)).map((value) =>
    createElement(Text, { key: value, style: releaseStyles.row }, value),
  );

const releaseDocument = (release: ReleaseOneSheet) => createElement(
  Document,
  { author: "Signal to Noise Collective", subject: "Release one-sheet", title: release.title },
  createElement(
    Page,
    { size: "LETTER", style: releaseStyles.page, wrap: false },
    createElement(Text, { style: releaseStyles.brand }, "S/NC RECORDS · RELEASE ONE-SHEET"),
    createElement(Text, { style: releaseStyles.title }, release.title),
    createElement(
      View,
      { style: releaseStyles.columns },
      createElement(
        View,
        { style: releaseStyles.column },
        createElement(Text, { style: releaseStyles.heading }, "RELEASE DETAILS"),
        ...releaseRows([
          release.catalogNumber,
          release.releaseDate,
          release.format,
          release.genre,
          release.isrc,
          release.upc,
          release.duration,
        ]),
      ),
      createElement(
        View,
        { style: releaseStyles.column },
        createElement(Text, { style: releaseStyles.heading }, "PERSONNEL & CREDITS"),
        ...releaseRows([
          ...release.personnel,
          release.writtenBy,
          release.producedBy,
          release.mixedMasteredBy,
          release.label,
          release.publisherLine,
          release.copyrightLine,
        ]),
      ),
    ),
    createElement(Text, { fixed: true, style: releaseStyles.footer }, `Press contact · ${PRESS_EMAIL}`),
  ),
);

const escapeHtml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const truncateAtWord = (value: string, max: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max + 1);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).trimEnd()}…`;
};

const themeVariables = (theme: PdfTheme, brandColor: CreatorBrandColor | null): string => {
  const accent = theme === "brand" ? (brandColor ?? DEFAULT_ACCENT) : DEFAULT_ACCENT;
  if (theme === "light") {
    return `--color-bg:#f7f3eb;--color-bg-elevated:#eee7dc;--color-text:#1a1a2e;--color-text-muted:#5b6070;--color-border:#c9c2b6;--color-media-bg:#171725;--color-accent:${DEFAULT_ACCENT};--color-secondary:#287f82;`;
  }
  return `--color-bg:#1a1a2e;--color-bg-elevated:#252542;--color-text:#f0f0f0;--color-text-muted:#a0a0b0;--color-border:#3a3a5c;--color-media-bg:#000;--color-accent:${accent};--color-secondary:${DEFAULT_SECONDARY};`;
};

const fullPdfThemeStyle = (theme: PdfTheme, brandColor: CreatorBrandColor | null): string => `
  :root { ${themeVariables(theme, brandColor)} }
  html, body { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
  #press-band-name { color: #fff !important; }
`;

const readPressImageDataUrl = async (
  image: PressImage | null | undefined,
  creatorId: string,
): Promise<string | null> => {
  if (!image || (!isOwnedPressKey(image.key, creatorId) && !isLibraryAssetKey(image.key))) return null;
  try {
    const result = await storage.download(image.key);
    if (!result.ok) throw result.error;
    const reader = result.value.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const extension = image.key.split(".").pop()?.toLowerCase();
    const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("base64")}`;
  } catch (error) {
    rootLogger.warn(
      { error: error instanceof Error ? error.message : String(error), key: image.key },
      "Press PDF image could not be loaded; rendering without it",
    );
    return null;
  }
};

const photoFigure = (
  className: string,
  image: PressImage | null | undefined,
  src: string | null,
  fallbackLabel: string,
): string => {
  const media = src
    ? `<img src="${src}" alt="${escapeHtml(image?.alt ?? "")}">`
    : `<div class="media-fallback" aria-label="${escapeHtml(fallbackLabel)}"></div>`;
  const credit = image?.credit
    ? `<figcaption>${escapeHtml(image.credit)}</figcaption>`
    : "";
  return `<figure class="${className}">${media}${credit}</figure>`;
};

const humanUrl = (url: string): string => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

const defaultDestinationUrl = (
  creator: { handle: string | null; socialLinks: readonly SocialLink[] },
  content: PressContent,
  pressPageUrl: string,
): string => {
  const linktree = creator.socialLinks.find((link) => {
    try { return new URL(link.url).hostname.endsWith("linktr.ee"); } catch { return false; }
  });
  if (linktree) return linktree.url;
  if (creator.handle === "animalfuture") return "https://linktr.ee/animalfutureofficial";
  return creator.socialLinks.find((link) => link.platform === "website")?.url
    ?? content.streamingLinks.find((link) => link.service === "website")?.url
    ?? content.streamingLinks[0]?.url
    ?? pressPageUrl;
};

const oneSheetCss = (theme: PdfTheme, brandColor: CreatorBrandColor | null): string => `
*{box-sizing:border-box}html,body{width:8.5in;height:11in;margin:0;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:Inter,Arial,sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}figure,p,h1,h2,h3{margin:0}.sheet{${themeVariables(theme, brandColor)}--baseline:4px;--inset:48px;--gutter:12px;--s1:4px;--s2:8px;--s3:12px;--s4:16px;--s6:24px;--s8:32px;width:8.5in;height:11in;padding:var(--inset);display:flex;flex-direction:column;overflow:hidden;background:var(--color-bg);color:var(--color-text)}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gutter)}.mast{flex:none;padding-bottom:var(--s2);display:flex;align-items:baseline;justify-content:space-between;gap:var(--s4);border-bottom:1px solid var(--color-border);color:var(--color-text-muted);font-size:9px;line-height:12px;letter-spacing:.14em;text-transform:uppercase}.mast strong,.kicker{color:var(--color-accent);font-weight:700}.mast strong{font-size:10px;letter-spacing:.18em}.kicker{display:block;margin-bottom:var(--s1);font-size:9px;line-height:12px;letter-spacing:.18em;text-transform:uppercase}.media-fallback{width:100%;height:100%;background:linear-gradient(135deg,var(--color-bg-elevated),var(--color-media-bg))}figcaption{position:absolute;z-index:2;right:var(--s2);bottom:var(--s2);left:var(--s2);color:#fff;font-size:9px;line-height:12px;text-shadow:0 1px 2px #000}.hero{position:relative;flex:none;height:240px;margin-top:var(--s3);overflow:hidden;background:var(--color-media-bg)}.hero img{width:100%;height:100%;object-fit:cover;filter:saturate(.68) contrast(1.12) brightness(.82)}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#080812d6,#08081214 72%),linear-gradient(to top,#080812eb,transparent 64%)}.hero-copy{position:absolute;z-index:1;right:var(--s3);bottom:var(--s4);left:var(--s3);align-items:end}.hero-copy h1{grid-column:1/span 8;color:#fff;font:400 52px/56px Georgia,serif;letter-spacing:-.05em}.facts{grid-column:9/-1;align-self:end;color:#fff;text-align:right;font-size:10px;line-height:16px}.facts b{display:block;color:var(--color-secondary)}.story{flex:none;margin-top:var(--s6)}.deck{margin-bottom:var(--s2);font:700 18px/24px Georgia,serif}.bio{color:var(--color-text-muted);font-size:10px;line-height:16px}.bio p:first-child{grid-column:1/span 6}.bio p:last-child{grid-column:7/-1}.fans{margin-top:var(--s3);padding-top:var(--s2);border-top:1px solid var(--color-border);align-items:center}.fans .kicker{grid-column:1/span 2;margin:0}.fan-line{grid-column:3/-1;color:var(--color-text-muted);font-size:9px;line-height:12px}.page-section{flex:none;margin-top:var(--s6);padding-top:var(--s3);border-top:1px solid var(--color-border)}.section-label{margin-bottom:var(--s2)}.members{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gutter)}.member{display:grid;grid-template-columns:72px minmax(0,1fr);gap:var(--s2)}.member figure,.member img{position:relative;width:72px;height:72px;object-fit:cover}.member h3{font:400 13px/16px Georgia,serif}.role{margin-top:var(--s1);color:var(--color-secondary);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.member-bio{margin-top:var(--s1);color:var(--color-text-muted);font-size:10px;line-height:12px}.highlights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gutter)}.highlight{padding-top:var(--s2);border-top:2px solid var(--color-accent);display:grid;grid-template-columns:72px minmax(0,1fr);gap:var(--s2)}.highlight:nth-child(2){border-color:var(--color-secondary)}.highlight:nth-child(3){border-color:var(--color-text-muted)}.highlight figure,.highlight img{position:relative;width:72px;height:72px;object-fit:cover}.eyebrow{color:var(--color-text-muted);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.highlight h2{margin-top:var(--s1);font:400 13px/16px Georgia,serif}.highlight p{margin-top:var(--s1);color:var(--color-text-muted);font-size:9px;line-height:12px}.page-buffer{min-height:0;flex:1 1 auto}.actions{flex:none;padding-top:var(--s3);border-top:1px solid var(--color-border);align-items:end}.contact{grid-column:1/span 5}.contact span{display:block;color:var(--color-text-muted);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.contact strong{display:block;margin-top:var(--s1);font:400 15px/20px Georgia,serif}.listen-group{grid-column:6/-1;display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:var(--gutter);align-items:end}.listen{text-align:right}.url{color:var(--color-text);font-size:10px;font-weight:700;line-height:16px;overflow-wrap:anywhere}.destinations{margin-top:var(--s1);color:var(--color-text-muted);font-size:9px;line-height:12px}.qr{width:80px;height:80px;background:#fff}.qr svg{display:block;width:100%;height:100%}
.vertical.sheet{display:block}.spread{height:100%;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gutter)}.rail{position:relative;grid-column:1/span 4;height:100%;overflow:hidden;background:var(--color-media-bg)}.rail img{width:100%;height:100%;object-fit:cover;filter:saturate(.46) contrast(1.08) brightness(.48)}.rail:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,#080812e6,transparent 28%)}.copy{grid-column:5/-1;height:100%;display:flex;flex-direction:column}.title{padding:var(--s6) 0;text-align:center;border-bottom:1px solid var(--color-border)}.title h1{font:400 48px/52px Georgia,serif;letter-spacing:-.05em}.location{margin-top:var(--s3);color:var(--color-secondary);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.location span{display:block}.location span+span{margin-top:var(--s1)}.v-about,.v-fans,.v-content{padding:var(--s4) 0;border-bottom:1px solid var(--color-border)}.v-about{padding-bottom:var(--s6)}.v-about .deck{font-size:16px;line-height:20px}.v-bio{color:var(--color-text-muted);font-size:10px;line-height:16px}.v-members{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3) var(--gutter)}.v-member{padding-top:var(--s2);border-top:1px solid var(--color-border);display:grid;grid-template-columns:48px minmax(0,1fr);gap:var(--s2)}.v-member figure,.v-member img{position:relative;width:48px;height:48px;object-fit:cover}.v-member h3{font:400 13px/16px Georgia,serif}.v-highlights{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gutter)}.v-highlight{padding-top:var(--s3);border-top:2px solid var(--color-accent);display:grid;grid-template-columns:64px minmax(0,1fr);gap:var(--s2)}.v-highlight:nth-child(2){border-color:var(--color-secondary)}.v-highlight figure,.v-highlight img{position:relative;width:64px;height:64px;object-fit:cover}.v-highlight h2{margin-top:var(--s1);font:400 16px/20px Georgia,serif}.v-actions{padding-top:var(--s4);border-top:1px solid var(--color-border)}.v-listen{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:var(--gutter);align-items:center}.v-listen>div{grid-column:1/span 6}.v-listen .qr{grid-column:7/-1;justify-self:end}.v-contact{margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:end}.folio{color:var(--color-text-muted);font-size:9px;line-height:12px;text-transform:uppercase}@page{size:letter portrait;margin:0}
`;

const renderMember = async (member: PressContent["members"][number], creatorId: string, vertical: boolean): Promise<string> => {
  const src = await readPressImageDataUrl(member.photo, creatorId);
  const figure = photoFigure("", member.photo, src, `${member.name} portrait`);
  return vertical
    ? `<article class="v-member">${figure}<div><h3>${escapeHtml(member.name)}</h3>${member.role ? `<p class="role">${escapeHtml(member.role)}</p>` : ""}</div></article>`
    : `<article class="member">${figure}<div><h3>${escapeHtml(member.name)}</h3>${member.role ? `<p class="role">${escapeHtml(member.role)}</p>` : ""}${member.bio ? `<p class="member-bio">${escapeHtml(truncateAtWord(member.bio, 72))}</p>` : ""}</div></article>`;
};

const renderHighlight = async (highlight: PressContent["highlights"][number], creatorId: string, vertical: boolean): Promise<string> => {
  const src = await readPressImageDataUrl(highlight.coverArt, creatorId);
  const figure = photoFigure("", highlight.coverArt, src, `${highlight.title} artwork`);
  const copy = `<div>${highlight.eyebrow ? `<span class="eyebrow">${escapeHtml(highlight.eyebrow)}</span>` : ""}<h2>${escapeHtml(highlight.title)}</h2>${highlight.metric ? `<p>${escapeHtml(highlight.metric)}</p>` : highlight.description ? `<p>${escapeHtml(truncateAtWord(highlight.description, 68))}</p>` : ""}</div>`;
  return `<article class="${vertical ? "v-highlight" : "highlight"}">${figure}${copy}</article>`;
};

const oneSheetHtml = async (input: {
  creator: { id: string; displayName: string; handle: string | null; socialLinks: readonly SocialLink[] };
  content: PressContent;
  theme: PdfTheme;
  brandColor: CreatorBrandColor | null;
  destinationUrl: string;
  orientation: Exclude<OneSheetOrientation, "auto">;
}): Promise<string> => {
  const { creator, content, theme, brandColor, destinationUrl, orientation } = input;
  const vertical = orientation === "vertical";
  const lead = vertical ? (content.aboutPhoto ?? content.banner ?? content.gallery[0]) : (content.banner ?? content.gallery[0] ?? content.aboutPhoto);
  const leadSrc = await readPressImageDataUrl(lead, creator.id);
  const qr = await QRCode.toString(destinationUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  const members = await Promise.all(content.members.slice(0, 4).map((member) => renderMember(member, creator.id, vertical)));
  const highlights = await Promise.all(content.highlights.slice(0, vertical ? 2 : 3).map((highlight) => renderHighlight(highlight, creator.id, vertical)));
  const bioSource = content.longBio || content.shortBio || "";
  const paragraphs = bioSource.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  const shortBio = truncateAtWord(content.shortBio || paragraphs[0] || "", vertical ? 440 : 300);
  const horizontalBio = [paragraphs[0] ?? content.shortBio ?? "", paragraphs[1] ?? ""]
    .map((value) => truncateAtWord(value, 440));
  const fans = content.forFansOf.slice(0, 7).join(" · ");
  const destinations = content.streamingLinks.slice(0, 5).map((link) => link.label).join(" · ");
  const contact = content.pressContactEmail ?? PRESS_EMAIL;
  const leadFigure = photoFigure(vertical ? "rail" : "hero", lead, leadSrc, `${creator.displayName} lead photo`);

  const horizontalBody = `
<header class="mast"><strong>S/NC · Press</strong><span>${escapeHtml(creator.displayName)} · ${new Date().getUTCFullYear()}</span><span>One-sheet 01/01</span></header>
<div class="hero">${leadFigure.replace(/^<figure class="hero">|<\/figure>$/g, "")}<div class="hero-copy grid"><h1>${escapeHtml(creator.displayName)}</h1><p class="facts">${content.location ? `<b>${escapeHtml(content.location)}</b>` : ""}${content.tagline ? escapeHtml(content.tagline) : ""}</p></div></div>
<section class="story"><span class="kicker">About</span>${content.shortBio ? `<p class="deck">${escapeHtml(content.shortBio)}</p>` : ""}<div class="bio grid"><p>${escapeHtml(horizontalBio[0] ?? "")}</p><p>${escapeHtml(horizontalBio[1] ?? "")}</p></div>${fans ? `<div class="fans grid"><span class="kicker">For fans of</span><p class="fan-line">${escapeHtml(fans)}</p></div>` : ""}</section>
${members.length ? `<section class="page-section"><span class="kicker section-label">Members</span><div class="members">${members.join("")}</div></section>` : ""}
${highlights.length ? `<section class="page-section"><span class="kicker section-label">Highlights</span><div class="highlights">${highlights.join("")}</div></section>` : ""}
<div class="page-buffer"></div><footer class="actions grid"><div class="contact"><span>Press contact</span><strong>${escapeHtml(contact)}</strong></div><div class="listen-group"><div class="listen"><span class="kicker">Listen · scan or type</span><p class="url">${escapeHtml(humanUrl(destinationUrl))}</p>${destinations ? `<p class="destinations">${escapeHtml(destinations)}</p>` : ""}</div><div class="qr">${qr}</div></div></footer>`;

  const verticalBody = `
<div class="spread">${leadFigure}<div class="copy"><header class="mast"><strong>S/NC · Press</strong><span>Artist one-sheet · ${new Date().getUTCFullYear()}</span></header><section class="title"><h1>${escapeHtml(creator.displayName)}</h1><p class="location">${content.location ? `<span>${escapeHtml(content.location)}</span>` : ""}${content.tagline ? `<span>${escapeHtml(content.tagline)}</span>` : ""}</p></section><section class="v-about"><span class="kicker">About</span>${content.shortBio ? `<p class="deck">${escapeHtml(content.shortBio)}</p>` : ""}<p class="v-bio">${escapeHtml(shortBio)}</p></section>${fans ? `<section class="v-fans"><span class="kicker">For fans of</span><p class="fan-line">${escapeHtml(fans)}</p></section>` : ""}${members.length ? `<section class="v-content"><span class="kicker section-label">Members</span><div class="v-members">${members.join("")}</div></section>` : ""}${highlights.length ? `<section class="v-content"><span class="kicker section-label">Highlights</span><div class="v-highlights">${highlights.join("")}</div></section>` : ""}<div class="page-buffer"></div><footer class="v-actions"><div class="v-listen"><div><span class="kicker">Listen · scan or type</span><p class="url">${escapeHtml(humanUrl(destinationUrl))}</p>${destinations ? `<p class="destinations">${escapeHtml(destinations)}</p>` : ""}</div><div class="qr">${qr}</div></div><div class="v-contact"><div class="contact"><span>Press contact</span><strong>${escapeHtml(contact)}</strong></div><span class="folio">S/NC · 01/01</span></div></footer></div></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(creator.displayName)} press one-sheet</title><style>${oneSheetCss(theme, brandColor)}</style></head><body><article class="sheet ${vertical ? "vertical" : "horizontal"}">${vertical ? verticalBody : horizontalBody}</article></body></html>`;
};

/** Render the legacy release-specific one-sheet, retained for its existing route contract. */
export const renderOneSheetPdf = async (release: ReleaseOneSheet): Promise<Buffer> =>
  renderToBuffer(releaseDocument(release));

/** Print the selected live web template, preserving its complete multi-page press content. */
export const renderOnePagerPdf = async (input: {
  pageUrl: string;
  theme: PdfTheme;
  brandColor: CreatorBrandColor | null;
}): Promise<Buffer> => renderBrowserPdf({
  url: input.pageUrl,
  style: fullPdfThemeStyle(input.theme, input.brandColor),
});

/** Render a curated single-page creator press sheet from the locked orientation-specific layouts. */
export const renderCreatorOneSheetPdf = async (input: {
  creator: { id: string; displayName: string; handle: string | null; socialLinks: readonly SocialLink[] };
  content: PressContent;
  pressPageUrl: string;
  theme: PdfTheme;
  brandColor: CreatorBrandColor | null;
  destinationUrl?: string;
  orientation: OneSheetOrientation;
}): Promise<Buffer> => {
  const destinationUrl = input.destinationUrl
    ?? defaultDestinationUrl(input.creator, input.content, input.pressPageUrl);
  const orientation = input.orientation === "auto"
    ? (input.content.banner ? "horizontal" : input.content.aboutPhoto ? "vertical" : "horizontal")
    : input.orientation;
  const html = await oneSheetHtml({ ...input, destinationUrl, orientation });
  return renderBrowserPdf({ html, singlePage: true });
};
