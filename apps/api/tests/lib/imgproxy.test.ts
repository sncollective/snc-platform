import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

const { TEST_KEY, TEST_SALT } = vi.hoisted(() => ({
  TEST_KEY: "11".repeat(32),
  TEST_SALT: "22".repeat(32),
}));

vi.mock("../../src/config.js", () => ({
  config: {
    IMGPROXY_URL: "https://images.example.test",
    IMGPROXY_KEY: TEST_KEY,
    IMGPROXY_SALT: TEST_SALT,
    S3_BUCKET: "snc-media",
  },
}));

import {
  buildImgproxyUrl,
  buildPressImageUrl,
  buildSrcSet,
} from "../../src/lib/imgproxy.js";

const IMAGE = {
  key: "library/sha256/example.jpg",
  alt: "The band on stage",
};

const splitSignedUrl = (url: string): { signature: string; path: string } => {
  const remainder = url.slice("https://images.example.test/".length);
  const pathStart = remainder.indexOf("/");
  return {
    signature: remainder.slice(0, pathStart),
    path: remainder.slice(pathStart),
  };
};

const expectedSignature = (path: string): string => {
  const hmac = createHmac("sha256", Buffer.from(TEST_KEY, "hex"));
  hmac.update(Buffer.from(TEST_SALT, "hex"));
  hmac.update(path);
  return hmac.digest("base64url");
};

const signatureOf = (url: string): string => splitSignedUrl(url).signature;

describe("buildPressImageUrl", () => {
  it("builds and signs the complete no-crop banner path at the requested width", () => {
    const result = buildPressImageUrl(IMAGE, "banner", 1500);
    const { signature, path } = splitSignedUrl(result.src);

    expect(path).toBe(
      "/rs:fill:1500:500:0/q:95/g:ce/plain/s3://snc-media/library/sha256/example.jpg",
    );
    expect(signature).toBe(expectedSignature(path));
  });

  it("converts a normalized crop rectangle to dimensions and focal-point center", () => {
    const result = buildPressImageUrl(
      { ...IMAGE, crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.4 } },
      "banner",
      1500,
    );

    expect(splitSignedUrl(result.src).path).toContain(
      "/c:0.6:0.4:fp:0.4:0.4/rs:fill:1500:500:0/q:95/g:ce/",
    );
  });

  it("encodes normalized full-source crop axes with imgproxy's zero sentinel", () => {
    const bothAxes = buildPressImageUrl(
      { ...IMAGE, crop: { x: 0, y: 0, width: 1, height: 1 } },
      "member",
      600,
    );
    const widthAxis = buildPressImageUrl(
      { ...IMAGE, crop: { x: 0, y: 0.25, width: 1, height: 0.5 } },
      "member",
      600,
    );

    expect(splitSignedUrl(bothAxes.src).path).toContain("/c:0:0:fp:0.5:0.5/");
    expect(splitSignedUrl(widthAxis.src).path).toContain("/c:0:0.5:fp:0.5:0.5/");
  });

  it("canonicalizes crop segments to six decimals with trailing zeros removed", () => {
    const result = buildPressImageUrl(
      {
        ...IMAGE,
        crop: {
          x: 0.12345649,
          y: 0.20000001,
          width: 0.6000001,
          height: 0.33333349,
        },
      },
      "gallery",
      960,
    );

    expect(splitSignedUrl(result.src).path).toContain(
      "/c:0.6:0.333333:fp:0.423457:0.366667/rs:fill:960:720:0/q:95/g:ce/",
    );
  });

  it.each([
    ["banner", 1200, 400, "100vw"],
    ["about", 1200, 1500, "(max-width: 760px) 100vw, 360px"],
    ["member", 1200, 1200, "(max-width: 760px) 50vw, 240px"],
    [
      "gallery",
      1200,
      900,
      "(max-width: 480px) 84vw, (max-width: 760px) 45vw, 300px",
    ],
    ["cover", 1200, 1200, "(max-width: 480px) 92px, 145px"],
  ] as const)("uses the pinned %s ratio and sizes", (slot, width, height, sizes) => {
    const result = buildPressImageUrl(IMAGE, slot, width);

    expect(splitSignedUrl(result.src).path).toContain(
      `/rs:fill:${width}:${height}:0/q:95/g:ce/`,
    );
    expect(result.sizes).toBe(sizes);
  });

  it("builds de-duplicated quarter, half, and full candidates with one exact crop", () => {
    const crop = { x: 0.1, y: 0.2, width: 0.6, height: 0.4 };
    const result = buildPressImageUrl({ ...IMAGE, crop }, "banner", 1500);
    const candidates = result.srcSet.split(", ");

    expect(candidates.map((candidate) => candidate.slice(candidate.lastIndexOf(" ") + 1)))
      .toEqual(["375w", "750w", "1500w"]);
    expect(candidates.map((candidate) => splitSignedUrl(candidate.slice(0, candidate.lastIndexOf(" "))).path))
      .toEqual([
        "/c:0.6:0.4:fp:0.4:0.4/rs:fill:375:125:0/q:95/g:ce/plain/s3://snc-media/library/sha256/example.jpg",
        "/c:0.6:0.4:fp:0.4:0.4/rs:fill:750:250:0/q:95/g:ce/plain/s3://snc-media/library/sha256/example.jpg",
        "/c:0.6:0.4:fp:0.4:0.4/rs:fill:1500:500:0/q:95/g:ce/plain/s3://snc-media/library/sha256/example.jpg",
      ]);

    const narrow = buildPressImageUrl(IMAGE, "member", 320);
    expect(narrow.srcSet.match(/ \d+w/g)).toEqual([" 160w", " 320w"]);
  });

  it("changes the signature with crop, slot ratio, or width and stays deterministic", () => {
    const baseline = buildPressImageUrl(IMAGE, "banner", 1500);
    const unchanged = buildPressImageUrl(IMAGE, "banner", 1500);
    const cropped = buildPressImageUrl(
      { ...IMAGE, crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.4 } },
      "banner",
      1500,
    );
    const differentSlot = buildPressImageUrl(IMAGE, "about", 1500);
    const differentWidth = buildPressImageUrl(IMAGE, "banner", 1200);

    expect(unchanged).toEqual(baseline);
    expect(signatureOf(cropped.src)).not.toBe(signatureOf(baseline.src));
    expect(signatureOf(differentSlot.src)).not.toBe(signatureOf(baseline.src));
    expect(signatureOf(differentWidth.src)).not.toBe(signatureOf(baseline.src));
  });

  it.each([0, -1, 100.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid output width %s",
    (width) => {
      expect(() => buildPressImageUrl(IMAGE, "banner", width)).toThrow(RangeError);
    },
  );
});

describe("existing imgproxy builders", () => {
  it("keeps buildImgproxyUrl's width-only path and whole-path signature", () => {
    const url = buildImgproxyUrl("content/example.jpg", 640);
    const { signature, path } = splitSignedUrl(url);

    expect(path).toBe("/rs:fill:640:0/g:ce/plain/s3://snc-media/content/example.jpg");
    expect(signature).toBe(expectedSignature(path));
  });

  it("keeps buildSrcSet's caller-supplied width descriptors", () => {
    const srcSet = buildSrcSet("content/example.jpg", [320, 640]);

    expect(srcSet.split(", ").map((candidate) => candidate.slice(candidate.lastIndexOf(" ") + 1)))
      .toEqual(["320w", "640w"]);
    expect(srcSet).toContain("/rs:fill:320:0/g:ce/");
    expect(srcSet).toContain("/rs:fill:640:0/g:ce/");
  });
});
