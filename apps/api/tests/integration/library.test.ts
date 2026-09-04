import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { chromium } from "playwright";
import QRCode from "qrcode";

import { DEFAULT_PRESS_CONTENT } from "@snc/shared";

import { db } from "../../src/db/connection.js";
import {
  contentAssets,
  contentBlobs,
} from "../../src/db/schema/library.schema.js";
import { creatorProfiles } from "../../src/db/schema/creator.schema.js";
import { users } from "../../src/db/schema/user.schema.js";
import {
  canUseAsset,
  deleteLibraryAsset,
  getLibraryAsset,
  grantLibraryAssetUse,
  isRegisteredLibraryAsset,
  listLibraryAssets,
  revokeLibraryAssetUse,
  uploadLibraryAsset,
} from "../../src/services/library.js";
import { storage } from "../../src/storage/index.js";
import { libraryRawRoutes } from "../../src/routes/library-raw.routes.js";
import { validateOwnedPressKeys } from "../../src/services/press-images.js";
import {
  buildPdfExportStyle,
  renderCreatorOneSheetPdf,
  renderOnePagerPdf,
  renderReleaseOneSheetPdf,
} from "../../src/services/press-pdf.js";
import { publishPressConfig, upsertPressConfig } from "../../src/services/press.js";

let baseBytes: Uint8Array;
const imageBytes = (suffix: number): Uint8Array =>
  Uint8Array.from([...baseBytes, suffix]);

const creatorIds = [randomUUID(), randomUUID(), randomUUID()];
const grantorUserId = randomUUID();
const uploadedKeys = new Set<string>();
const blobHashes = new Set<string>();

const ownerActor = { creatorId: creatorIds[0]!, isAdmin: false };
const granteeActor = { creatorId: creatorIds[1]!, isAdmin: false };
const otherActor = { creatorId: creatorIds[2]!, isAdmin: false };
const adminActor = { creatorId: creatorIds[2]!, isAdmin: true };

const upload = async (
  creatorId: string | null,
  suffix: number,
  sharing: "private" | "requestable" | "open" = "private",
) => {
  const bytes = imageBytes(suffix);
  const result = await uploadLibraryAsset(
    creatorId,
    {
      name: `image-${suffix}.png`,
      declaredType: suffix % 2 === 0 ? "image/jpeg" : "image/png",
      size: bytes.byteLength,
      bytes,
    },
    sharing,
  );
  if (result.ok) {
    uploadedKeys.add(result.value.asset.storageKey);
    blobHashes.add(result.value.asset.blobSha256);
  }
  return result;
};

