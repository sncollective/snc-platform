import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { PressContent } from "@snc/shared";

import { db, sql } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { publishPressConfig, upsertPressConfig } from "../services/press.js";

if (process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("Error: set ALLOW_DEMO_SEED=true to run the press seed.");
  process.exit(1);
}

const ANIMAL_FUTURE_PRESS_CONTENT: PressContent = {
  enabled: true,
  template: "A",
  tagline: "New single “This Hell” out Sep 17, 2026 · debut LP “Survived By” in 2027",
  members: [
    { name: "LeAnna Warren", role: "vocals, electric guitar", bio: "Playful command of unapologetic lyrics and soaring melodies." },
    { name: "Charles Tyrie", role: "drums", bio: "Bringing a technical backbone energized by punk chops." },
    { name: "Jarod Ford", role: "bass", bio: "Muscling low-end beneath the fury." },
    { name: "Connor Mandli", role: "electric guitar", bio: "Taming the dissonance via creative expressions and tones." },
  ],
  gallery: [],
  shortBio:
    "Socially conscious rock from Fort Collins, Colorado. Raw, funny, unpredictable, and aimed where it hurts.",
  longBio:
    "Fueled by the fury of the forgotten, Animal Future crafts music tackling mental health, addiction, and the dehumanizing weight of a corporate-run world. Their sound runs from indie rock to grungy pop and old-school punk, with eclectic, shoegazing soundscapes evoking a distorted sense of time and place.\n\nFronted by a female vocalist who swings from Paramore-level belting to unapologetic screams, the four-piece draws comparisons to Modest Mouse, Pixies, and Yeah Yeah Yeahs — sharp humor and electric energy that turn every show into a rallying cry for individuality and compassion, for people and the planet.",
  forFansOf: [
    "IDLES",
    "Radiohead",
    "Modest Mouse",
    "Pixies",
    "Yeah Yeah Yeahs",
    "Paramore",
  ],
  streamingLinks: [
    {
      service: "spotify",
      label: "Spotify",
      url: "https://open.spotify.com/artist/3Z65vDspGDjgs9MZzSrEOI",
    },
    {
      service: "apple-music",
      label: "Apple Music",
      url: "https://music.apple.com/us/artist/animal-future/1787816020",
    },
    {
      service: "amazon-music",
      label: "Amazon Music",
      url: "https://music.amazon.com/artists/B092X9HWDY/animal-future",
    },
    { service: "youtube", label: "YouTube", url: "https://www.youtube.com/@animalfuture" },
    { service: "bandcamp", label: "Bandcamp", url: "https://animalfuture.bandcamp.com/" },
  ],
  liveDatesUrl: "https://www.bandsintown.com/a/15532000-animal-future",
  standoutTrack: {
    title: "Get to You",
    url: "https://open.spotify.com/track/2WKznD3Xx28IGcqwEjytWS",
    streamsLabel: "14k Spotify Listens",
  },
  pressContactEmail: "press@s-nc.org",
  photographyCredits: "Hayley Herriges · Ariana Cord",
  // pressQuotes: WITHDRAWN 2026-09-02 — the FoCoMA "quote" derives from the
  // band's own bio (Spotify carries the original close; FoCoMA runs an edited
  // variant). Band-authored copy does not attribute as outlet praise. Slot
  // stays empty until REAL press lands (Westword, radio support, etc.).
  pressQuotes: [],

  bookingContactEmail: "booking@s-nc.org",
  location: "Fort Collins, CO",
  photos: [],
  highlights: [
    {
      eyebrow: "Out now",
      title: "The Illusionist",
      description:
        "First single from the debut LP Survived By — released Aug 6, 2026.",
    },
    {
      eyebrow: "Standout track",
      title: "Get to You",
      metric: "14k Spotify Listens",
      url: "https://open.spotify.com/track/2WKznD3Xx28IGcqwEjytWS",
    },
    {
      eyebrow: "Next single",
      title: "This Hell",
      description: "Out Sep 17, 2026 — second single from Survived By.",
    },
  ],
  releases: [
    {
      slug: "the-illusionist",
      title: "The Illusionist",
      catalogNumber: "SNCR-001",
      releaseDate: "2026-08-06",
      format: "digital single",
      genre: "Punk / alt-rock",
      isrc: "QT6FJ2619285",
      upc: "882204181149",
      duration: "1:19",
      personnel: [
        "LeAnna Warren (vocals, electric guitar)",
        "Charles Tyrie (drums)",
        "Jarod Ford (bass)",
        "Connor Mandli (electric guitar)",
      ],
      writtenBy: "Warren / Tyrie / Ford",
      producedBy: "Kevin Cook & Doug Wooldridge",
      mixedMasteredBy: "Doug Wooldridge @ S/NC Studio",
      copyrightLine: "℗ 2026 S/NC Records · © 2026 Warren, Tyrie, Ford",
      publisherLine: "S/NC Publishing",
      label: "S/NC Records",
      fcc: "clean",
      artKey: null,
      lyricPulls: [],
      photos: [],
    },
    {
      slug: "this-hell",
      title: "This Hell",
      catalogNumber: null,
      releaseDate: "2026-09-17",
      format: "digital single",
      genre: "Alternative / Indie / Rock",
      isrc: "QT6HP2698604",
      upc: "701546909511",
      duration: "3:33",
      personnel: [
        "LeAnna Warren (vocals & guitar)",
        "Charles Tyrie (drums)",
        "Jarod Ford (bass)",
        "Connor Mandli (guitar)",
      ],
      writtenBy: "Warren / Tyrie / Ford / Mandli",
      producedBy: "Kevin Cook & Doug Wooldridge",
      mixedMasteredBy: "Doug Wooldridge @ S/NC Studio",
      copyrightLine: "℗ 2026 S/NC Records · © 2026 Warren, Tyrie, Ford, Mandli",
      publisherLine: "S/NC Publishing",
      label: "S/NC Records",
      fcc: "clean",
      // No album art on the single EPK per operator (2026-09-02) — artKey stays
      // null; hero is the long-exposure ShowAbstract1 (photos[0]).
      artKey: null,
      story:
        "Or have we? This indie alternative track rides heavy, resonant bass with powerful vocals that journey between angsty grit and aching tenderness. “This Hell” conveys the turmoil of a mind that feels lost and small in an ever expanding universe. Prepare to unlock layers of introspection and lean into the emotional madness of being human. This song will be featured on Animal Future’s debut album “Survived By” in 2027, and releases on streaming platforms September 17, 2026.",
      lyricPulls: [
        "It’s a wonder we haven’t all gone insane",
      ],
      photos: [
        { key: "creators/375328a0-b99f-4961-80c5-65f8140cf35b/press/this-hell-hero-v01.jpg", alt: "Guitarist dissolving into pink stage-light trails during a long-exposure live shot", crop: { x: 0, y: 0, width: 1, height: 0.78 } },
      ],
      preSaveUrl: null,
    },
  ],
};

