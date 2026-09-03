import type { Browser, Page } from "playwright";
import { chromium } from "playwright";

import { rootLogger } from "../logging/logger.js";

const LETTER_WIDTH_IN = 8.5;
const LETTER_HEIGHT_IN = 11;
const DEFAULT_RENDER_TIMEOUT_MS = 30_000;
const ASSET_WAIT_CAP_MS = 8_000;
const MAX_CONCURRENT_PAGES = 2;

type ReleaseSlot = () => void;
type SlotWaiter = {
  readonly resolve: (release: ReleaseSlot) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

let browserPromise: Promise<Browser> | null = null;
let activePages = 0;
const slotWaiters: SlotWaiter[] = [];

export interface BrowserPdfOptions {
  readonly html?: string;
  readonly url?: string;
  readonly replaceBodyHtml?: string;
  readonly documentAttributes?: Readonly<Record<`data-${string}`, string>>;
  readonly style?: string;
  readonly singlePage?: boolean;
  /** Page geometry for the emitted PDF; defaults to US Letter. */
  readonly pageSize?: {
    readonly widthIn: number;
    readonly heightIn: number;
  };
  readonly timeoutMs?: number;
}

export interface BrowserPdfHealth {
  readonly status: "ok" | "unavailable";
  readonly browserVersion?: string;
  readonly activePages: number;
  readonly queuedPages: number;
  readonly error?: string;
}

export class BrowserPdfTimeoutError extends Error {
  constructor() {
    super("Press PDF rendering exceeded its hard deadline");
    this.name = "BrowserPdfTimeoutError";
  }
}

export class BrowserPdfPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserPdfPreflightError";
  }
}

/** Single-page fit failure — retryable at a denser tier, unlike other preflight failures. */
export class BrowserPdfSinglePageFitError extends BrowserPdfPreflightError {
  constructor(message: string) {
    super(message);
    this.name = "BrowserPdfSinglePageFitError";
  }
}

const assertSinglePageFit = async (page: Page, deadline: number): Promise<void> => {
  const issues = await withinDeadline(page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[data-pdf-sheet], .sheet");
    if (!sheet) return ["single-page sheet root is missing"];

    const epsilon = 1;
    const bounds = sheet.getBoundingClientRect();
    const problems: string[] = [];
    if (sheet.scrollWidth > sheet.clientWidth + epsilon) problems.push("horizontal content overflow");
    if (sheet.scrollHeight > sheet.clientHeight + epsilon) problems.push("vertical content overflow");

    const outside = [...sheet.querySelectorAll<HTMLElement>("*")].find((element) => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = element.getBoundingClientRect();
      return rect.left < bounds.left - epsilon
        || rect.top < bounds.top - epsilon
        || rect.right > bounds.right + epsilon
        || rect.bottom > bounds.bottom + epsilon;
    });
    if (outside) {
      const label = outside.className || outside.tagName.toLowerCase();
      problems.push(`element outside Letter sheet: ${String(label)}`);
    }

    // In-flow content painting into the bottom padding does not grow scrollHeight,
    // so the overflow checks above miss it; flag it explicitly. Absolutely
    // positioned chrome (e.g. anchored sheet footers) is exempt by design.
    const sheetStyle = getComputedStyle(sheet);
    const paddingFloor = bounds.bottom - (parseFloat(sheetStyle.paddingBottom) || 0);
    const deepestInFlow = [...sheet.querySelectorAll<HTMLElement>("*")].reduce((floor, element) => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return floor;
      if (style.position === "absolute" || style.position === "fixed") return floor;
      return Math.max(floor, element.getBoundingClientRect().bottom);
    }, bounds.top);
    if (deepestInFlow > paddingFloor + epsilon) {
      problems.push(`content paints into the bottom padding: ${Math.round(deepestInFlow - paddingFloor)}px`);
    }
    return problems;
  }), deadline, () => { void page.close().catch(() => undefined); });

  if (issues.length > 0) {
    throw new BrowserPdfSinglePageFitError(`Press one-sheet does not fit one page: ${issues.join("; ")}`);
  }
};

const remainingMs = (deadline: number): number => Math.max(0, deadline - Date.now());

const withinDeadline = async <T>(
  operation: Promise<T>,
  deadline: number,
  onTimeout?: () => void,
): Promise<T> => {
  const remaining = remainingMs(deadline);
  if (remaining === 0) {
    onTimeout?.();
    throw new BrowserPdfTimeoutError();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new BrowserPdfTimeoutError());
        }, remaining);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const releasePageSlot = (): void => {
  const waiter = slotWaiters.shift();
  if (waiter) {
    clearTimeout(waiter.timer);
    waiter.resolve(releasePageSlot);
    return;
  }
  activePages--;
};

const acquirePageSlot = async (deadline: number): Promise<ReleaseSlot> => {
  if (activePages < MAX_CONCURRENT_PAGES) {
    activePages++;
    return releasePageSlot;
  }

  return new Promise<ReleaseSlot>((resolve, reject) => {
    const waiter: SlotWaiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const index = slotWaiters.indexOf(waiter);
        if (index >= 0) slotWaiters.splice(index, 1);
        reject(new BrowserPdfTimeoutError());
      }, remainingMs(deadline)),
    };
    slotWaiters.push(waiter);
  });
};

const launchBrowser = async (): Promise<Browser> => {
  const browser = await chromium.launch({ headless: true });
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
};

const getBrowser = async (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  const browser = await browserPromise;
  if (browser.isConnected()) return browser;
  browserPromise = launchBrowser();
  return browserPromise;
};