beforeAll(async () => {
  baseBytes = Uint8Array.from(await QRCode.toBuffer("S/NC integration media", {
    margin: 0,
    type: "png",
    width: 96,
  }));
  await db.insert(creatorProfiles).values(
    creatorIds.map((id) => ({ id, displayName: `Library test ${id}` })),
  );
  const now = new Date();
  await db.insert(users).values({
    id: grantorUserId,
    name: "Library grantor",
    email: `library-${grantorUserId}@example.test`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
});

afterAll(async () => {
  for (const key of uploadedKeys) await storage.delete(key);
  await db.delete(creatorProfiles).where(inArray(creatorProfiles.id, creatorIds));
  await db.delete(users).where(eq(users.id, grantorUserId));
  if (blobHashes.size > 0) {
    await db.delete(contentBlobs).where(inArray(contentBlobs.sha256, [...blobHashes]));
  }
});

describe("content library integration", () => {
  it("authorizes press references from live own/open/granted registrations only", async () => {
    const own = await upload(creatorIds[1]!, 70, "private");
    const foreignPrivate = await upload(creatorIds[0]!, 71, "private");
    const open = await upload(creatorIds[0]!, 72, "open");
    const requestable = await upload(creatorIds[0]!, 73, "requestable");
    expect([own, foreignPrivate, open, requestable].every((result) => result.ok)).toBe(true);
    if (!own.ok || !foreignPrivate.ok || !open.ok || !requestable.ok) return;

    await expect(validateOwnedPressKeys({
      banner: { key: own.value.asset.storageKey, alt: "Own" },
      aboutPhoto: { key: open.value.asset.storageKey, alt: "Open" },
      photos: [`creators/${granteeActor.creatorId}/press/legacy.jpg`],
    }, granteeActor)).resolves.toBeUndefined();

    await expect(validateOwnedPressKeys({
      gallery: [{ key: foreignPrivate.value.asset.storageKey, alt: "Private" }],
    }, granteeActor)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(validateOwnedPressKeys({
      gallery: [{ key: requestable.value.asset.storageKey, alt: "Requestable" }],
    }, granteeActor)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(await grantLibraryAssetUse(
      ownerActor,
      requestable.value.asset.id,
      granteeActor.creatorId,
      grantorUserId,
    )).toEqual({ ok: true, value: undefined });
    await expect(validateOwnedPressKeys({
      gallery: [{ key: requestable.value.asset.storageKey, alt: "Granted" }],
    }, granteeActor)).resolves.toBeUndefined();

    await db
      .update(contentAssets)
      .set({ deletedAt: new Date() })
      .where(eq(contentAssets.id, own.value.asset.id));
    await expect(validateOwnedPressKeys({
      gallery: [{ key: own.value.asset.storageKey, alt: "Tombstoned" }],
    }, granteeActor)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("lets a Studio export override conflicting Records route aliases in real Chromium", async () => {
    const creatorId = creatorIds[0]!;
    expect(await upsertPressConfig(creatorId, {
      ...DEFAULT_PRESS_CONTENT,
      enabled: true,
      template: "A",
      shortBio: "Export cascade integration fixture.",
    })).toMatchObject({ ok: true });
    expect(await publishPressConfig(creatorId)).toMatchObject({ ok: true });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`http://localhost:3080/creators/${creatorId}/press`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(() => getComputedStyle(document.documentElement)
        .getPropertyValue("--voice-studio-accent").trim() !== "");

      const probe = async (style: string) => page.evaluate((exportStyle) => {
        document.documentElement.dataset.theme = "light";
        document.documentElement.dataset.exportVoice = "studio";
        const template = document.querySelector<HTMLElement>("[data-press-template]");
        if (!template) throw new Error("Press template root is missing");
        template.dataset.route = "records";

        document.querySelector("#pdf-export-probe-style")?.remove();
        const styleElement = document.createElement("style");
        styleElement.id = "pdf-export-probe-style";
        styleElement.textContent = exportStyle;
        document.head.append(styleElement);

        template.querySelector("[data-export-probes]")?.remove();
        const probes = document.createElement("div");
        probes.dataset.exportProbes = "";
        const definitions = {
          accent: ["color", "var(--color-accent)"],
          link: ["color", "var(--color-link)"],
          linkHover: ["color", "var(--color-link-hover)"],
          radius: ["borderRadius", "var(--radius)"],
          radiusSm: ["borderRadius", "var(--radius-sm)"],
          radiusMd: ["borderRadius", "var(--radius-md)"],
          radiusLg: ["borderRadius", "var(--radius-lg)"],
          radiusXl: ["borderRadius", "var(--radius-xl)"],
          decoration: ["borderTopColor", "var(--export-accent-decoration)"],
        } as const;
        for (const [name, [property, value]] of Object.entries(definitions)) {
          const element = document.createElement("span");
          element.dataset.probe = name;
          element.style.setProperty(
            property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
            value,
          );
          probes.append(element);
        }
        template.append(probes);

        const computed = (name: string): CSSStyleDeclaration => {
          const element = probes.querySelector<HTMLElement>(`[data-probe="${name}"]`);
          if (!element) throw new Error(`Missing ${name} probe`);
          return getComputedStyle(element);
        };
        return {
          accent: computed("accent").color,
          link: computed("link").color,
          linkHover: computed("linkHover").color,
          radius: computed("radius").borderRadius,
          radiusSm: computed("radiusSm").borderRadius,
          radiusMd: computed("radiusMd").borderRadius,
          radiusLg: computed("radiusLg").borderRadius,
          radiusXl: computed("radiusXl").borderRadius,
          decoration: computed("decoration").borderTopColor,
        };
      }, style);

      const eligible = await probe(buildPdfExportStyle({
        producingUnit: "studio",
        federationHandle: "studio-creator",
        creatorBrandColor: "#f28482",
      }));
      expect(eligible).toEqual({
        accent: "rgb(126, 74, 42)",
        link: "rgb(126, 74, 42)",
        linkHover: "rgb(101, 58, 34)",
        radius: "14px",
        radiusSm: "7px",
        radiusMd: "14px",
        radiusLg: "21px",
        radiusXl: "28px",
        decoration: "rgb(242, 132, 130)",
      });

      const ineligible = await probe(buildPdfExportStyle({
        producingUnit: "studio",
        federationHandle: null,
        creatorBrandColor: "#f28482",
      }));
      expect(ineligible.decoration).toBe("rgb(126, 74, 42)");
    } finally {
      await browser.close();
    }
  });

  it("renders retained-head voice exports with real media as US Letter output", async () => {
    const libraryUpload = await upload(creatorIds[0]!, 74, "private");
    expect(libraryUpload.ok).toBe(true);
    if (!libraryUpload.ok) return;

    const legacyKey = `creators/${creatorIds[0]}/press/integration-hero.png`;
    const legacyUpload = await storage.upload(
      legacyKey,
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(baseBytes);
          controller.close();
        },
      }),
      { contentType: "image/png", contentLength: baseBytes.byteLength },
    );
    expect(legacyUpload.ok).toBe(true);
    uploadedKeys.add(legacyKey);

    const pressArtKey = `creators/${creatorIds[0]}/press/integration-release-art.png`;
    const artUpload = await storage.upload(
      pressArtKey,
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(baseBytes);
          controller.close();
        },
      }),
      { contentType: "image/png", contentLength: baseBytes.byteLength },
    );
    expect(artUpload.ok).toBe(true);
    uploadedKeys.add(pressArtKey);

    const creator = {
      id: creatorIds[0]!,
      displayName: "Library integration creator",
      handle: null,
      socialLinks: [],
    };
    const exportIdentity = {
      producingUnit: "records",
      federationHandle: null,
      creatorBrandColor: null,
    };
    const pressPageUrl = `http://localhost:3080/creators/${creator.id}/press`;
    const content = {
      ...DEFAULT_PRESS_CONTENT,
      enabled: true,
      template: "A" as const,
      tagline: "Retained-head integration",
      shortBio: "A browser-rendered press fixture.",
      banner: { key: legacyKey, alt: "Integration hero" },
      aboutPhoto: {
        key: libraryUpload.value.asset.storageKey,
        alt: "Library integration portrait",
      },
    };
    expect(await upsertPressConfig(creator.id, content)).toMatchObject({ ok: true });
    expect(await publishPressConfig(creator.id)).toMatchObject({ ok: true });

    const fullA = await renderOnePagerPdf({ pageUrl: pressPageUrl, exportIdentity });
    expect(fullA.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(fullA.toString("latin1")).toContain("/MediaBox [0 0 612 792]");

    expect(await upsertPressConfig(creator.id, { template: "B" })).toMatchObject({ ok: true });
    expect(await publishPressConfig(creator.id)).toMatchObject({ ok: true });
    const fullB = await renderOnePagerPdf({ pageUrl: pressPageUrl, exportIdentity });
    expect(fullB.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(fullB.toString("latin1")).toContain("/MediaBox [0 0 612 792]");

    const horizontal = await renderCreatorOneSheetPdf({
      creator,
      content,
      pressPageUrl,
      exportIdentity,
      orientation: "horizontal",
    });
    const vertical = await renderCreatorOneSheetPdf({
      creator,
      content: { ...content, banner: null },
      pressPageUrl,
      exportIdentity,
      orientation: "vertical",
    });
    const longField = `Long release field ${"wrap ".repeat(28)}`;
    const release = await renderReleaseOneSheetPdf({
      release: {
        slug: "integration-release",
        title: longField,
        catalogNumber: "SNCR-INTEGRATION",
        releaseDate: "2026-08-14",
        format: "Album",
        genre: longField,
        isrc: "US-SNC-26-99999",
        upc: "012345678901",
        duration: "42:00",
        personnel: Array.from({ length: 6 }, (_, index) => `${longField} ${index + 1}`),
        writtenBy: longField,
        producedBy: longField,
        mixedMasteredBy: longField,
        copyrightLine: "℗ 2026 S/NC Records",
        publisherLine: "© 2026 Signal to Noise Collective",
        label: "S/NC Records",
        fcc: "clean",
        artKey: null,
        lyricPulls: [],
        photos: [],
      },
      creatorId: creator.id,
      pressPageUrl,
      exportIdentity,
    });

    const withArt = await renderReleaseOneSheetPdf({
      release: {
        slug: "integration-release",
        title: "Cover Art Release",
        catalogNumber: "SNCR-INTEGRATION-ART",
        releaseDate: "2026-08-14",
        format: "Album",
        genre: "Integration",
        isrc: "US-SNC-26-99998",
        upc: "012345678901",
        duration: "42:00",
        personnel: ["Integration Artist — vocals"],
        writtenBy: "Integration Artist",
        producedBy: "Integration Artist",
        mixedMasteredBy: "Integration Artist",
        copyrightLine: "℗ 2026 S/NC Records",
        publisherLine: "© 2026 Signal to Noise Collective",
        label: "S/NC Records",
        fcc: "clean",
        artKey: pressArtKey,
        lyricPulls: [],
        photos: [],
      },
      creatorId: creator.id,
      pressPageUrl,
      exportIdentity,
    });

    for (const buffer of [horizontal, vertical, release]) {
      const pdfText = buffer.toString("latin1");
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
      expect(buffer.length).toBeGreaterThan(100);
      expect(pdfText.match(/\/Type \/Page\b/g)).toHaveLength(1);
      expect(pdfText.match(/\/MediaBox \[0 0 612 792\]/g)).toHaveLength(1);
      expect(pdfText).not.toContain("--voice-");
    }

    const withArtText = withArt.toString("latin1");
    const imageXObjects = (text: string) => text.match(/\/Subtype \/Image/g)?.length ?? 0;
    expect(withArt.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(withArtText.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(imageXObjects(withArtText)).toBeGreaterThan(0);
    expect(imageXObjects(withArtText)).toBeGreaterThan(
      imageXObjects(release.toString("latin1")),
    );
  });

  it("loudly rejects over-budget content at the pinned one-sheet template", async () => {
    const creator = {
      id: creatorIds[0]!,
      displayName: "Heavy Volume Creator",
      handle: null,
      socialLinks: [],
    };
    const exportIdentity = {
      producingUnit: "records",
      federationHandle: null,
      creatorBrandColor: null,
    };
    const pressPageUrl = `http://localhost:3080/creators/${creator.id}/press`;
    const heavy = {
      ...DEFAULT_PRESS_CONTENT,
      enabled: true,
      template: "A" as const,
      tagline: "New single “This Hell” out Sep 17, 2026 · debut LP March 2027",
      shortBio:
        "Fort Collins band makes socially conscious punk-leaning rock that hits where it hurts — mental health, addiction, and life under a corporate-run world. Raw, funny, and unpredictable.",
      longBio: `${"Fueled by the fury of the forgotten, the band crafts music that hits where it hurts — tackling mental health, addiction, and the dehumanizing weight of a corporate-run world. ".repeat(24)}`,
      forFansOf: ["IDLES", "Radiohead", "Modest Mouse", "Pixies", "Yeah Yeah Yeahs", "Paramore"],
      members: [
        { name: "LeAnna Warren", role: "vocals, electric guitar" },
        { name: "Charles Tyrie", role: "drums" },
        { name: "Jarod Ford", role: "bass" },
        { name: "Connor Mandli", role: "electric guitar" },
      ],
      highlights: [
        { eyebrow: "Out now · SNCR-001", title: "The Illusionist", description: "First single from the debut LP — next single out Sep 17, 2026." },
        { eyebrow: "Standout track", title: "Get to You", metric: "14k+ and climbing" },
        { eyebrow: "Next single · SNCR-002", title: "This Hell", description: "Out Sep 17, 2026 — second single from the debut LP." },
      ],
      location: "Fort Collins, CO",
      pressQuotes: [
        { text: `An unbounded pull-quote stress line. ${"Their live show rewires the room. ".repeat(30)}`, source: "Overflow Probe Gazette" },
      ],
      standoutTrack: {
        title: "Get to You",
        url: "https://open.spotify.com/track/2WKznD3Xx28IGcqwEjytWS",
        streamsLabel: "14k+ and climbing",
      },
    };
    expect(await upsertPressConfig(creator.id, heavy)).toMatchObject({ ok: true });
    expect(await publishPressConfig(creator.id)).toMatchObject({ ok: true });

    // The over-budget fixture exceeds every pinned template's density — both
    // orientations fail loudly with actionable guidance instead of re-tiering.
    for (const orientation of ["horizontal", "vertical"] as const) {
      await expect(renderCreatorOneSheetPdf({
        creator,
        content: heavy,
        pressPageUrl,
        exportIdentity,
        orientation,
      })).rejects.toThrow(/does not fit one page/);
    }
  });

  it("round-trips Garage bytes and enforces private/open/requestable sharing", async () => {
    const privateUpload = await upload(creatorIds[0]!, 1, "private");
    expect(privateUpload.ok).toBe(true);
    if (!privateUpload.ok) return;

    const privateAsset = privateUpload.value.asset;
    expect(privateAsset).toMatchObject({
      mimeType: "image/png",
      width: 96,
      height: 96,
      useStatus: "own",
    });
    expect(await canUseAsset(ownerActor, privateAsset.storageKey)).toBe(true);
    expect(await canUseAsset(granteeActor, privateAsset.storageKey)).toBe(false);
    expect(await getLibraryAsset(granteeActor, privateAsset.id)).toMatchObject({ ok: false });
    const granteeBeforeSharing = await listLibraryAssets(granteeActor);
    expect(granteeBeforeSharing.ok).toBe(true);
    if (granteeBeforeSharing.ok) {
      expect(granteeBeforeSharing.value.items.some((item) => item.id === privateAsset.id)).toBe(false);
    }

    const repeated = await upload(creatorIds[0]!, 1, "private");
    expect(repeated).toMatchObject({
      ok: true,
      value: { deduped: true, asset: { id: privateAsset.id } },
    });

    const openUpload = await upload(creatorIds[0]!, 2, "open");
    expect(openUpload.ok).toBe(true);
    if (!openUpload.ok) return;
    expect(await canUseAsset(otherActor, openUpload.value.asset.storageKey)).toBe(true);
    const otherBrowse = await listLibraryAssets(otherActor);
    expect(otherBrowse.ok).toBe(true);
    if (otherBrowse.ok) {
      expect(otherBrowse.value.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: openUpload.value.asset.id,
            canUse: true,
            useStatus: "open",
          }),
        ]),
      );
    }

    const requestableUpload = await upload(creatorIds[0]!, 3, "requestable");
    expect(requestableUpload.ok).toBe(true);
    if (!requestableUpload.ok) return;
    const requestableAsset = requestableUpload.value.asset;
    expect(await canUseAsset(granteeActor, requestableAsset.storageKey)).toBe(false);
    const beforeGrant = await getLibraryAsset(granteeActor, requestableAsset.id);
    expect(beforeGrant).toMatchObject({
      ok: true,
      value: { canUse: false, useStatus: "requestable-needs-grant" },
    });

    expect(
      await grantLibraryAssetUse(
        ownerActor,
        requestableAsset.id,
        granteeActor.creatorId,
        grantorUserId,
      ),
    ).toEqual({ ok: true, value: undefined });
    expect(await canUseAsset(granteeActor, requestableAsset.storageKey)).toBe(true);
    expect(await getLibraryAsset(granteeActor, requestableAsset.id)).toMatchObject({
      ok: true,
      value: { canUse: true, useStatus: "granted" },
    });

    expect(
      await revokeLibraryAssetUse(ownerActor, requestableAsset.id, granteeActor.creatorId),
    ).toEqual({ ok: true, value: undefined });
    expect(await canUseAsset(granteeActor, requestableAsset.storageKey)).toBe(false);

    // Admins can manage grants across creators and use even private registrations.
    expect(
      await grantLibraryAssetUse(
        adminActor,
        requestableAsset.id,
        granteeActor.creatorId,
        grantorUserId,
      ),
    ).toEqual({ ok: true, value: undefined });
    expect(await canUseAsset(granteeActor, requestableAsset.storageKey)).toBe(true);
    expect(
      await revokeLibraryAssetUse(adminActor, requestableAsset.id, granteeActor.creatorId),
    ).toEqual({ ok: true, value: undefined });
    expect(await canUseAsset(adminActor, privateAsset.storageKey)).toBe(true);
    const adminBrowse = await listLibraryAssets(adminActor);
    expect(adminBrowse.ok).toBe(true);
    if (adminBrowse.ok) {
      expect(adminBrowse.value.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: privateAsset.id, useStatus: "admin", canUse: true }),
        ]),
      );
    }

    // Cross-creator bytes dedup at the blob layer while keeping registrations distinct.
    const crossCreator = await upload(creatorIds[1]!, 2, "private");
    expect(crossCreator).toMatchObject({
      ok: true,
      value: {
        deduped: true,
        asset: { storageKey: openUpload.value.asset.storageKey },
      },
    });
    if (crossCreator.ok) {
      expect(crossCreator.value.asset.id).not.toBe(openUpload.value.asset.id);
    }

    expect(await isRegisteredLibraryAsset(ownerActor.creatorId, privateAsset.storageKey)).toBe(true);
    const deleted = await deleteLibraryAsset(ownerActor, privateAsset.id);
    expect(deleted).toEqual({ ok: true, value: undefined });
    expect(await isRegisteredLibraryAsset(ownerActor.creatorId, privateAsset.storageKey)).toBe(false);

    const rawPath = privateAsset.storageKey.slice("library/".length);
    const rawResponse = await libraryRawRoutes.request(`/raw/${rawPath}`);
    expect(rawResponse.status).toBe(200);
    expect(rawResponse.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await rawResponse.arrayBuffer())).toEqual(imageBytes(1));

    const reuploaded = await upload(creatorIds[0]!, 1, "open");
    expect(reuploaded).toMatchObject({
      ok: true,
      value: {
        deduped: true,
        asset: { id: privateAsset.id, sharing: "open" },
      },
    });
    expect(await isRegisteredLibraryAsset(ownerActor.creatorId, privateAsset.storageKey)).toBe(true);

    const missing = await storage.head(`${privateAsset.storageKey}.missing`);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");
  });

  it("aggregates browse use status across every live registration for a blob", async () => {
    const openRegistration = await upload(creatorIds[0]!, 62, "open");
    const requestableRegistration = await upload(creatorIds[1]!, 62, "requestable");
    expect(openRegistration.ok).toBe(true);
    expect(requestableRegistration.ok).toBe(true);
    if (!openRegistration.ok || !requestableRegistration.ok) return;

    expect(requestableRegistration.value.asset.storageKey).toBe(
      openRegistration.value.asset.storageKey,
    );

    const browsed = await listLibraryAssets(otherActor);
    expect(browsed.ok).toBe(true);
    if (!browsed.ok) return;
    const sharedBlobItems = browsed.value.items.filter(
      (item) => item.storageKey === openRegistration.value.asset.storageKey,
    );
    expect(sharedBlobItems).toHaveLength(2);
    expect(sharedBlobItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: openRegistration.value.asset.id, canUse: true, useStatus: "open" }),
        expect.objectContaining({ id: requestableRegistration.value.asset.id, canUse: true, useStatus: "open" }),
      ]),
    );
    expect(await getLibraryAsset(otherActor, requestableRegistration.value.asset.id)).toMatchObject({
      ok: true,
      value: { canUse: true, useStatus: "open" },
    });
  });

  it("does not let a non-owner manage another creator's grants", async () => {
    const uploaded = await upload(creatorIds[0]!, 60, "requestable");
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    const asset = uploaded.value.asset;

    expect(
      await grantLibraryAssetUse(
        ownerActor,
        asset.id,
        granteeActor.creatorId,
        grantorUserId,
      ),
    ).toEqual({ ok: true, value: undefined });
    expect(await canUseAsset(granteeActor, asset.storageKey)).toBe(true);

    const unauthorizedGrant = await grantLibraryAssetUse(
      granteeActor,
      asset.id,
      otherActor.creatorId,
      grantorUserId,
    );
    expect(unauthorizedGrant.ok).toBe(false);
    if (!unauthorizedGrant.ok) expect(unauthorizedGrant.error.code).toBe("NOT_FOUND");
    expect(await getLibraryAsset(ownerActor, asset.id)).toMatchObject({
      ok: true,
      value: { id: asset.id, sharing: "requestable" },
    });
    expect(await canUseAsset(granteeActor, asset.storageKey)).toBe(true);

    const unauthorizedRevoke = await revokeLibraryAssetUse(
      granteeActor,
      asset.id,
      granteeActor.creatorId,
    );
    expect(unauthorizedRevoke.ok).toBe(false);
    if (!unauthorizedRevoke.ok) expect(unauthorizedRevoke.error.code).toBe("NOT_FOUND");
    expect(await getLibraryAsset(ownerActor, asset.id)).toMatchObject({
      ok: true,
      value: { id: asset.id, sharing: "requestable" },
    });
    expect(await canUseAsset(granteeActor, asset.storageKey)).toBe(true);
  });

  it("rejects deleting another creator's registration without changing owner state", async () => {
    // Owner-scoped delete: a non-owner's update affects zero rows → must error,
    // and the owner's registration must be unchanged.
    const uploaded = await upload(creatorIds[0]!, 61, "requestable");
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    const asset = uploaded.value.asset;

    expect(await deleteLibraryAsset(granteeActor, asset.id)).toMatchObject({ ok: false });
    expect(await getLibraryAsset(ownerActor, asset.id)).toMatchObject({
      ok: true,
      value: { id: asset.id },
    });
  });

  it("does not skip rows when several assets share a millisecond timestamp", async () => {
    const uploads = await Promise.all([10, 11, 12].map((suffix) => upload(creatorIds[0]!, suffix)));
    expect(uploads.every((result) => result.ok)).toBe(true);
    const ids = uploads.flatMap((result) => (result.ok ? [result.value.asset.id] : []));
    expect(ids).toHaveLength(3);

    const boundary = new Date("2099-01-01T00:00:00.789Z");
    await db
      .update(contentAssets)
      .set({ createdAt: boundary })
      .where(inArray(contentAssets.id, ids));

    const seen: string[] = [];
    let before: { createdAt: Date; id: string } | undefined;
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
      const page = await listLibraryAssets(ownerActor, {
        limit: 1,
        ...(before ? { before } : {}),
      });
      expect(page.ok).toBe(true);
      if (!page.ok) return;
      expect(page.value.items).toHaveLength(1);
      const item = page.value.items[0]!;
      seen.push(item.id);
      expect(item.createdAt).toBe(boundary.toISOString());
      expect(page.value.nextCursor).not.toBeNull();
      const [createdAt, id] = page.value.nextCursor!.split("|");
      before = { createdAt: new Date(createdAt!), id: id! };
    }

    expect(new Set(seen)).toEqual(new Set(ids));
  });

  it("keeps global blob inventory after creator cascade deletion", async () => {
    const cascadeCreatorId = randomUUID();
    await db.insert(creatorProfiles).values({
      id: cascadeCreatorId,
      displayName: "Library cascade test",
    });
    const result = await upload(cascadeCreatorId, 50);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await db.delete(creatorProfiles).where(eq(creatorProfiles.id, cascadeCreatorId));
    const [registration] = await db
      .select({ id: contentAssets.id })
      .from(contentAssets)
      .where(eq(contentAssets.id, result.value.asset.id));
    expect(registration).toBeUndefined();
    const [inventory] = await db
      .select({ sha256: contentBlobs.sha256 })
      .from(contentBlobs)
      .where(eq(contentBlobs.sha256, result.value.asset.blobSha256));
    expect(inventory).toEqual({ sha256: result.value.asset.blobSha256 });
  });

  it("keeps blob inventory when registration insertion fails after upload", async () => {
    const bytes = imageBytes(99);
    const result = await uploadLibraryAsset(randomUUID(), {
      name: "orphan-regression.png",
      declaredType: "image/png",
      size: bytes.byteLength,
      bytes,
    });
    expect(result.ok).toBe(false);

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const [inventory] = await db
      .select()
      .from(contentBlobs)
      .where(eq(contentBlobs.sha256, sha256));
    expect(inventory).toBeDefined();
    if (!inventory) return;
    uploadedKeys.add(inventory.storageKey);
    blobHashes.add(inventory.sha256);
    expect(await storage.head(inventory.storageKey)).toMatchObject({ ok: true });

    const registrations = await db
      .select({ id: contentAssets.id })
      .from(contentAssets)
      .where(eq(contentAssets.blobSha256, inventory.sha256));
    expect(registrations).toHaveLength(0);
  });
});