// Per operator 2026-09-02 (corrected): Hayley Herriges shot both non-Ariana
// shoots (mural/mirror session + solo LeAnna live); Ariana Cord shot exactly
// {LeAnnaVert1 rail, LeAnna1 member, LeAnnaJarodShow1 duo}. Daniel Melchior is
// on NONE of this set — the Spotify-profile credit does not apply here.
const PHOTOGRAPHER_PRIMARY = "Hayley Herriges";

const withPressImages = (creatorId: string): PressContent => {
  const key = (suffix: string) => `creators/${creatorId}/press/${suffix}`;
  // Square member crops: portrait sources render top-anchored by default;
  // explicit crop rects steer the 1:1 window (normalized, full width).
  const memberPhoto = (suffix: string, alt: string, crop?: { x: number; y: number; width: number; height: number }, credit?: string) =>
    ({ key: key(suffix), alt, ...(crop ? { crop } : {}), ...(credit ? { credit } : {}) });
  const cover = (suffix: string, alt: string) => ({ key: key(suffix), alt });
  return {
    ...ANIMAL_FUTURE_PRESS_CONTENT,
    banner: { key: key("banner-v01.jpg"), alt: "Animal Future reflected together in a vehicle side mirror", credit: PHOTOGRAPHER_PRIMARY },
    aboutPhoto: { key: key("about-v01.jpg"), alt: "LeAnna Warren mid-vocal at a live show", credit: "Ariana Cord" },
    members: ANIMAL_FUTURE_PRESS_CONTENT.members.map((member) => ({
      ...member,
      // All three per operator round 2/3: heads were being cut — window
      // moves UP. Connor top-anchored y=0; LeAnna/Charles y=0.05 (small
      // forehead room). Jarod: default (fine).
      photo: member.name === "LeAnna Warren"
        ? memberPhoto("member-leanna-v01.jpg", "LeAnna Warren portrait", { x: 0, y: 0.05, width: 1, height: 0.741 })
        : member.name === "Charles Tyrie"
          ? memberPhoto("member-charles-v01.jpg", "Charles Tyrie portrait", { x: 0, y: 0.05, width: 1, height: 0.741 })
          : member.name === "Jarod Ford"
            ? memberPhoto("member-jarod-v01.jpg", "Jarod Ford portrait", undefined)
            : memberPhoto("member-connor-v01.jpg", "Connor Mandli portrait", { x: 0, y: 0, width: 1, height: 0.741 }),
    })),
    highlights: ANIMAL_FUTURE_PRESS_CONTENT.highlights.map((highlight) => ({
      ...highlight,
      coverArt: highlight.title === "The Illusionist"
        ? cover("this-hell-cover-v01.jpg", "The Illusionist single artwork (album cover art)")
        : highlight.title === "Get to You"
          ? cover("cover-get-to-you-v01.jpg", "Get to You single artwork")
          : highlight.title === "This Hell"
            ? cover("this-hell-cover-v01.jpg", "This Hell single artwork (album cover art)")
            : highlight.coverArt,
    })),
    gallery: [
      { key: key("gallery-fullband-v01.jpg"), alt: "Animal Future together against a mural", credit: PHOTOGRAPHER_PRIMARY },
      { key: key("gallery-leanna-show-v01.jpg"), alt: "LeAnna Warren performing live", credit: "Hayley Herriges" },
      { key: key("gallery-jarod-connor-v01.jpg"), alt: "Jarod Ford jumping over Connor Mandli", credit: PHOTOGRAPHER_PRIMARY },
      { key: key("gallery-duo-show-v01.jpg"), alt: "Jarod Ford and LeAnna Warren performing live", credit: "Ariana Cord" },
    ],
  };
};

