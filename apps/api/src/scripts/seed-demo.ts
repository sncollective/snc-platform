import node_path from "node:path";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── Production Guard ──

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_DEMO_SEED !== "true"
) {
  console.error(
    "Error: seed-demo.ts cannot run in production. Set ALLOW_DEMO_SEED=true to override.",
  );
  process.exit(1);
}

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { hashPassword } from "better-auth/crypto";

import type { ContentType, SocialLink, Visibility } from "@snc/shared";

import { users, accounts, userRoles } from "../db/schema/user.schema.js";
import { creatorProfiles, creatorMembers } from "../db/schema/creator.schema.js";
import { content } from "../db/schema/content.schema.js";
import { subscriptionPlans } from "../db/schema/subscription.schema.js";
import { services, bookingRequests } from "../db/schema/booking.schema.js";
import { emissions } from "../db/schema/emission.schema.js";

// ── Image download helper ──

const UPLOADS_DIR = node_path.resolve(
  import.meta.dirname ?? ".",
  "../../uploads",
);

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const downloadImage = async (
  picsumId: number,
  width: number,
  height: number,
  storageKey: string,
): Promise<void> => {
  const filePath = node_path.join(UPLOADS_DIR, storageKey);
  if (await fileExists(filePath)) return;

  const url = `https://picsum.photos/id/${picsumId}/${width}/${height}.jpg`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${url} (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(node_path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
};

const SEED_ASSETS_DIR = node_path.resolve(
  import.meta.dirname ?? ".",
  "./assets",
);

const copyAsset = async (
  assetName: string,
  storageKey: string,
): Promise<void> => {
  const dest = node_path.join(UPLOADS_DIR, storageKey);
  if (await fileExists(dest)) return;

  const src = node_path.join(SEED_ASSETS_DIR, assetName);
  await mkdir(node_path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
};

// ── Audio generation helper ──

const generateWav = (frequency: number, durationSec: number): Buffer => {
  const sampleRate = 44100;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2; // 16-bit mono
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);

  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write("WAVE", 8);

  // fmt chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  const fadeInSamples = Math.floor(sampleRate * 0.1);
  const fadeOutSamples = Math.floor(sampleRate * 0.5);
  const fadeOutStart = numSamples - fadeOutSamples;

  for (let i = 0; i < numSamples; i++) {
    let amplitude = 0.3;
    if (i < fadeInSamples) {
      amplitude *= i / fadeInSamples;
    } else if (i >= fadeOutStart) {
      amplitude *= (numSamples - i) / fadeOutSamples;
    }
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude;
    const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    buf.writeInt16LE(int16, 44 + i * 2);
  }

  return buf;
};

// ── Video generation helpers ──

const isFfmpegAvailable = async (): Promise<boolean> => {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
};

const generateVideo = async (
  color: string,
  durationSec: number,
  label: string,
  outputPath: string,
): Promise<void> => {
  await mkdir(node_path.dirname(outputPath), { recursive: true });
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${color}:s=640x360:d=${durationSec}`,
    "-vf", `drawtext=text='${label}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "28",
    "-movflags", "+faststart",
    "-pix_fmt", "yuv420p",
    outputPath,
  ], { timeout: 60_000 });
};

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error("Error: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = postgres(databaseUrl);
const db = drizzle(sql);

const now = new Date();

// ── Deterministic IDs ──

const USER_IDS = {
  alex: "seed_user_alex",
  maya: "seed_user_maya",
  jordan: "seed_user_jordan",
  sam: "seed_user_sam",
  pat: "seed_user_pat",
  animalfuture: "animalfuture",
} as const;

try {
  console.log("Seeding demo data...\n");

  // ── Hash shared password ──

  const passwordHash = await hashPassword("password123");

  // ── Users ──

  const userRows = [
    { id: USER_IDS.alex, name: "Alex Rivera", email: "admin@snc.demo" },
    { id: USER_IDS.maya, name: "Maya Chen", email: "maya@snc.demo" },
    { id: USER_IDS.jordan, name: "Jordan Ellis", email: "jordan@snc.demo" },
    { id: USER_IDS.sam, name: "Sam Okafor", email: "sam@snc.demo" },
    { id: USER_IDS.pat, name: "Pat Morgan", email: "pat@snc.demo" },
    { id: USER_IDS.animalfuture, name: "Animal Future", email: "animalfuture@snc.demo" },
  ];

  for (const u of userRows) {
    await db
      .insert(users)
      .values({
        ...u,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { name: u.name, email: u.email, updatedAt: now },
      });
  }

  console.log(`  Users: ${userRows.length} seeded`);

  // ── Accounts (credential provider for login) ──

  const accountRows = userRows.map((u) => ({
    id: `seed_account_${u.id}`,
    userId: u.id,
    accountId: u.id,
    providerId: "credential",
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  }));

  for (const a of accountRows) {
    await db
      .insert(accounts)
      .values(a)
      .onConflictDoUpdate({
        target: accounts.id,
        set: { password: a.password, updatedAt: now },
      });
  }

  console.log(`  Accounts: ${accountRows.length} seeded`);

  // ── User Roles ──

  const roleRows = [
    { userId: USER_IDS.alex, role: "admin" },
    { userId: USER_IDS.alex, role: "stakeholder" },
    { userId: USER_IDS.maya, role: "stakeholder" },
  ];

  for (const r of roleRows) {
    await db
      .insert(userRoles)
      .values(r)
      .onConflictDoNothing();
  }

  console.log(`  Roles: ${roleRows.length} seeded`);

  // ── Creator Profiles ──

  const creatorRows: Array<{ id: string; displayName: string; bio: string; socialLinks: SocialLink[]; avatarKey: string; bannerKey: string }> = [
    {
      id: USER_IDS.maya,
      displayName: "Maya Chen",
      bio: "Electronic and ambient music producer exploring the intersection of sound design and generative art. Co-op member since day one.",
      socialLinks: [
        { platform: "bandcamp", url: "https://mayachen.bandcamp.com" },
        { platform: "spotify", url: "https://open.spotify.com/artist/mayachen" },
        { platform: "instagram", url: "https://www.instagram.com/mayachen" },
      ],
      avatarKey: `creators/${USER_IDS.maya}/avatar/photo.jpg`,
      bannerKey: `creators/${USER_IDS.maya}/banner/photo.jpg`,
    },
    {
      id: USER_IDS.jordan,
      displayName: "Jordan Ellis",
      bio: "Indie rock songwriter and multi-instrumentalist. Writing honest songs about ordinary life.",
      socialLinks: [
        { platform: "youtube", url: "https://www.youtube.com/@jordanellis" },
        { platform: "twitter", url: "https://x.com/jordanellis" },
      ],
      avatarKey: `creators/${USER_IDS.jordan}/avatar/photo.jpg`,
      bannerKey: `creators/${USER_IDS.jordan}/banner/photo.jpg`,
    },
    {
      id: USER_IDS.sam,
      displayName: "Sam Okafor",
      bio: "Hip-hop artist and spoken word poet. Using rhythm and language to tell stories that matter.",
      socialLinks: [
        { platform: "soundcloud", url: "https://soundcloud.com/samokafor" },
        { platform: "website", url: "https://samokafor.com" },
      ],
      avatarKey: `creators/${USER_IDS.sam}/avatar/photo.jpg`,
      bannerKey: `creators/${USER_IDS.sam}/banner/photo.jpg`,
    },
    {
      id: USER_IDS.animalfuture,
      displayName: "Animal Future",
      bio: "Punk rock and raw energy. Making loud, honest music about the world we're stuck in.",
      socialLinks: [
        { platform: "bandcamp", url: "https://animalfuture.bandcamp.com" },
        { platform: "spotify", url: "https://open.spotify.com/artist/3Z65vDspGDjgs9MZzSrEOI?si=jkaH3Qd2T7udoDPwfUvzVw" },
        { platform: "instagram", url: "https://www.instagram.com/animalfuturemusic" },
      ],
      avatarKey: `creators/${USER_IDS.animalfuture}/avatar/photo.jpg`,
      bannerKey: `creators/${USER_IDS.animalfuture}/banner/photo.jpg`,
    },
  ];

  for (const row of creatorRows) {
    await db
      .insert(creatorProfiles)
      .values(row)
      .onConflictDoUpdate({
        target: creatorProfiles.id,
        set: {
          displayName: row.displayName,
          bio: row.bio,
          socialLinks: row.socialLinks,
          avatarKey: row.avatarKey,
          bannerKey: row.bannerKey,
          updatedAt: now,
        },
      });
  }

  console.log(`  Creator profiles: ${creatorRows.length} seeded`);

  // ── Creator Members (seed owner rows) ──

  for (const row of creatorRows) {
    await db
      .insert(creatorMembers)
      .values({
        creatorId: row.id,
        userId: row.id,
        role: "owner",
      })
      .onConflictDoNothing();
  }

  console.log(`  Creator members: ${creatorRows.length} owner rows seeded`);

  // ── Content ──

  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  const contentRows: Array<{
    id: string;
    creatorId: string;
    type: ContentType;
    title: string;
    description: string;
    visibility: Visibility;
    publishedAt: Date;
    coverArtKey?: string;
    mediaKey?: string;
    thumbnailKey?: string;
    body?: string;
  }> = [
    // Maya — audio
    {
      id: "seed_content_01",
      creatorId: USER_IDS.maya,
      type: "audio",
      title: "Midnight Frequencies",
      description: "A late-night ambient session recorded live in one take.",
      visibility: "public",
      publishedAt: daysAgo(90),
      coverArtKey: "content/seed_content_01/cover-art/cover.jpg",
      mediaKey: "content/seed_content_01/media/midnight-frequencies.wav",
    },
    {
      id: "seed_content_02",
      creatorId: USER_IDS.maya,
      type: "audio",
      title: "Synthesis Lab — Episode 3",
      description: "Exploring granular synthesis techniques with modular gear.",
      visibility: "subscribers",
      publishedAt: daysAgo(60),
      coverArtKey: "content/seed_content_02/cover-art/cover.jpg",
      mediaKey: "content/seed_content_02/media/synthesis-lab-ep3.wav",
    },
    {
      id: "seed_content_03",
      creatorId: USER_IDS.maya,
      type: "video",
      title: "Studio Tour 2026",
      description: "Walk through my updated home studio setup.",
      visibility: "public",
      publishedAt: daysAgo(45),
      thumbnailKey: "content/seed_content_03/thumbnail/thumb.jpg",
      mediaKey: "content/seed_content_03/media/studio-tour.mp4",
    },
    {
      id: "seed_content_04",
      creatorId: USER_IDS.maya,
      type: "written",
      title: "On Co-ops and Creative Freedom",
      description: "Why I joined a platform cooperative.",
      body: "I spent years uploading music to platforms that treated me like a line item. The algorithm decided who heard my work, the payout was pennies, and I had zero say in how anything worked.\n\nWhen S/NC started forming, I was skeptical — another platform promising to be different. But the difference is structural: we actually own this thing. Decisions go through the members. Revenue splits are transparent. Nobody is optimizing for engagement metrics at the expense of the art.\n\nIt's not perfect. Building a co-op is slow, messy, and full of meetings. But I'd rather have a seat at the table than be product on someone else's.",
      visibility: "public",
      publishedAt: daysAgo(20),
      thumbnailKey: "content/seed_content_04/thumbnail/thumb.jpg",
    },
    // Jordan — audio/video
    {
      id: "seed_content_05",
      creatorId: USER_IDS.jordan,
      type: "audio",
      title: "Backyard Demo — Unfinished",
      description: "Raw demo recorded on a four-track in the backyard.",
      visibility: "public",
      publishedAt: daysAgo(85),
      coverArtKey: "content/seed_content_05/cover-art/cover.jpg",
      mediaKey: "content/seed_content_05/media/backyard-demo.wav",
    },
    {
      id: "seed_content_06",
      creatorId: USER_IDS.jordan,
      type: "audio",
      title: "Kitchen Floor (Single)",
      description: "New single from the upcoming album.",
      visibility: "subscribers",
      publishedAt: daysAgo(40),
      coverArtKey: "content/seed_content_06/cover-art/cover.jpg",
      mediaKey: "content/seed_content_06/media/kitchen-floor.wav",
    },
    {
      id: "seed_content_07",
      creatorId: USER_IDS.jordan,
      type: "video",
      title: "Live at The Basement — Full Set",
      description: "Full 45-minute set from last month's show at The Basement.",
      visibility: "public",
      publishedAt: daysAgo(15),
      thumbnailKey: "content/seed_content_07/thumbnail/thumb.jpg",
      mediaKey: "content/seed_content_07/media/live-basement.mp4",
    },
    {
      id: "seed_content_08",
      creatorId: USER_IDS.jordan,
      type: "written",
      title: "Gear Rundown: What I Actually Use",
      description: "Honest breakdown of my recording setup — no sponsorships.",
      body: "People ask about my gear a lot, so here it is. Nothing fancy.\n\nGuitar: 2004 Fender Telecaster, sunburst. Bought it used for $600. It does everything I need.\n\nAmp: Fender Blues Junior. Small, loud enough for clubs, takes pedals well.\n\nRecording: Focusrite Scarlett 2i2 into Reaper. I tried the expensive DAWs but Reaper does what I need for $60.\n\nMics: SM57 on the amp, AT2020 for vocals. That's it.\n\nThe point is: you don't need much. Write good songs, record them honestly, and move on.",
      visibility: "public",
      publishedAt: daysAgo(5),
      thumbnailKey: "content/seed_content_08/thumbnail/thumb.jpg",
    },
    // Sam — audio/video/written
    {
      id: "seed_content_09",
      creatorId: USER_IDS.sam,
      type: "audio",
      title: "Concrete Hymns",
      description: "Spoken word piece over lo-fi beats about city life.",
      visibility: "public",
      publishedAt: daysAgo(70),
      coverArtKey: "content/seed_content_09/cover-art/cover.jpg",
      mediaKey: "content/seed_content_09/media/concrete-hymns.wav",
    },
    {
      id: "seed_content_10",
      creatorId: USER_IDS.sam,
      type: "video",
      title: "Open Mic Night Highlights",
      description: "Best moments from the monthly open mic I host downtown.",
      visibility: "public",
      publishedAt: daysAgo(30),
      thumbnailKey: "content/seed_content_10/thumbnail/thumb.jpg",
      mediaKey: "content/seed_content_10/media/open-mic.mp4",
    },
    {
      id: "seed_content_11",
      creatorId: USER_IDS.sam,
      type: "written",
      title: "Writing Process: From Freestyle to Final Draft",
      description: "How I develop ideas from improvisation to finished pieces.",
      body: "Every piece starts as a freestyle. I record myself riffing on a theme — sometimes in the car, sometimes walking around. Most of it is garbage. But there's usually one line, one image, one rhythm that sticks.\n\nI pull that thread. Write it out longhand, no editing. Then I read it aloud and cut everything that doesn't earn its place. If a line is there because it sounds clever but doesn't serve the piece, it goes.\n\nThe beat comes last. I find something that matches the energy of the words, not the other way around. The words lead.",
      visibility: "subscribers",
      publishedAt: daysAgo(10),
      thumbnailKey: "content/seed_content_11/thumbnail/thumb.jpg",
    },
    {
      id: "seed_content_12",
      creatorId: USER_IDS.sam,
      type: "audio",
      title: "Brick by Brick (feat. Local Voices)",
      description: "Collaborative track featuring spoken word from community members.",
      visibility: "public",
      publishedAt: daysAgo(3),
      coverArtKey: "content/seed_content_12/cover-art/cover.jpg",
      mediaKey: "content/seed_content_12/media/brick-by-brick.wav",
    },
  ];

  for (const c of contentRows) {
    await db
      .insert(content)
      .values({
        ...c,
        createdAt: c.publishedAt ?? now,
        updatedAt: c.publishedAt ?? now,
      })
      .onConflictDoUpdate({
        target: content.id,
        set: {
          title: c.title,
          description: c.description,
          body: c.body ?? null,
          visibility: c.visibility,
          thumbnailKey: c.thumbnailKey ?? null,
          coverArtKey: c.coverArtKey ?? null,
          mediaKey: c.mediaKey ?? null,
          updatedAt: now,
        },
      });
  }

  console.log(`  Content: ${contentRows.length} seeded`);

  // ── Subscription Plans ──

  const planRows = [
    {
      id: "seed_plan_platform_monthly",
      name: "S/NC Monthly",
      type: "platform",
      stripePriceId: "price_seed_platform_monthly",
      price: 999,
      interval: "month",
    },
    {
      id: "seed_plan_platform_yearly",
      name: "S/NC Yearly",
      type: "platform",
      stripePriceId: "price_seed_platform_yearly",
      price: 8999,
      interval: "year",
    },
    {
      id: "seed_plan_maya_monthly",
      name: "Maya Chen Monthly",
      type: "creator",
      creatorId: USER_IDS.maya,
      stripePriceId: "price_seed_maya_monthly",
      price: 499,
      interval: "month",
    },
    {
      id: "seed_plan_jordan_monthly",
      name: "Jordan Ellis Monthly",
      type: "creator",
      creatorId: USER_IDS.jordan,
      stripePriceId: "price_seed_jordan_monthly",
      price: 599,
      interval: "month",
    },
  ];

  for (const p of planRows) {
    await db
      .insert(subscriptionPlans)
      .values(p)
      .onConflictDoUpdate({
        target: subscriptionPlans.id,
        set: { name: p.name, price: p.price, interval: p.interval, updatedAt: now },
      });
  }

  console.log(`  Subscription plans: ${planRows.length} seeded`);

  // ── Services ──

  const serviceRows = [
    {
      id: "seed_service_recording",
      name: "Recording Session",
      description:
        "Professional recording in our studio space. Includes engineer, microphones, and basic mixing. Bring your instruments and ideas.",
      pricingInfo: "$50/hour — 2 hour minimum",
      sortOrder: 1,
    },
    {
      id: "seed_service_mixing",
      name: "Mixing",
      description:
        "Full mix of your recorded tracks. We balance levels, EQ, compression, and effects to make your recording sound polished and cohesive.",
      pricingInfo: "$200–$400 per song depending on track count",
      sortOrder: 2,
    },
    {
      id: "seed_service_mastering",
      name: "Mastering",
      description:
        "Final mastering for digital and physical release. Loudness optimization, stereo enhancement, and format delivery.",
      pricingInfo: "$75 per track — album rates available",
      sortOrder: 3,
    },
    {
      id: "seed_service_video",
      name: "Video Production",
      description:
        "Music videos, live session recordings, and promotional content. Includes filming, editing, and color grading.",
      pricingInfo: "Starting at $500 — scope dependent",
      sortOrder: 4,
    },
    {
      id: "seed_service_podcast",
      name: "Podcast Production",
      description:
        "End-to-end podcast production: recording, editing, mixing, and publishing. Studio space and equipment provided.",
      pricingInfo: "$150 per episode",
      sortOrder: 5,
    },
  ];

  for (const s of serviceRows) {
    await db
      .insert(services)
      .values(s)
      .onConflictDoUpdate({
        target: services.id,
        set: { name: s.name, description: s.description, pricingInfo: s.pricingInfo, sortOrder: s.sortOrder, updatedAt: now },
      });
  }

  console.log(`  Services: ${serviceRows.length} seeded`);

  // ── Booking Requests ──

  const bookingRows = [
    {
      id: "seed_booking_01",
      userId: USER_IDS.maya,
      serviceId: "seed_service_recording",
      preferredDates: ["2026-03-15", "2026-03-16"],
      notes: "Need to record vocals and synth for 4 tracks. Bringing my own controller.",
      status: "approved",
      reviewedBy: USER_IDS.alex,
      reviewNote: "Confirmed — Studio A is available both days.",
    },
    {
      id: "seed_booking_02",
      userId: USER_IDS.jordan,
      serviceId: "seed_service_video",
      preferredDates: ["2026-03-20"],
      notes: "Live session video for the new single. Acoustic setup, minimal production.",
      status: "pending",
    },
    {
      id: "seed_booking_03",
      userId: USER_IDS.sam,
      serviceId: "seed_service_podcast",
      preferredDates: ["2026-03-10", "2026-03-12", "2026-03-14"],
      notes: "Interview series — 3 episodes with local artists. Need studio and 2 mics.",
      status: "pending",
    },
    {
      id: "seed_booking_04",
      userId: USER_IDS.pat,
      serviceId: "seed_service_recording",
      preferredDates: ["2026-04-01"],
      notes: "First time recording. Just want to lay down a few guitar tracks to see how it goes.",
      status: "denied",
      reviewedBy: USER_IDS.alex,
      reviewNote: "Studio is fully booked in April. Suggested May dates via email.",
    },
  ];

  for (const b of bookingRows) {
    await db
      .insert(bookingRequests)
      .values({
        ...b,
        createdAt: daysAgo(7),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: bookingRequests.id,
        set: { notes: b.notes, status: b.status, reviewedBy: b.reviewedBy ?? null, reviewNote: b.reviewNote ?? null, updatedAt: now },
      });
  }

  console.log(`  Booking requests: ${bookingRows.length} seeded`);

  // ── Download images from picsum.photos ──
  // Uses deterministic image IDs so every seed run gets the same photos.
  // Skips files that already exist on disk.

  console.log("\n  Downloading images (skipping existing)...");

  // Picsum photo IDs chosen for visual variety — landscapes, textures, portraits
  const IMAGE_DOWNLOADS: Array<{
    picsumId: number;
    width: number;
    height: number;
    key: string;
  }> = [
    // Creator avatars (square, 400x400)
    { picsumId: 64, width: 400, height: 400, key: creatorRows[0]!.avatarKey },
    { picsumId: 65, width: 400, height: 400, key: creatorRows[1]!.avatarKey },
    { picsumId: 91, width: 400, height: 400, key: creatorRows[2]!.avatarKey },
    // Creator banners (wide, 1200x400)
    { picsumId: 1036, width: 1200, height: 400, key: creatorRows[0]!.bannerKey },
    { picsumId: 1039, width: 1200, height: 400, key: creatorRows[1]!.bannerKey },
    { picsumId: 1042, width: 1200, height: 400, key: creatorRows[2]!.bannerKey },
    { picsumId: 1044, width: 1200, height: 400, key: creatorRows[3]!.bannerKey },
    // Content thumbnails/cover art (16:9 for thumbnails, square for cover art)
    { picsumId: 1062, width: 600, height: 600, key: "content/seed_content_01/cover-art/cover.jpg" },
    { picsumId: 1067, width: 600, height: 600, key: "content/seed_content_02/cover-art/cover.jpg" },
    { picsumId: 1069, width: 800, height: 450, key: "content/seed_content_03/thumbnail/thumb.jpg" },
    { picsumId: 1073, width: 800, height: 450, key: "content/seed_content_04/thumbnail/thumb.jpg" },
    { picsumId: 1074, width: 600, height: 600, key: "content/seed_content_05/cover-art/cover.jpg" },
    { picsumId: 1076, width: 600, height: 600, key: "content/seed_content_06/cover-art/cover.jpg" },
    { picsumId: 1080, width: 800, height: 450, key: "content/seed_content_07/thumbnail/thumb.jpg" },
    { picsumId: 1082, width: 800, height: 450, key: "content/seed_content_08/thumbnail/thumb.jpg" },
    { picsumId: 1083, width: 600, height: 600, key: "content/seed_content_09/cover-art/cover.jpg" },
    { picsumId: 1084, width: 800, height: 450, key: "content/seed_content_10/thumbnail/thumb.jpg" },
    { picsumId: 1057, width: 800, height: 450, key: "content/seed_content_11/thumbnail/thumb.jpg" },
    { picsumId: 1059, width: 600, height: 600, key: "content/seed_content_12/cover-art/cover.jpg" },
  ];

  let downloaded = 0;
  let skipped = 0;

  for (const img of IMAGE_DOWNLOADS) {
    const filePath = node_path.join(UPLOADS_DIR, img.key);
    if (await fileExists(filePath)) {
      skipped++;
      continue;
    }
    await downloadImage(img.picsumId, img.width, img.height, img.key);
    downloaded++;
  }

  console.log(
    `  Images: ${downloaded} downloaded, ${skipped} already existed`,
  );

  // ── Generate audio files ──

  console.log("\n  Generating audio files (skipping existing)...");

  const AUDIO_SPECS: Array<{
    key: string;
    frequency: number;
    duration: number;
  }> = [
    { key: "content/seed_content_01/media/midnight-frequencies.wav", frequency: 220, duration: 10 },
    { key: "content/seed_content_02/media/synthesis-lab-ep3.wav", frequency: 330, duration: 15 },
    { key: "content/seed_content_05/media/backyard-demo.wav", frequency: 196, duration: 8 },
    { key: "content/seed_content_06/media/kitchen-floor.wav", frequency: 261, duration: 12 },
    { key: "content/seed_content_09/media/concrete-hymns.wav", frequency: 174, duration: 10 },
    { key: "content/seed_content_12/media/brick-by-brick.wav", frequency: 293, duration: 15 },
  ];

  let audioGenerated = 0;
  let audioSkipped = 0;

  for (const spec of AUDIO_SPECS) {
    const filePath = node_path.join(UPLOADS_DIR, spec.key);
    if (await fileExists(filePath)) {
      audioSkipped++;
      continue;
    }
    const wavBuffer = generateWav(spec.frequency, spec.duration);
    await mkdir(node_path.dirname(filePath), { recursive: true });
    await writeFile(filePath, wavBuffer);
    audioGenerated++;
  }

  console.log(
    `  Audio: ${audioGenerated} generated, ${audioSkipped} already existed`,
  );

  // ── Generate video files (requires ffmpeg) ──

  const VIDEO_SPECS: Array<{
    key: string;
    color: string;
    duration: number;
    label: string;
  }> = [
    { key: "content/seed_content_03/media/studio-tour.mp4", color: "0x003366", duration: 10, label: "Studio Tour 2026" },
    { key: "content/seed_content_07/media/live-basement.mp4", color: "0x8B0000", duration: 8, label: "Live at The Basement" },
    { key: "content/seed_content_10/media/open-mic.mp4", color: "0x006400", duration: 12, label: "Open Mic Night" },
  ];

  if (await isFfmpegAvailable()) {
    console.log("\n  Generating video files (skipping existing)...");

    let videoGenerated = 0;
    let videoSkipped = 0;

    for (const spec of VIDEO_SPECS) {
      const filePath = node_path.join(UPLOADS_DIR, spec.key);
      if (await fileExists(filePath)) {
        videoSkipped++;
        continue;
      }
      await generateVideo(spec.color, spec.duration, spec.label, filePath);
      videoGenerated++;
    }

    console.log(
      `  Video: ${videoGenerated} generated, ${videoSkipped} already existed`,
    );
  } else {
    console.log("\n  Skipping video generation (ffmpeg not found)");
  }

  // ── Emissions ──

  const emissionRows = [
    // ── Actual Entries (Jan–Mar 2026) ──
    {
      id: "seed_emission_studio_jan",
      date: "2026-01-31",
      scope: 2,
      category: "facilities-electricity",
      subcategory: "recording-studio",
      source: "S/NC Recording Studio",
      description: "January 2026 recording studio — 50.0 active hours",
      amount: 50,
      unit: "active-hours",
      co2Kg: 83.38,
      method: "studio-hour-estimate",
      metadata: { profile: "heavy", activeHours: 50 },
    },
    {
      id: "seed_emission_studio_feb",
      date: "2026-02-28",
      scope: 2,
      category: "facilities-electricity",
      subcategory: "recording-studio",
      source: "S/NC Recording Studio",
      description: "February 2026 recording studio — 50.0 active hours",
      amount: 50,
      unit: "active-hours",
      co2Kg: 77.77,
      method: "studio-hour-estimate",
      metadata: { profile: "heavy", activeHours: 50 },
    },
    {
      id: "seed_emission_claude_feb",
      date: "2026-02-28",
      scope: 3,
      category: "cloud-compute",
      subcategory: "ai-development",
      source: "Claude Code (claude-opus-4-6, claude-sonnet-4-6)",
      description: "February 2026 Claude Code development usage",
      amount: 16447011,
      unit: "tokens",
      co2Kg: 0.412681,
      method: "token-type-estimate",
      metadata: { costUSD: 10.24 },
    },
    {
      id: "seed_emission_vinyl_pressing",
      date: "2026-03-01",
      scope: 3,
      category: "purchased-goods",
      subcategory: "vinyl-pressing",
      source:
        "AudioDrome Vinyl (Gainesville, FL) — bio-PVC, steamless, solar",
      description:
        'Animal Future LP — 100× 140g 12" bio-PVC records, biodegradable packaging, no shrink wrap',
      amount: 100,
      unit: "records",
      co2Kg: 82.2,
      method: "vinyl-lca-adjusted",
      metadata: {
        perRecordKg: 0.822,
        baselinePerRecordKg: 1.15,
        reductions: [
          "solar-100pct",
          "steamless-press",
          "no-shrink-wrap",
          "biodegradable-sleeve",
        ],
        notes:
          "Bio-PVC confirmed but per VRMA Report 2 / GHG Protocol, biogenic carbon removals are not subtracted. Compound footprint equals conventional PVC. Reduction is from solar energy only.",
        facility: "AudioDrome Vinyl",
        location: "Gainesville, FL",
        sourceReport:
          "VRMA/Vinyl Alliance Carbon Footprinting Reports (2024, 2025)",
      },
    },
    {
      id: "seed_emission_vinyl_shipping",
      date: "2026-03-01",
      scope: 3,
      category: "merchandise-shipping",
      subcategory: "ground-freight",
      source: "Ground freight — Florida to Colorado",
      description:
        "Animal Future LP — shipping 100 records (~14 kg), ~1,300 miles",
      amount: 1300,
      unit: "miles",
      co2Kg: 2.93,
      method: "epa-freight-factor",
      metadata: {
        weightKg: 14,
        distanceMiles: 1300,
        gCo2PerTonneMile: 161,
        origin: "Gainesville, FL",
        destination: "Colorado",
      },
    },
    {
      id: "seed_emission_claude_code",
      date: "2026-03-31",
      scope: 3,
      category: "cloud-compute",
      subcategory: "ai-development",
      source:
        "Claude Code (claude-opus-4-6, claude-haiku-4-5-20251001, claude-sonnet-4-6)",
      description: "March 2026 Claude Code development usage",
      amount: 81855125,
      unit: "tokens",
      co2Kg: 1.768509,
      method: "token-type-estimate",
      metadata: {
        inputTokens: 10669,
        outputTokens: 138810,
        cacheCreationTokens: 2794639,
        cacheReadTokens: 78911007,
        costUSD: 52.57,
        models: [
          "claude-opus-4-6",
          "claude-haiku-4-5-20251001",
          "claude-sonnet-4-6",
        ],
      },
    },
    {
      id: "seed_offset_pika_project",
      date: "2026-03-02",
      scope: 0,
      category: "offset",
      subcategory: "offset",
      source: "Colorado Pika Project",
      description:
        "Habitat conservation carbon offset — $100 donation (3.33 metric tons CO2)",
      amount: 3.33,
      unit: "tonnes",
      co2Kg: -3330,
      method: "verified-offset",
      metadata: {
        donationUSD: 100,
        partner: "Colorado Pika Project",
        type: "habitat-conservation",
      },
    },
  ];

  // ── Projected Entries (Apr–Dec 2026) ──
  // Basis: avg of Jan+Feb actuals for studio; 1-week actual (Feb+Mar) × 30/7 for AI; 256 kg/yr ÷ 12 for server

  const PROJECTED_MONTHS = ["04", "05", "06", "07", "08", "09", "10", "11", "12"];

  const projectedRows = PROJECTED_MONTHS.flatMap((mm) => [
    {
      id: `seed_projected_studio_${mm}`,
      date: `2026-${mm}-15`,
      scope: 2,
      category: "facilities-electricity",
      subcategory: "recording-studio",
      source: "S/NC Recording Studio",
      description: `${mm}/2026 recording studio (projected)`,
      amount: 50,
      unit: "active-hours",
      co2Kg: 80.58, // avg(83.38, 77.77)
      method: "studio-hour-estimate-projected",
      projected: true,
      metadata: { projectionBasis: "avg-jan-feb-2026" },
    },
    {
      id: `seed_projected_ai_${mm}`,
      date: `2026-${mm}-15`,
      scope: 3,
      category: "cloud-compute",
      subcategory: "ai-development",
      source: "Claude Code (projected)",
      description: `${mm}/2026 Claude Code usage (projected)`,
      amount: 421294869,
      unit: "tokens",
      co2Kg: 9.35, // 1-week actual (feb+mar) × 30/7
      method: "token-type-estimate-projected",
      projected: true,
      metadata: { projectionBasis: "1wk-avg-feb-mar-2026" },
    },
    {
      id: `seed_projected_server_${mm}`,
      date: `2026-${mm}-15`,
      scope: 2,
      category: "cloud-compute",
      subcategory: "server-hosting",
      source: "VPS hosting (projected)",
      description: `${mm}/2026 server hosting (projected)`,
      amount: 1,
      unit: "month",
      co2Kg: 21.33, // 256 kg/yr ÷ 12
      method: "server-energy-estimate-projected",
      projected: true,
      metadata: { projectionBasis: "256kg-per-year-estimate" },
    },
  ]);

  for (const e of emissionRows) {
    await db
      .insert(emissions)
      .values(e)
      .onConflictDoUpdate({
        target: emissions.id,
        set: { co2Kg: e.co2Kg, amount: e.amount, description: e.description, metadata: e.metadata, updatedAt: now },
      });
  }
  for (const e of projectedRows) {
    await db
      .insert(emissions)
      .values(e)
      .onConflictDoUpdate({
        target: emissions.id,
        set: { co2Kg: e.co2Kg, amount: e.amount, description: e.description, metadata: e.metadata, updatedAt: now },
      });
  }

  console.log(`  Emissions: ${emissionRows.length} actual + ${projectedRows.length} projected seeded`);

  // Animal Future avatar from their Bandcamp profile (checked into repo)
  await copyAsset("animalfuture-avatar.jpg", creatorRows[3]!.avatarKey);

  console.log("\nDemo seed complete. All users share password: password123");
} catch (e) {
  console.error("Error:", e);
  process.exit(1);
} finally {
  await sql.end();
}
