import { eq } from "drizzle-orm";
import QRCode from "qrcode";

import {
  isLibraryAssetKey,
  isOwnedPressKey,
  MAX_FILE_SIZES,
  ValidationError,
} from "@snc/shared";
import type {
  CreatorBrandColor,
  PressContent,
  PressImage,
  ReleaseOneSheet,
  SocialLink,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { contentBlobs } from "../db/schema/library.schema.js";
import { detectImage } from "../lib/image-detect.js";
import { buildPressImageUrl } from "../lib/imgproxy.js";
import { rootLogger } from "../logging/logger.js";
import { storage } from "../storage/index.js";
import { BrowserPdfSinglePageFitError, renderBrowserPdf } from "./browser-pdf.js";

export const EXPORT_VOICES = ["parent", "studio", "tv", "records"] as const;
export type ExportVoice = (typeof EXPORT_VOICES)[number];
export const ONE_SHEET_ORIENTATIONS = ["auto", "horizontal", "vertical"] as const;
export type OneSheetOrientation = (typeof ONE_SHEET_ORIENTATIONS)[number];

export const PDF_EXPORT_THEMES = ["light", "dark"] as const;
export type PdfExportTheme = (typeof PDF_EXPORT_THEMES)[number];

export interface PdfExportIdentity {
  readonly producingUnit: string | null;
  readonly federationHandle: string | null;
  readonly creatorBrandColor: CreatorBrandColor | null;
  /** Export color sheet; light is the historical default (light-paper press export). */
  readonly theme?: PdfExportTheme;
}

export interface ResolvedPdfExportIdentity {
  readonly voice: ExportVoice;
  readonly creatorDecoration: CreatorBrandColor | null;
}

const PRESS_EMAIL = "press@s-nc.org";
const MAX_QR_SIZE_PX = 128;

// QR modules and their quiet-zone paper are payload-critical output colors, not themeable UI.
// Keep this pair fixed and mirrored by the export-CSS boundary test's exact named allowlist.
const QR_DARK = "#1A1A2E";
const QR_LIGHT = "#FFFFFF";

/** Resolve a caller-supplied producing unit and eligible creator decoration for export. */
export const resolvePdfExportIdentity = (
  identity: PdfExportIdentity,
): ResolvedPdfExportIdentity => {
  const producingUnit = identity.producingUnit?.trim().toLowerCase();
  const voice = EXPORT_VOICES.find((candidate) => candidate === producingUnit) ?? "records";
  return {
    voice,
    creatorDecoration: identity.federationHandle?.trim() && identity.creatorBrandColor
      ? identity.creatorBrandColor
      : null,
  };
};

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

const exportVoiceScope = (identity: PdfExportIdentity): string => {
  const resolved = resolvePdfExportIdentity(identity);
  const theme = identity.theme ?? "light";
  return EXPORT_VOICES.map((voice) => `
:root[data-theme="${theme}"][data-export-voice="${voice}"]
:is([data-press-template], [data-pdf-sheet]) {
  --color-accent: var(--voice-${voice}-accent);
  --color-accent-hover: var(--voice-${voice}-accent-hover);
  --color-accent-bg: var(--voice-${voice}-accent-bg);
  --color-accent-subtle: var(--voice-${voice}-accent-subtle);
  --color-on-accent: var(--voice-${voice}-on-accent);
  --color-accent2: var(--voice-${voice}-accent2);
  --color-link: var(--voice-${voice}-accent);
  --color-link-hover: var(--voice-${voice}-accent-hover);
  --radius: var(--voice-${voice}-radius);
  --radius-sm: var(--voice-${voice}-radius-sm);
  --radius-md: var(--voice-${voice}-radius-md);
  --radius-lg: var(--voice-${voice}-radius-lg);
  --radius-xl: var(--voice-${voice}-radius-xl);
  --font-body: var(--font-body-${voice});
  --font-display: var(--font-display-${voice});
  --export-accent-decoration: ${resolved.creatorDecoration ?? `var(--voice-${voice}-accent)`};
  font-family: var(--font-body);
}`).join("\n");
};

/** Build the retained-head export scope used by browser rendering and cascade verification. */
export const buildPdfExportStyle = (identity: PdfExportIdentity): string => `
${exportVoiceScope(identity)}
html, body {
  font-family: var(--font-body) !important;
  print-color-adjust: exact !important;
  -webkit-print-color-adjust: exact !important;
}
h1, h2, h3, h4, h5, h6 { font-family: var(--font-display) !important; }
#press-band-name, [class*="heroFacts"] span:last-child { color: var(--color-on-media) !important; }
`;

type PrintImageSpec = {
  readonly slot: "banner" | "about" | "member" | "gallery" | "cover";
  readonly width: number;
  readonly height: number;
};

type ImageDimensions = {
  width: number;
  height: number;
};

const readImageBuffer = async (key: string): Promise<Buffer> => {
  const result = await storage.download(key);
  if (!result.ok) throw result.error;
  if (result.value.size > MAX_FILE_SIZES.image) {
    await result.value.stream.cancel();
    throw new ValidationError("Image exceeds the configured size limit");
  }

  const reader = result.value.stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_SIZES.image) {
        await reader.cancel();
        throw new ValidationError("Image exceeds the configured size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
};

const loadPrintImageDimensions = async (key: string): Promise<ImageDimensions> => {
  if (isLibraryAssetKey(key)) {
    const [stored] = await db
      .select({ width: contentBlobs.width, height: contentBlobs.height })
      .from(contentBlobs)
      .where(eq(contentBlobs.storageKey, key))
      .limit(1);
    if (
      !stored
      || stored.width === null
      || stored.height === null
      || stored.width <= 0
      || stored.height <= 0
    ) {
      throw new ValidationError("Image dimensions are unavailable");
    }
    return { width: stored.width, height: stored.height };
  }

  const detected = detectImage(await readImageBuffer(key));
  if (!detected?.width || !detected.height) {
    throw new ValidationError("Image dimensions are unavailable");
  }
  return { width: detected.width, height: detected.height };
};

const retainedCropDimensions = (
  sourceWidth: number,
  sourceHeight: number,
  image: PressImage,
  target: PrintImageSpec,
): { width: number; height: number } => {
  let width = sourceWidth * (image.crop?.width ?? 1);
  let height = sourceHeight * (image.crop?.height ?? 1);
  const sourceRatio = width / height;
  const targetRatio = target.width / target.height;
  if (sourceRatio > targetRatio) width = height * targetRatio;
  else height = width / targetRatio;
  return { width, height };
};

const resolvePrintImageUrl = async (
  image: PressImage | null | undefined,
  creatorId: string,
  target: PrintImageSpec,
): Promise<string | null> => {
  if (!image || (!isOwnedPressKey(image.key, creatorId) && !isLibraryAssetKey(image.key))) return null;
  try {
    const dimensions = await loadPrintImageDimensions(image.key);
    const retained = retainedCropDimensions(dimensions.width, dimensions.height, image, target);
    if (retained.width < target.width || retained.height < target.height) {
      rootLogger.warn({
        key: image.key,
        source: `${dimensions.width}x${dimensions.height}`,
        postCrop: `${Math.floor(retained.width)}x${Math.floor(retained.height)}`,
        required: `${target.width}x${target.height}`,
      }, "Press PDF image is below 300ppi after crop at its printed size");
    }
    return buildPressImageUrl(image, target.slot, target.width, target.height).src;
  } catch (error) {
    rootLogger.warn(
      { error: error instanceof Error ? error.message : String(error), key: image.key },
      "Press PDF image could not be validated; rendering without it",
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
    ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(image?.alt ?? "")}">`
    : `<div class="media-fallback" aria-label="${escapeHtml(fallbackLabel)}"></div>`;
  const credit = image?.credit
    ? `<figcaption>${escapeHtml(image.credit)}</figcaption>`
    : "";
  return `<figure class="${className}">${media}${credit}</figure>`;
};

const humanUrl = (url: string): string => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const defaultDestinationUrl = (
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

const oneSheetCss = (qrSizePx: number): string => `
*{box-sizing:border-box}html,body{width:8.5in;height:11in;margin:0;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body);print-color-adjust:exact;-webkit-print-color-adjust:exact}figure,p,h1,h2,h3{margin:0}.sheet{--baseline:4px;--inset:48px;--gutter:12px;--s1:4px;--s2:8px;--s3:12px;--s4:16px;--s6:24px;--s8:32px;width:8.5in;height:11in;padding:var(--inset);display:flex;flex-direction:column;overflow:hidden;background:var(--color-bg);color:var(--color-text)}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gutter)}.mast{flex:none;padding-bottom:var(--s2);display:flex;align-items:baseline;justify-content:space-between;gap:var(--s4);border-bottom:2px solid var(--export-accent-decoration);color:var(--color-text-muted);font-size:9px;line-height:12px;letter-spacing:.14em;text-transform:uppercase}.mast strong,.kicker{color:var(--color-accent);font-weight:700}.mast strong{font-size:10px;letter-spacing:.18em}.kicker{display:block;margin-bottom:var(--s1);font-size:9px;line-height:12px;letter-spacing:.18em;text-transform:uppercase}.media-fallback{width:100%;height:100%;background:linear-gradient(135deg,var(--color-bg-elevated),var(--color-media-bg))}figcaption{position:absolute;z-index:2;right:var(--s2);bottom:var(--s2);color:var(--color-on-media);font-size:9px;line-height:12px;background:var(--color-overlay-strong);padding:3px 8px}.hero{position:relative;flex:none;height:240px;margin-top:var(--s3);overflow:hidden;background:var(--color-media-bg)}.hero img{width:100%;height:100%;object-fit:cover;filter:saturate(.68) contrast(1.12) brightness(.82)}.hero-copy{position:absolute;z-index:1;right:var(--s3);bottom:var(--s4);left:var(--s3);align-items:end}.hero-copy{background:var(--color-overlay-strong);padding:10px 14px}.hero-copy h1{grid-column:1/span 8;color:var(--color-on-media);font:400 52px/56px var(--font-display);letter-spacing:-.05em;text-shadow:none}.facts{grid-column:9/-1;align-self:end;color:var(--color-on-media);text-align:right;font-size:10px;line-height:16px}.facts b{display:block;color:var(--color-accent)}.story{flex:none;margin-top:var(--s6)}.deck{margin-bottom:var(--s2);font:700 18px/24px var(--font-display)}.bio{color:var(--color-text-muted);font-size:10px;line-height:16px}.bio p:first-child{grid-column:1/span 6}.bio p:last-child{grid-column:7/-1}.fans{margin-top:var(--s3);padding-top:var(--s2);border-top:1px solid var(--color-border);align-items:center}.fans .kicker{grid-column:1/span 2;margin:0}.fan-line{grid-column:3/-1;color:var(--color-text-muted);font-size:9px;line-height:12px}.page-section{flex:none;margin-top:var(--s6);padding-top:var(--s3);border-top:1px solid var(--color-border)}.section-label{margin-bottom:var(--s2)}.members{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gutter)}.member{display:grid;grid-template-columns:72px minmax(0,1fr);gap:var(--s2)}.member figure,.member img{position:relative;width:72px;height:72px;object-fit:cover}.member h3{font:400 13px/16px var(--font-display)}.role{margin-top:var(--s1);color:var(--color-accent);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.member-bio{margin-top:var(--s1);color:var(--color-text-muted);font-size:10px;line-height:12px}.highlights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gutter)}.highlight{padding-top:var(--s2);border-top:2px solid var(--export-accent-decoration);display:grid;grid-template-columns:72px minmax(0,1fr);gap:var(--s2)}.highlight:nth-child(2){border-color:var(--export-accent-decoration)}.highlight:nth-child(3){border-color:var(--color-text-muted)}.highlight figure,.highlight img{position:relative;width:72px;height:72px;object-fit:cover}.eyebrow{color:var(--color-text-muted);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.highlight h2{margin-top:var(--s1);font:400 13px/16px var(--font-display)}.highlight p,.v-highlight p{margin-top:2px;color:var(--color-text-muted);font-size:9px;line-height:12px}.highlight .metric,.v-highlight .metric{color:var(--color-accent);font-weight:700}.live-link{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gutter);align-items:baseline}.live-link .kicker{grid-column:1/span 2;margin:0}.live-link a{grid-column:3/-1;color:var(--color-text);font-size:10px;font-weight:700;line-height:16px;overflow-wrap:anywhere}.page-buffer{min-height:0;flex:1 1 auto}.actions{flex:none;padding-top:var(--s3);border-top:1px solid var(--color-border);align-items:end}.contact{grid-column:1/span 5}.contact span{display:block;color:var(--color-text-muted);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.contact strong{display:block;margin-top:var(--s1);font:400 15px/20px var(--font-display)}.contact span+span{margin-top:var(--s2)}.listen-group{grid-column:6/-1;display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:var(--gutter);align-items:end}.listen{text-align:right}.url{display:block;color:var(--color-text);font-size:10px;font-weight:700;line-height:16px;overflow-wrap:anywhere;text-decoration:none}.destinations{margin-top:var(--s1);color:var(--color-text-muted);font-size:9px;line-height:12px}.destinations .destination{color:inherit;text-decoration:none}.qr{width:${qrSizePx}px;height:${qrSizePx}px;background:${QR_LIGHT}}.qr svg{display:block;width:100%;height:100%}
.vertical.sheet{display:block}.spread{height:100%;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gutter)}.rail{position:relative;grid-column:1/span 4;height:100%;overflow:hidden;background:var(--color-media-bg)}.rail img{width:100%;height:100%;object-fit:cover;filter:saturate(.60) contrast(1.08) brightness(.60)}.copy{grid-column:5/-1;height:100%;display:flex;flex-direction:column;justify-content:space-between}.title{padding:var(--s6) 0;text-align:center;border-bottom:1px solid var(--color-border)}.title h1{font:400 48px/52px var(--font-display);letter-spacing:-.05em}.location{margin-top:var(--s3);color:var(--color-accent);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase}.location span{display:block}.location span+span{margin-top:var(--s1)}.v-about,.v-fans,.v-content{padding:var(--s4) 0;border-bottom:1px solid var(--color-border)}.v-about{padding-bottom:var(--s6)}.v-about .deck{font-size:16px;line-height:20px}.v-bio{color:var(--color-text-muted);font-size:11px;line-height:15px;letter-spacing:.015em}[data-theme="dark"] .v-bio{color:var(--color-text);opacity:.75}.v-members{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3) var(--gutter)}.v-member{padding-top:var(--s2);border-top:1px solid var(--color-border);display:grid;grid-template-columns:48px minmax(0,1fr);gap:var(--s2);align-items:start}.v-member figure{position:relative;width:48px;min-height:48px;height:auto;align-self:stretch}.v-member img{position:relative;width:100%;height:100%;object-fit:cover}.v-member h3{font:400 13px/16px var(--font-display)}.v-member-bio{margin-top:var(--s1);color:var(--color-text-muted);font-size:10px;line-height:12px}.v-highlights{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gutter)}.vertical .kicker{margin-bottom:var(--s2)}.v-highlight{padding-top:var(--s3);border-top:2px solid var(--export-accent-decoration);display:grid;grid-template-columns:80px minmax(0,1fr);gap:var(--s2);align-items:start}.v-highlight:nth-child(2){border-color:var(--export-accent-decoration)}.v-highlight figure{position:relative;width:80px;height:80px}.v-highlight img{position:relative;width:100%;height:100%;object-fit:cover}.v-highlight h2{margin-top:0;font:400 16px/19px var(--font-display)}.v-live{padding:var(--s4) 0;border-bottom:1px solid var(--color-border)}.v-live a{display:block;color:var(--color-text);font-size:10px;font-weight:700;line-height:16px;overflow-wrap:anywhere;text-decoration:none}.v-actions{padding-top:var(--s4)}.v-listen{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:var(--gutter)}.v-listen>div{grid-column:1/span 6;display:flex;flex-direction:column;justify-content:center}.v-listen .qr{grid-column:7/-1;justify-self:end}.v-contact{margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:end}.v-contact .contact{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--s2)}.v-contact .contact span{margin:0}.v-contact .contact span+span{margin:0}.v-contact .contact strong{margin:0;font-size:12px;line-height:16px}.photo-credits{position:absolute;right:var(--inset);bottom:14px;left:var(--inset);margin:0;color:var(--color-text-muted);font-size:8px;line-height:11px;letter-spacing:.015em;text-align:center}.pull-quote{margin-top:var(--s3);border-left:2px solid var(--export-accent-decoration);padding:var(--s1) 0 var(--s1) var(--s4)}.pull-quote p{color:var(--color-text);font:400 15px/19px var(--font-display)}.pull-quote cite{display:block;margin-top:var(--s2);color:var(--color-text-muted);font-size:9px;font-weight:700;line-height:12px;text-transform:uppercase;font-style:normal}.density-compact .pull-quote p{font-size:14px;line-height:17px}@page{size:letter portrait;margin:0}@media print{html,body,.sheet{width:8.5in;height:11in}.sheet{--baseline:4px;--inset:48px;--gutter:12px}}
.density-compact{--s3:10px;--s4:12px;--s6:18px}
.density-compact .hero{height:200px}
.density-compact .bio,.density-compact .v-bio{line-height:15px}
.density-compact .deck{font-size:17px}
.density-compact .hero-copy h1{font-size:48px}
.density-compact .title h1{font-size:44px}
.density-compact .member figure,.density-compact .member img{width:64px;height:64px}
.density-compact .highlight figure,.density-compact .highlight img{width:64px;height:64px}
.density-compact .v-member figure{width:44px}.density-compact .v-member{grid-template-columns:44px minmax(0,1fr)}
.density-compact .v-highlight figure{width:74px;height:74px}.density-compact .v-highlight{grid-template-columns:74px minmax(0,1fr)}






`;

const renderMember = async (member: PressContent["members"][number], creatorId: string, vertical: boolean): Promise<string> => {
  // Print spec matches the rendered box: vertical member boxes are portrait
  // (48px wide, stretched ~60px tall with role+bio) — a square spec would
  // force an imgproxy square middleman that CSS-cover then slices, wasting
  // native resolution. Horizontal boxes stay square.
  const target = vertical
    ? { slot: "member" as const, width: 150, height: 188 }
    : { slot: "member" as const, width: 225, height: 225 };
  const src = await resolvePrintImageUrl(
    member.photo,
    creatorId,
    target,
  );
  const figure = photoFigure("", member.photo, src, `${member.name} portrait`);
  return vertical
    ? `<article class="v-member">${figure}<div><h3>${escapeHtml(member.name)}</h3>${member.role ? `<p class="role">${escapeHtml(member.role)}</p>` : ""}${member.bio ? `<p class="v-member-bio">${escapeHtml(truncateAtWord(member.bio, 60))}</p>` : ""}</div></article>`
    : `<article class="member">${figure}<div><h3>${escapeHtml(member.name)}</h3>${member.role ? `<p class="role">${escapeHtml(member.role)}</p>` : ""}${member.bio ? `<p class="member-bio">${escapeHtml(truncateAtWord(member.bio, 72))}</p>` : ""}</div></article>`;
};

const renderHighlight = async (highlight: PressContent["highlights"][number], creatorId: string, vertical: boolean): Promise<string> => {
  const size = vertical ? 200 : 225;
  const src = await resolvePrintImageUrl(
    highlight.coverArt,
    creatorId,
    { slot: "cover", width: size, height: size },
  );
  const figure = photoFigure("", highlight.coverArt, src, `${highlight.title} artwork`);
  const copy = `<div>${highlight.eyebrow ? `<span class="eyebrow">${escapeHtml(highlight.eyebrow)}</span>` : ""}<h2>${escapeHtml(highlight.title)}</h2>${highlight.metric ? `<p class="metric">${escapeHtml(highlight.metric)}</p>` : highlight.description ? `<p>${escapeHtml(truncateAtWord(highlight.description, 68))}</p>` : ""}</div>`;
  return `<article class="${vertical ? "v-highlight" : "highlight"}">${figure}${copy}</article>`;
};

const quoteBlock = (quote: PressContent["pressQuotes"][number]): string =>
  `<aside class="pull-quote"><p>\u201C${escapeHtml(quote.text)}\u201D</p><cite>\u2014 ${escapeHtml(quote.source)}</cite></aside>`;

const oneSheetHtml = async (input: {
  creator: { id: string; displayName: string; handle: string | null; socialLinks: readonly SocialLink[] };
  content: PressContent;
  destinationUrl: string;
  orientation: Exclude<OneSheetOrientation, "auto">;
  density?: "normal" | "compact" | "tight";
}): Promise<{ readonly bodyHtml: string; readonly style: string }> => {
  const { creator, content, destinationUrl, orientation } = input;
  const density = input.density ?? "normal";
  const vertical = orientation === "vertical";
  const lead = vertical ? (content.aboutPhoto ?? content.banner ?? content.gallery[0]) : (content.banner ?? content.gallery[0] ?? content.aboutPhoto);
  const leadSrc = await resolvePrintImageUrl(
    lead,
    creator.id,
    vertical
      ? { slot: "about", width: 725, height: 3000 }
      : { slot: "banner", width: 2250, height: 750 },
  );
  const qrOptions = { errorCorrectionLevel: "M" as const, margin: 4 };
  const moduleCount = QRCode.create(destinationUrl, qrOptions).modules.size + qrOptions.margin * 2;
  const qrSizePx = Math.ceil(Math.max(0.8 * 96, moduleCount * 0.4 / 25.4 * 96) / 4) * 4;
  if (qrSizePx > MAX_QR_SIZE_PX) {
    throw new ValidationError("QR destination is too long for a scannable one-sheet code");
  }
  const qr = await QRCode.toString(destinationUrl, {
    type: "svg",
    ...qrOptions,
    color: { dark: QR_DARK, light: QR_LIGHT },
  });
  const members = await Promise.all(content.members.slice(0, 4).map((member) => renderMember(member, creator.id, vertical)));
  const highlights = await Promise.all(content.highlights.slice(0, vertical ? 2 : 3).map((highlight) => renderHighlight(highlight, creator.id, vertical)));
  const bioSource = content.longBio || content.shortBio || "";
  const paragraphs = bioSource.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  const verticalBio = truncateAtWord(paragraphs[0] || content.shortBio || "", 440);
  const horizontalBio = [paragraphs[0] ?? content.shortBio ?? "", paragraphs[1] ?? ""]
    .map((value) => truncateAtWord(value, 440));
  const fans = content.forFansOf.slice(0, 7).join(" · ");
  const destinations = content.streamingLinks.slice(0, 5)
    .map((link) => `<a class="destination" href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>`)
    .join('<span class="destination-sep"> · </span>');
  const liveDatesLink = content.liveDatesUrl
    ? `<a href="${escapeHtml(content.liveDatesUrl)}">${escapeHtml(humanUrl(content.liveDatesUrl))} ↗</a>`
    : "";
  const contact = content.pressContactEmail ?? PRESS_EMAIL;
  const booking = content.bookingContactEmail;
  const leadFigure = photoFigure(vertical ? "rail" : "hero", lead, leadSrc, `${creator.displayName} lead photo`);

  const horizontalBody = `
<header class="mast"><strong>S/NC · Press</strong><span>${escapeHtml(creator.displayName)} · ${new Date().getUTCFullYear()}</span><span>One-sheet 01/01</span></header>
<div class="hero">${leadFigure.replace(/^<figure class="hero">|<\/figure>$/g, "")}<div class="hero-copy grid"><h1>${escapeHtml(creator.displayName)}</h1><p class="facts">${content.location ? `<b>${escapeHtml(content.location)}</b>` : ""}${content.tagline ? escapeHtml(content.tagline) : ""}</p></div></div>
<section class="story"><span class="kicker">About</span>${content.shortBio ? `<p class="deck">${escapeHtml(content.shortBio)}</p>` : ""}<div class="bio grid"><p>${escapeHtml(horizontalBio[0] ?? "")}</p><p>${escapeHtml(horizontalBio[1] ?? "")}</p></div>${content.pressQuotes.slice(0, 2).map(quoteBlock).join("")}${fans ? `<div class="fans grid"><span class="kicker">For fans of</span><p class="fan-line">${escapeHtml(fans)}</p></div>` : ""}</section>
${members.length ? `<section class="page-section"><span class="kicker section-label">Members</span><div class="members">${members.join("")}</div></section>` : ""}
${highlights.length ? `<section class="page-section"><span class="kicker section-label">Highlights</span><div class="highlights">${highlights.join("")}</div></section>` : ""}
${liveDatesLink ? `<section class="page-section live-link"><span class="kicker">Live dates</span>${liveDatesLink}</section>` : ""}
<div class="page-buffer"></div><footer class="actions grid"><div class="contact"><span>Press contact</span><strong>${escapeHtml(contact)}</strong>${booking ? `<span>Booking contact</span><strong>${escapeHtml(booking)}</strong>` : ""}</div><div class="listen-group"><div class="listen"><span class="kicker">Listen · scan or type</span><a class="url" href="${escapeHtml(destinationUrl)}">${escapeHtml(humanUrl(destinationUrl))}</a>${destinations ? `<p class="destinations">${destinations}</p>` : ""}</div><div class="qr">${qr}</div></div></footer>${content.photographyCredits ? `<p class="photo-credits">Photography: ${escapeHtml(content.photographyCredits)}</p>` : ""}`;

  const verticalBody = `
<div class="spread">${leadFigure}<div class="copy"><header class="mast"><strong>S/NC · Press</strong><span>Artist one-sheet · ${new Date().getUTCFullYear()}</span></header><section class="title"><h1>${escapeHtml(creator.displayName)}</h1><p class="location">${content.location ? `<span>${escapeHtml(content.location)}</span>` : ""}${content.tagline ? `<span>${escapeHtml(content.tagline)}</span>` : ""}</p></section><section class="v-about"><span class="kicker">About</span>${content.shortBio ? `<p class="deck">${escapeHtml(content.shortBio)}</p>` : ""}<p class="v-bio">${escapeHtml(verticalBio)}</p></section>${content.pressQuotes[0] ? quoteBlock(content.pressQuotes[0]) : ""}${fans ? `<section class="v-fans"><span class="kicker">For fans of</span><p class="fan-line">${escapeHtml(fans)}</p></section>` : ""}${members.length ? `<section class="v-content"><span class="kicker section-label">Members</span><div class="v-members">${members.join("")}</div></section>` : ""}${highlights.length ? `<section class="v-content"><span class="kicker section-label">Highlights</span><div class="v-highlights">${highlights.join("")}</div></section>` : ""}${liveDatesLink ? `<section class="v-live"><span class="kicker">Live dates</span>${liveDatesLink}</section>` : ""}<footer class="v-actions"><div class="v-listen"><div><span class="kicker">Listen · scan or type</span><a class="url" href="${escapeHtml(destinationUrl)}">${escapeHtml(humanUrl(destinationUrl))}</a>${destinations ? `<p class="destinations">${destinations}</p>` : ""}</div><div class="qr">${qr}</div></div><div class="v-contact"><div class="contact"><span>Press</span><strong>${escapeHtml(contact)}</strong>${booking ? `<span>·</span><span>Booking</span><strong>${escapeHtml(booking)}</strong>` : ""}</div></div></footer>${content.photographyCredits ? `<p class="photo-credits">Photography: ${escapeHtml(content.photographyCredits)}</p>` : ""}</div></div>`;

  return {
    bodyHtml: `<article data-pdf-sheet class="sheet ${vertical ? "vertical" : "horizontal"}${density !== "normal" ? ` density-${density}` : ""}">${vertical ? verticalBody : horizontalBody}</article>`,
    style: oneSheetCss(qrSizePx),
  };
};

const releaseRows = (values: readonly (string | null | undefined)[]): string =>
  values
    .filter((value): value is string => Boolean(value))
    .map((value) => `<p class="release-row">${escapeHtml(value)}</p>`)
    .join("");

const releaseSheet = async (
  release: ReleaseOneSheet,
  creatorId: string,
): Promise<{
  readonly bodyHtml: string;
  readonly style: string;
}> => {
  const artAlt = `${release.title} single artwork`;
  const artSrc = release.artKey
    ? await resolvePrintImageUrl(
        { key: release.artKey, alt: artAlt, credit: null },
        creatorId,
        { slot: "cover", width: 540, height: 540 },
      )
    : null;
  const titleHtml = artSrc
    ? `<div class="release-mast"><figure class="release-art"><img src="${escapeHtml(artSrc)}" alt="${escapeHtml(artAlt)}"></figure><h1>${escapeHtml(release.title)}</h1></div>`
    : `<h1>${escapeHtml(release.title)}</h1>`;
  return {
  bodyHtml: `<article data-pdf-sheet class="release-sheet">
<header class="release-brand">S/NC RECORDS · RELEASE ONE-SHEET</header>
${titleHtml}
<div class="release-columns">
<section><h2>Release details</h2>${releaseRows([
    release.catalogNumber,
    release.releaseDate,
    release.format,
    release.genre,
    release.isrc,
    release.upc,
    release.duration,
  ])}</section>
<section><h2>Personnel &amp; credits</h2>${releaseRows([
    ...release.personnel,
    release.writtenBy,
    release.producedBy,
    release.mixedMasteredBy,
    release.label,
    release.publisherLine,
    release.copyrightLine,
  ])}</section>
</div>
<footer>Press contact · ${PRESS_EMAIL}</footer>
</article>`,
  style: `
*{box-sizing:border-box}html,body{width:8.5in;height:11in;margin:0;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)}
.release-sheet{position:relative;width:8.5in;height:11in;padding:42px;overflow:hidden;border-top:6px solid var(--export-accent-decoration);background:var(--color-bg);color:var(--color-text);font-size:9px;line-height:1.45}
.release-brand{margin-bottom:12px;color:var(--color-accent);font-weight:700;letter-spacing:2px;text-transform:uppercase}
.release-sheet h1{margin:0 0 18px;font:700 28px/1.1 var(--font-display)}
.release-mast{display:flex;align-items:flex-end;gap:20px;margin:0 0 18px}
.release-mast h1{margin:0}
.release-art{margin:0;flex:none;width:1.8in;height:1.8in;border:1px solid var(--color-border)}
.release-art img{display:block;width:100%;height:100%;object-fit:cover}
.release-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.release-sheet h2{margin:12px 0 6px;color:var(--color-accent);font:700 8px/1.45 var(--font-body);letter-spacing:.08em;text-transform:uppercase}
.release-row{margin:0;padding:4px 0;border-bottom:.6px solid var(--color-border);overflow-wrap:anywhere}
.release-sheet footer{position:absolute;right:42px;bottom:18px;left:42px;color:var(--color-text-muted);font-size:7.5px;text-align:center}
@page{size:letter portrait;margin:0}@media print{html,body,.release-sheet{width:8.5in;height:11in}}
`,
  };
};

const exportDocumentAttributes = (
  identity: PdfExportIdentity,
): Readonly<Record<`data-${string}`, string>> => ({
  "data-theme": identity.theme ?? "light",
  "data-export-voice": resolvePdfExportIdentity(identity).voice,
});

/** Print the live web template with an explicit light-paper export identity. */
export const renderOnePagerPdf = async (input: {
  pageUrl: string;
  exportIdentity: PdfExportIdentity;
}): Promise<Buffer> => renderBrowserPdf({
  url: input.pageUrl,
  documentAttributes: exportDocumentAttributes(input.exportIdentity),
  style: buildPdfExportStyle(input.exportIdentity),
});

/** Render a curated single-page creator press sheet from the locked orientation-specific layouts.
 * Deterministic template (operator ruling, 2026-09-02): each orientation renders at exactly one
 * pinned density — vertical: compact, horizontal: normal — so the same content always produces
 * the same layout. Over-budget content fails loudly as BrowserPdfSinglePageFitError (route maps
 * to a 400 with trim guidance) instead of silently re-tiering. Supersedes the auto density
 * ladder, which served the iteration phase but made review rounds chase moving targets. */
export const renderCreatorOneSheetPdf = async (input: {
  creator: { id: string; displayName: string; handle: string | null; socialLinks: readonly SocialLink[] };
  content: PressContent;
  pressPageUrl: string;
  exportIdentity: PdfExportIdentity;
  destinationUrl?: string;
  orientation: OneSheetOrientation;
}): Promise<Buffer> => {
  const destinationUrl = input.destinationUrl
    ?? defaultDestinationUrl(input.creator, input.content, input.pressPageUrl);
  const orientation = input.orientation === "auto"
    ? (input.content.banner ? "horizontal" : input.content.aboutPhoto ? "vertical" : "horizontal")
    : input.orientation;
  const sheet = await oneSheetHtml({
    creator: input.creator,
    content: input.content,
    destinationUrl,
    orientation,
    density: orientation === "vertical" ? "compact" : "normal",
  });
  return renderBrowserPdf({
    url: input.pressPageUrl,
    replaceBodyHtml: sheet.bodyHtml,
    documentAttributes: exportDocumentAttributes(input.exportIdentity),
    style: `${buildPdfExportStyle(input.exportIdentity)}\n${sheet.style}`,
    singlePage: true,
  });
};

const EPK_PAGE = { widthIn: 5.5, heightIn: 8.5 } as const;

/** Half-Letter single-release EPK companion: story-led, deterministic, T3 direction. */
const releaseEpkSheet = async (
  release: ReleaseOneSheet,
  creatorId: string,
  destinationUrl: string,
): Promise<{
  readonly bodyHtml: string;
  readonly style: string;
}> => {
  const heroSpec = { slot: "banner" as const, width: 1650, height: 1100 };
  const duoSpec = { slot: "gallery" as const, width: 413, height: 656 };
  const coverSpec = { slot: "cover" as const, width: 200, height: 200 };

  const heroImage = release.photos[0]
    ?? (release.artKey ? { key: release.artKey, alt: `${release.title} artwork`, credit: null } : null);
  const heroSrc = heroImage
    ? await resolvePrintImageUrl(heroImage, creatorId, heroSpec)
    : null;
  const duoImage = release.photos[1] ?? null;
  const duoSrc = duoImage
    ? await resolvePrintImageUrl(duoImage, creatorId, duoSpec)
    : null;
  const coverSrc = release.artKey
    ? await resolvePrintImageUrl(
        { key: release.artKey, alt: `${release.title} single artwork`, credit: null },
        creatorId,
        coverSpec,
      )
    : null;

  const facts = [
    release.catalogNumber,
    release.releaseDate,
    release.duration,
    release.genre,
  ].filter((fact): fact is string => Boolean(fact));
  const recordedAt = release.mixedMasteredBy?.includes("S/NC Studio") ? "S/NC Studio" : null;
  const creditRows = [
    ...(release.personnel.length ? [["Performed by", release.personnel.join("\n")] as [string, string]] : []),
    ["Written by", release.writtenBy],
    ["Produced by", release.producedBy],
    ["Recorded at", recordedAt],
    ["Mixed + mastered", release.mixedMasteredBy],
    ...(release.fcc ? [["FCC", release.fcc === "clean" ? "Clean" : "Explicit"] as [string, string]] : []),
    ["Press", "press@s-nc.org"],
    ["Booking", "booking@s-nc.org"],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const photoCredits = [...new Set(
    [heroImage?.credit, duoImage?.credit].filter((credit): credit is string => Boolean(credit)),
  )].join(" · ");
  const pulls = release.lyricPulls.slice(0, 4);
  const story = release.story ? truncateAtWord(release.story, 700) : "";
  const heroAlt = heroImage?.alt ?? `${release.title} hero`;
  const qrOptions = { errorCorrectionLevel: "M" as const, margin: 4 };
  const moduleCount = QRCode.create(destinationUrl, qrOptions).modules.size + qrOptions.margin * 2;
  const qrSizePx = Math.ceil(Math.max(0.8 * 96, moduleCount * 0.4 / 25.4 * 96) / 4) * 4;
  if (qrSizePx > MAX_QR_SIZE_PX) {
    throw new ValidationError("QR destination is too long for a scannable EPK code");
  }
  const qr = await QRCode.toString(destinationUrl, { type: "svg", ...qrOptions, color: { dark: QR_DARK, light: QR_LIGHT } });

  return {
    bodyHtml: `<article data-pdf-sheet class="epk-sheet">
<header class="mast"><strong>S/NC RECORDS</strong><span>SINGLE EPK</span></header>
${heroSrc ? `<div class="hero"><img src="${escapeHtml(heroSrc)}" alt="${escapeHtml(heroAlt)}"><div class="hero-copy"><div><span class="artist">Animal Future</span><h1>${escapeHtml(release.title)}</h1></div><div class="facts"><b>${escapeHtml(release.catalogNumber ?? "Single")}</b>${facts.map((fact) => escapeHtml(fact)).join(" · ")}</div></div></div>` : `<div class="hero hero-empty"><h1>${escapeHtml(release.title)}</h1></div>`}
<div class="epk-body">
<div>
${pulls.length ? `<div class="pull">&ldquo;${escapeHtml(pulls[0] ?? "")}&rdquo;</div>` : ""}
${story ? `<p class="story">${escapeHtml(story)}</p>` : ""}
</div>
${pulls.length > 1 ? `<div class="pulls">${pulls.slice(1).map((pull) => `<div class="pull-line">&ldquo;${escapeHtml(pull)}&rdquo;</div>`).join("")}</div>` : ""}
<div class="support">
${duoSrc ? `<img class="duo" src="${escapeHtml(duoSrc)}" alt="${escapeHtml(duoImage?.alt ?? "live photo")}">` : ""}
<div class="col">
<div class="rows">${creditRows.map(([label, value]) => `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join("")}</div>
${coverSrc ? `<div class="cover-row"><img class="cover" src="${escapeHtml(coverSrc)}" alt="${escapeHtml(release.title)} cover art"><span>Album artwork</span></div>` : ""}
</div>
</div>
</div>
<footer class="epk-footer"><div><a class="listen" href="${escapeHtml(destinationUrl)}">${escapeHtml(humanUrl(destinationUrl))}</a>${photoCredits ? `<span class="photo-credits">Photography: ${escapeHtml(photoCredits)}</span>` : ""}</div><div class="qr">${qr}</div></footer>
</article>`,
    style: `
*{box-sizing:border-box}html,body{width:5.5in;height:8.5in;margin:0;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body);print-color-adjust:exact;-webkit-print-color-adjust:exact}
.epk-sheet{width:5.5in;height:8.5in;background:var(--color-bg);color:var(--color-text);display:flex;flex-direction:column;overflow:hidden}
.mast{display:flex;justify-content:space-between;padding:10px 24px;border-bottom:2px solid var(--export-accent-decoration);color:var(--color-text-muted);font:700 8px/1.3 var(--font-display);letter-spacing:.16em;text-transform:uppercase}
.mast strong{color:var(--color-accent);font-size:9px;letter-spacing:.18em}
.hero{position:relative}
.hero img{width:100%;height:288px;object-fit:cover;object-position:center top;display:block;filter:saturate(.72) contrast(1.04) brightness(.92)}
.hero-copy{position:absolute;left:24px;right:24px;bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
.hero-copy .artist{display:block;font:700 11px var(--font-display);letter-spacing:.3em;text-transform:uppercase;color:var(--color-on-media);margin-bottom:3px}
.hero-copy h1{margin:0;font:400 54px/48px var(--font-display);letter-spacing:-.02em;color:var(--color-accent)}
.hero-copy .facts{text-align:right;color:var(--color-on-media);font-size:9.5px;line-height:15px}
.hero-copy .facts b{display:block;color:var(--color-accent)}
.hero-empty{padding:26px 24px}
.hero-empty h1{margin:0;font:400 54px/48px var(--font-display);color:var(--color-accent)}
.epk-body{flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:14px 24px 0}
.pull{border-left:2px solid var(--export-accent-decoration);padding:3px 0 3px 12px;font:400 16px/20px var(--font-display);margin:0 0 11px}
.story{margin:0;font-size:10.5px;line-height:17px;color:var(--color-text-muted)}[data-theme="dark"] .story{color:var(--color-text);opacity:.75}
.pulls{display:grid;grid-template-columns:1.3fr .8fr 1.1fr;gap:10px;margin:14px 0 0;border-top:1px solid var(--color-border);padding-top:12px}
.pull-line{font:400 12.5px/16px var(--font-display);color:var(--color-text)}
.pull-line:first-child{border-left:2px solid var(--export-accent-decoration);padding-left:10px}
.support{display:flex;gap:12px;align-items:stretch;margin-top:10px}
.duo{width:150px;object-fit:cover;object-position:center 30%;border:1px solid var(--color-border);display:block}
.col{flex:1;display:flex;flex-direction:column;justify-content:space-between}
.row{display:flex;justify-content:space-between;border-bottom:.6px solid var(--color-border);padding:5px 0;font-size:9px;color:var(--color-text-muted)}
.row b{color:var(--color-text);font-weight:600;white-space:pre-line;text-align:right}
.cover-row{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:10px}
.cover{width:84px;height:84px;object-fit:cover;border:1px solid var(--color-border)}
.cover-row span{font-size:8px;color:var(--color-text-muted)}
.epk-footer{padding:12px 24px 14px;border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:end;font-size:7.5px;color:var(--color-text-muted)}
.epk-footer .listen{color:var(--color-text);font-weight:700;text-decoration:none;font-size:8.5px;display:block}
.epk-footer .photo-credits{display:block;margin-top:2px;font-size:7px;letter-spacing:.015em}
.qr{width:44px;height:44px;background:${QR_LIGHT}}.qr svg{display:block;width:100%;height:100%}
@page{size:5.5in 8.5in;margin:0}
`,
  };
};

/** Render the half-Letter single-release EPK companion. Deterministic: one pinned layout;
 * over-budget content fails loudly for the route to map. */
export const renderReleaseEpkPdf = async (input: {
  release: ReleaseOneSheet;
  creatorId: string;
  pressPageUrl: string;
  exportIdentity: PdfExportIdentity;
  destinationUrl?: string;
}): Promise<Buffer> => {
  const destinationUrl = input.destinationUrl
    ?? input.release.preSaveUrl
    ?? input.pressPageUrl
    ?? "";
  const sheet = await releaseEpkSheet(input.release, input.creatorId, destinationUrl);
  return renderBrowserPdf({
    url: input.pressPageUrl,
    replaceBodyHtml: sheet.bodyHtml,
    documentAttributes: exportDocumentAttributes(input.exportIdentity),
    style: `${buildPdfExportStyle(input.exportIdentity)}\n${sheet.style}`,
    singlePage: true,
    pageSize: EPK_PAGE,
  });
};

/** Render a release one-sheet through the shared retained-head browser export contract. */
export const renderReleaseOneSheetPdf = async (input: {
  release: ReleaseOneSheet;
  creatorId: string;
  pressPageUrl: string;
  exportIdentity: PdfExportIdentity;
}): Promise<Buffer> => {
  const sheet = await releaseSheet(input.release, input.creatorId);
  return renderBrowserPdf({
    url: input.pressPageUrl,
    replaceBodyHtml: sheet.bodyHtml,
    documentAttributes: exportDocumentAttributes(input.exportIdentity),
    style: `${buildPdfExportStyle(input.exportIdentity)}\n${sheet.style}`,
    singlePage: true,
  });
};
