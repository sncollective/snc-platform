import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { PressContent } from "@snc/shared";

import { db, sql } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { upsertPressConfig } from "../services/press.js";

if (process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("Error: set ALLOW_DEMO_SEED=true to run the press seed.");
  process.exit(1);
}

const ANIMAL_FUTURE_PRESS_CONTENT: PressContent = {
  enabled: true,
  template: "A",
  members: [],
  highlights: [],
  gallery: [],
  shortBio:
    "Fort Collins band Animal Future makes socially conscious punk-leaning rock that hits where it hurts — mental health, addiction, and life under a corporate-run world. Raw, funny, and unpredictable, fronted by a female vocalist who swings from Paramore-power belting to unapologetic screams. For fans of IDLES, Modest Mouse, and Pixies.",
  longBio:
    "Fueled by the fury of the forgotten, Fort Collins, Colorado–based Animal Future crafts music that hits where it hurts—tackling mental health, addiction, and the dehumanizing weight of a corporate-run world. With raw energy and socially conscious grit reminiscent of IDLES, their sound moves from indie rock to grungy pop and old-school punk, with Radiohead-esque soundscapes adding a layer of unpredictability. Think Modest Mouse, Pixies, and Yeah Yeah Yeahs, with a female vocalist who can belt Paramore-level power or let loose raw, unapologetic screams that'll keep you guessing. Known for their sharp humor and electric energy, they create a space for connection that turns every show into a rallying cry for individuality and compassion—for people and the planet.",
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
    streamsLabel: "~14.5k and climbing",
  },
  pressContactEmail: "press@s-nc.org",
  location: "Fort Collins, CO",
  photos: [],
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
    },
  ],
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
    const result = await upsertPressConfig(creatorId, ANIMAL_FUTURE_PRESS_CONTENT);
    if (!result.ok) {
      console.error(`Error: ${result.error.message}`);
      process.exitCode = 1;
    } else {
      console.log(
        `${createdLocalProfile ? "Created local Animal Future profile and seeded" : "Seeded"} press config for animalfuture (${creatorId}).`,
      );
    }
  }
} catch (error) {
  console.error("Error seeding Animal Future press config:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
