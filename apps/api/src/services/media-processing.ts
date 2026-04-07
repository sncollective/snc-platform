import { spawn } from "node:child_process";

import { AppError, ok, err, MIN_FILM_YEAR, MAX_FILM_YEAR } from "@snc/shared";
import type { Result, ProbeResult, Rendition } from "@snc/shared";
import { RENDITION_PROFILES, VIDEO_RENDITIONS } from "@snc/shared";

import { rootLogger } from "../logging/logger.js";

// ── Private Helpers ──

const wrapFfmpegError = (e: unknown): AppError => {
  rootLogger.error(
    { error: e instanceof Error ? e.message : String(e) },
    "FFmpeg error",
  );
  return new AppError("FFMPEG_ERROR", "Media processing failed", 502);
};

/** Attach a stderr data handler that parses FFmpeg `time=` lines into progress percent. */
const parseFFmpegProgress = (
  totalDuration: number,
  onProgress: ((percent: number) => void) | undefined,
) => (chunk: Buffer) => {
  const line = chunk.toString();
  if (totalDuration > 0 && onProgress) {
    const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]!, 10);
      const minutes = parseInt(timeMatch[2]!, 10);
      const seconds = parseFloat(timeMatch[3]!);
      const currentTime = hours * 3600 + minutes * 60 + seconds;
      const percent = Math.min(
        Math.round((currentTime / totalDuration) * 100),
        99,
      );
      onProgress(percent);
    }
  }
};

/** Spawn ffmpeg with the given args, resolving on exit code 0, rejecting otherwise. */
const runFfmpeg = async (args: string[]): Promise<Result<void, AppError>> => {
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      proc.on("error", reject);
    });
    return ok(undefined);
  } catch (e) {
    return err(wrapFfmpegError(e));
  }
};

// ── Types ──

export type TranscodeOptions = {
  readonly videoBitrate?: string;
  readonly audioBitrate?: string;
  readonly onProgress?: (percent: number) => void;
  readonly isHdr?: boolean;
  readonly maxHeight?: number;
};

export type RenditionTranscodeOptions = {
  readonly rendition: Rendition;
  readonly onProgress?: (percent: number) => void;
};

// ── Public API ──

/**
 * Extract normalised metadata from ffprobe format.tags.
 *
 * Handles case variants (TITLE/title, DATE/date/YEAR/year, DIRECTOR/director/ARTIST/artist)
 * and parses DATE strings to a four-digit year integer.
 */
const extractProbeTags = (
  raw: Record<string, string> | undefined,
): { title: string | null; year: number | null; director: string | null } => {
  if (!raw) return { title: null, year: null, director: null };

  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = raw[k];
      if (v && v.trim()) return v.trim();
    }
    return null;
  };

  const title = get("TITLE", "title");

  const rawYear = get("DATE", "date", "YEAR", "year");
  let year: number | null = null;
  if (rawYear) {
    const parsed = parseInt(rawYear.slice(0, 4), 10);
    if (!isNaN(parsed) && parsed >= MIN_FILM_YEAR && parsed <= MAX_FILM_YEAR) year = parsed;
  }

  const director = get("DIRECTOR", "director", "ARTIST", "artist");

  return { title, year, director };
};

/**
 * Probe a media file with ffprobe. Returns codec, resolution, duration, and bitrate.
 *
 * Spawns `ffprobe -v quiet -print_format json -show_format -show_streams` and
 * parses the JSON stdout. Returns null for fields absent in audio-only files.
 */