const createPage = async (browser: Browser, deadline: number): Promise<Page> => {
  const pagePromise = browser.newPage({
    viewport: { width: 816, height: 1056 },
    deviceScaleFactor: 1,
  });
  void pagePromise.then(async (page) => {
    if (remainingMs(deadline) === 0) await page.close().catch(() => undefined);
  }).catch(() => undefined);
  return withinDeadline(pagePromise, deadline);
};

const waitForAssets = async (page: Page, deadline: number): Promise<void> => {
  const cap = Math.min(ASSET_WAIT_CAP_MS, remainingMs(deadline));
  const failures = await withinDeadline(page.evaluate(async (assetTimeoutMs) => {
    const timeout = new Promise<"timeout">((resolve) => {
      window.setTimeout(() => resolve("timeout"), assetTimeoutMs);
    });
    const loaded = Promise.all([
      document.fonts.ready.then(() => "fonts" as const),
      ...[...document.images].map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        }
        return image.naturalWidth > 0 ? null : image.currentSrc || image.src || "unknown image";
      }),
    ]);
    const result = await Promise.race([loaded, timeout]);
    if (result === "timeout") return ["asset readiness timed out"];
    return result.filter((value): value is string => value !== null && value !== "fonts");
  }, cap), deadline, () => { void page.close().catch(() => undefined); });

  if (failures.length > 0) {
    throw new BrowserPdfPreflightError(
      `Press PDF assets failed to load: ${failures.slice(0, 3).join(", ")}`,
    );
  }
};

const renderOnPage = async (
  browser: Browser,
  options: BrowserPdfOptions,
  deadline: number,
): Promise<Buffer> => {
  let page: Page | null = null;
  try {
    page = await createPage(browser, deadline);
    page.setDefaultTimeout(Math.max(1, remainingMs(deadline)));
    page.setDefaultNavigationTimeout(Math.max(1, remainingMs(deadline)));

    if (options.url) {
      const response = await withinDeadline(
        page.goto(options.url, { waitUntil: "domcontentloaded" }),
        deadline,
        () => { void page?.close().catch(() => undefined); },
      );
      if (!response?.ok()) {
        throw new BrowserPdfPreflightError(
          `Press page render failed with HTTP ${response?.status() ?? "unknown"}`,
        );
      }
    } else {
      await withinDeadline(
        page.setContent(options.html!, { waitUntil: "domcontentloaded" }),
        deadline,
        () => { void page?.close().catch(() => undefined); },
      );
    }

    if (options.documentAttributes || options.replaceBodyHtml !== undefined) {
      await withinDeadline(page.evaluate(
        ({ documentAttributes, replaceBodyHtml }) => {
          for (const [name, value] of Object.entries(documentAttributes ?? {})) {
            document.documentElement.setAttribute(name, value);
          }
          if (replaceBodyHtml !== undefined) document.body.innerHTML = replaceBodyHtml;
        },
        {
          documentAttributes: options.documentAttributes,
          replaceBodyHtml: options.replaceBodyHtml,
        },
      ), deadline, () => { void page?.close().catch(() => undefined); });
    }

    if (options.style) {
      await withinDeadline(page.addStyleTag({ content: options.style }), deadline);
    }
    await waitForAssets(page, deadline);
    await withinDeadline(page.emulateMedia({ media: "print" }), deadline);
    if (options.singlePage) await assertSinglePageFit(page, deadline);

    const pdf = await withinDeadline(page.pdf({
      width: `${options.pageSize?.widthIn ?? LETTER_WIDTH_IN}in`,
      height: `${options.pageSize?.heightIn ?? LETTER_HEIGHT_IN}in`,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      ...(options.singlePage
        ? { margin: { top: "0", right: "0", bottom: "0", left: "0" } }
        : {}),
    }), deadline, () => { void page?.close().catch(() => undefined); });
    return Buffer.from(pdf);
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => undefined);
  }
};

/** Render browser-native HTML/CSS to US Letter using one bounded shared Chromium process. */
export const renderBrowserPdf = async (options: BrowserPdfOptions): Promise<Buffer> => {
  if ((options.html == null) === (options.url == null)) {
    throw new TypeError("Browser PDF rendering requires exactly one of html or url");
  }
  if (options.replaceBodyHtml !== undefined && options.url == null) {
    throw new TypeError("Browser PDF body replacement requires a url source");
  }
  const invalidAttribute = Object.keys(options.documentAttributes ?? {})
    .find((name) => !/^data-[a-z0-9_.:-]+$/i.test(name));
  if (invalidAttribute) {
    throw new TypeError(`Browser PDF document attribute must use a data-* name: ${invalidAttribute}`);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const releaseSlot = await acquirePageSlot(deadline);
  try {
    let browser = await withinDeadline(getBrowser(), deadline);
    try {
      return await renderOnPage(browser, options, deadline);
    } catch (error) {
      if (browser.isConnected() || error instanceof BrowserPdfPreflightError || error instanceof BrowserPdfTimeoutError) {
        throw error;
      }
      browserPromise = null;
      browser = await withinDeadline(getBrowser(), deadline);
      return renderOnPage(browser, options, deadline);
    }
  } finally {
    releaseSlot();
  }
};

/** Probe whether the shared Chromium renderer can launch and report bounded-load state. */
export const getBrowserPdfHealth = async (): Promise<BrowserPdfHealth> => {
  try {
    const browser = await withinDeadline(getBrowser(), Date.now() + 5_000);
    return {
      status: "ok",
      browserVersion: browser.version(),
      activePages,
      queuedPages: slotWaiters.length,
    };
  } catch (error) {
    return {
      status: "unavailable",
      activePages,
      queuedPages: slotWaiters.length,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/** Close the singleton browser during graceful process shutdown or isolated tests. */
export const closeBrowserPdf = async (): Promise<void> => {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  const browser = await pending.catch(() => null);
  if (browser?.isConnected()) await browser.close();
};