try {
  const [existingProfile] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.handle, "animalfuture"))
    .limit(1);

  let creatorId = existingProfile?.id;
  let createdLocalProfile = false;

  if (!creatorId) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Error: Animal Future creator (handle: animalfuture) does not exist in production.",
      );
      process.exitCode = 1;
    } else {
      creatorId = randomUUID();
      await db.insert(creatorProfiles).values({
        id: creatorId,
        displayName: "Animal Future",
        handle: "animalfuture",
        status: "active",
        socialLinks: [],
      });
      createdLocalProfile = true;
    }
  }

  if (creatorId) {
    const withImages = withPressImages(creatorId);
    // artKey injection REMOVED 2026-09-02: operator dropped album art from
    // the single EPK — the this-hell row's artKey:null is now authoritative
    // (the old force-inject was overriding it every seed run).
    const draftResult = await upsertPressConfig(creatorId, {
      ...withImages,
    });
    if (!draftResult.ok) {
      console.error(`Error: ${draftResult.error.message}`);
      process.exitCode = 1;
    } else {
      const result = await publishPressConfig(creatorId);
      if (!result.ok) {
        console.error(`Error: ${result.error.message}`);
        process.exitCode = 1;
      } else {
        console.log(
          `${createdLocalProfile ? "Created local Animal Future profile and seeded" : "Seeded"} press config for animalfuture (${creatorId}).`,
        );
      }
    }
  }
} catch (error) {
  console.error("Error seeding Animal Future press config:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