export const probeMedia = async (
  filePath: string,
): Promise<Result<ProbeResult, AppError>> => {
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const proc = spawn("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        filePath,
      ]);

      let output = "";
      let stderrOutput = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`ffprobe exited with code ${code}: ${stderrOutput}`));
        }
      });

      proc.on("error", reject);
    });

    const data = JSON.parse(stdout) as {
      format?: {
        duration?: string;
        bit_rate?: string;
        tags?: Record<string, string>;
      };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        color_transfer?: string;
        color_primaries?: string;
      }>;
    };

    const videoStream = data.streams?.find((s) => s.codec_type === "video");
    const audioStream = data.streams?.find((s) => s.codec_type === "audio");
    const subtitleStream = data.streams?.find((s) => s.codec_type === "subtitle");
    const knownTypes = new Set(["video", "audio", "subtitle"]);
    const dataStreamCount = data.streams?.filter(
      (s) => s.codec_type && !knownTypes.has(s.codec_type),
    ).length ?? 0;

    const colorTransfer = videoStream?.color_transfer ?? null;
    const colorPrimaries = videoStream?.color_primaries ?? null;
    const isHdr = colorTransfer === "smpte2084" || colorTransfer === "arib-std-b67";

    return ok({
      videoCodec: videoStream?.codec_name ?? null,
      audioCodec: audioStream?.codec_name ?? null,
      subtitleCodec: subtitleStream?.codec_name ?? null,
      width: videoStream?.width ?? null,
      height: videoStream?.height ?? null,
      duration: data.format?.duration ? parseFloat(data.format.duration) : null,
      bitrate: data.format?.bit_rate ? parseInt(data.format.bit_rate, 10) : null,
      dataStreamCount,
      tags: extractProbeTags(data.format?.tags),
      colorTransfer,
      colorPrimaries,
      isHdr,
    });
  } catch (e) {
    return err(wrapFfmpegError(e));
  }
};

/**
 * Transcode a media file to H.264 + AAC in MP4 container.
 *
 * Spawns FFmpeg with `-c:v libx264 -c:a aac -movflags +faststart`.
 * Parses stderr for `time=HH:MM:SS.ms` progress lines to report progress percentage.
 * Progress is capped at 99% during processing and set to 100% on completion.
 *
 * @param options.onProgress - Optional callback receiving progress as 0–100 integer
 */
export const transcodeToH264 = async (
  input: string,
  output: string,
  options?: TranscodeOptions,
): Promise<Result<void, AppError>> => {
  try {
    const probeResult = await probeMedia(input);
    const totalDuration = probeResult.ok ? (probeResult.value.duration ?? 0) : 0;

    await new Promise<void>((resolve, reject) => {
      const args = [
        "-i", input,
        "-map", "0:v:0",
        "-map", "0:a:0",
      ];

      // HDR tone-mapping: convert to SDR
      if (options?.isHdr) {
        let vfChain = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
        // Cap HDR sources at 1080p (CPU tone-mapping is expensive at 4K)
        if (options.maxHeight && options.maxHeight > 1080) {
          vfChain += ",scale=-2:1080";
        }
        args.push("-vf", vfChain);
      }

      args.push(
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        ...(options?.videoBitrate ? ["-b:v", options.videoBitrate] : []),
        "-c:a", "aac",
        ...(options?.audioBitrate ? ["-b:a", options.audioBitrate] : ["-b:a", "128k"]),
        "-movflags", "+faststart",
        "-y",
        output,
      );

      const proc = spawn("ffmpeg", args);

      proc.stderr.on("data", parseFFmpegProgress(totalDuration, options?.onProgress));

      proc.on("close", (code) => {
        if (code === 0) {
          options?.onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`ffmpeg transcode exited with code ${code}`));
        }
      });

      proc.on("error", reject);
    });

    return ok(undefined);
  } catch (e) {
    return err(wrapFfmpegError(e));
  }
};

/**
 * Extract a single frame as a JPEG thumbnail.
 *
 * Spawns FFmpeg with `-vframes 1` at the given timestamp.
 * When no timestamp is provided, seeks to 10% of the file's duration to avoid black frames.
 *
 * @param timestampSeconds - Explicit seek position in seconds; defaults to 10% of duration
 */
export const extractThumbnail = async (
  input: string,
  output: string,
  timestampSeconds?: number,
): Promise<Result<void, AppError>> => {
  try {
    const seekTo = timestampSeconds ?? 0;
    const probeResult = await probeMedia(input);
    const ts =
      seekTo > 0
        ? seekTo
        : probeResult.ok && probeResult.value.duration
          ? probeResult.value.duration * 0.1
          : 2;

    return runFfmpeg([
      "-ss", String(ts),
      "-i", input,
      "-vframes", "1",
      "-q:v", "2",
      "-y",
      output,
    ]);
  } catch (e) {
    return err(wrapFfmpegError(e));
  }
};

