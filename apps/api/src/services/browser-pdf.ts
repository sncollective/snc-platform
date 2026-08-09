import { chromium } from "playwright";

const LETTER_WIDTH_IN = 8.5;
const LETTER_HEIGHT_IN = 11;
const RENDER_TIMEOUT_MS = 30_000;

export interface BrowserPdfOptions {
  readonly html?: string;
  readonly url?: string;
  readonly style?: string;
  readonly singlePage?: boolean;
}

/** Render browser-native HTML/CSS to US Letter using the same print engine as the web surface. */
export const renderBrowserPdf = async ({
  html,
  url,
  style,
  singlePage = false,
}: BrowserPdfOptions): Promise<Buffer> => {
  if ((html == null) === (url == null)) {
    throw new TypeError("Browser PDF rendering requires exactly one of html or url");
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 816, height: 1056 },
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(RENDER_TIMEOUT_MS);

    if (url) {
      const response = await page.goto(url, { waitUntil: "networkidle" });
      if (!response?.ok()) {
        throw new Error(`Press page render failed with HTTP ${response?.status() ?? "unknown"}`);
      }
    } else {
      await page.setContent(html!, { waitUntil: "networkidle" });
    }

    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map(async (image) => {
          if (image.complete) return;
          await new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      );
    });

    if (style) await page.addStyleTag({ content: style });
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      width: `${LETTER_WIDTH_IN}in`,
      height: `${LETTER_HEIGHT_IN}in`,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      ...(singlePage
        ? { margin: { top: "0", right: "0", bottom: "0", left: "0" } }
        : {}),
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
};