/**
 * Remux a container to MP4 with faststart without re-encoding.
 *
 * Used for VOD recordings: FLV → MP4 or MKV → MP4.
 * Spawns `ffmpeg -c copy -movflags +faststart` — fast regardless of file size.
 */
export const remuxToMp4 = async (
  input: string,
  output: string,
): Promise<Result<void, AppError>> => {
  return runFfmpeg([
    "-i", input,
    "-map", "0:v:0",
    "-map", "0:a:0",
    "-c", "copy",
    "-movflags", "+faststart",
    "-y",
    output,
  ]);
};

/**
 * Remux a media file keeping only video and audio streams.
 *
 * Strips data tracks (timecode, camera telemetry, chapter markers) that cause
 * Liquidsoap's FFmpeg decoder to hang during request resolution. Codec-copy
 * only — fast regardless of file size or resolution.
 */
export const remuxPlayoutSource = async (
  input: string,
  output: string,
): Promise<Result<void, AppError>> => {
  return runFfmpeg([
    "-i", input,
    "-map", "0:v:0",
    "-map", "0:a:0",
    "-c", "copy",
    "-movflags", "+faststart",
    "-y",
    output,
  ]);
};

/**
 * Transcode a media file to a specific rendition profile.
 *
 * Video renditions scale to target resolution (maintaining aspect ratio) with
 * CRF-based quality. Audio-only extracts the audio track as AAC M4A.
 * Probes input for duration to report progress.
 *
 * @param options.rendition - Target rendition key from RENDITION_PROFILES
 * @param options.onProgress - Optional callback receiving progress as 0–100 integer
 */
export const transcodeToRendition = async (
  input: string,
  output: string,
  options: RenditionTranscodeOptions,
): Promise<Result<void, AppError>> => {
  try {
    const probeResult = await probeMedia(input);
    const totalDuration = probeResult.ok ? (probeResult.value.duration ?? 0) : 0;

    const profile = RENDITION_PROFILES[options.rendition];

    await new Promise<void>((resolve, reject) => {
      let args: string[];

      if (options.rendition === "audio") {
        args = [
          "-i", input,
          "-map", "0:a:0",
          "-vn",
          "-c:a", "aac",
          "-b:a", profile.audioBitrate,
          "-y",
          output,
        ];
      } else {
        const videoProfile = profile as typeof RENDITION_PROFILES["1080p"];
        args = [
          "-i", input,
          "-map", "0:v:0",
          "-map", "0:a:0",
          "-vf", `scale=${videoProfile.width}:-2`,
          "-c:v", "libx264",
          "-crf", String(videoProfile.crf),
          "-preset", videoProfile.preset,
          "-c:a", "aac",
          "-b:a", profile.audioBitrate,
          "-movflags", "+faststart",
          "-y",
          output,
        ];
      }

      const proc = spawn("ffmpeg", args);

      proc.stderr.on("data", parseFFmpegProgress(totalDuration, options.onProgress));

      proc.on("close", (code) => {
        if (code === 0) {
          options.onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`ffmpeg rendition transcode exited with code ${code}`));
        }
      });

      proc.on("error", reject);
    });

    return ok(undefined);
  } catch (e) {
    return err(wrapFfmpegError(e));
  }
};

/**
 * Extract the first subtitle track as WebVTT.
 *
 * Spawns `ffmpeg -i input -map 0:s:0 -c:s webvtt output.vtt`.
 * Returns ok if subtitles extracted, err if no subtitle stream or ffmpeg fails.
 */
export const extractSubtitles = async (
  input: string,
  output: string,
): Promise<Result<void, AppError>> => {
  return runFfmpeg([
    "-i", input,
    "-map", "0:s:0",
    "-c:s", "webvtt",
    "-y",
    output,
  ]);
};

/**
 * Determine which video renditions are applicable for a given source resolution.
 * Skips renditions above source resolution (no upscaling).
 * Audio rendition is always included.
 */
export const getApplicableRenditions = (
  sourceWidth: number | null,
  sourceHeight: number | null,
): Rendition[] => {
  const renditions: Rendition[] = ["audio"];
  if (!sourceHeight) return renditions;
  for (const r of VIDEO_RENDITIONS) {
    const profile = RENDITION_PROFILES[r];
    if (sourceHeight >= profile.height) {
      renditions.push(r);
    }
  }
  return renditions;
};
