import { afterEach, describe, expect, it, vi } from "vitest";

const response = (status = 200) => ({
  ok: () => status >= 200 && status < 300,
  status: () => status,
});

const makePage = (overrides: Record<string, unknown> = {}) => {
  let closed = false;
  const page = {
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
    goto: vi.fn().mockResolvedValue(response()),
    setContent: vi.fn().mockResolvedValue(undefined),
    addStyleTag: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue([]),
    emulateMedia: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF")),
    close: vi.fn().mockImplementation(async () => { closed = true; }),
    isClosed: vi.fn().mockImplementation(() => closed),
    ...overrides,
  };
  return page;
};

const loadAdapter = async (options?: {
  readonly launch?: ReturnType<typeof vi.fn>;
  readonly pages?: ReturnType<typeof makePage>[];
}) => {
  const pages = options?.pages ?? [makePage()];
  const listeners = new Map<string, () => void>();
  const browser = {
    isConnected: vi.fn().mockReturnValue(true),
    on: vi.fn((event: string, callback: () => void) => { listeners.set(event, callback); }),
    newPage: vi.fn().mockImplementation(async () => pages.shift() ?? makePage()),
    version: vi.fn().mockReturnValue("Chromium test"),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const launch = options?.launch ?? vi.fn().mockResolvedValue(browser);
  vi.doMock("playwright", () => ({ chromium: { launch } }));
  const adapter = await import("../../src/services/browser-pdf.js");
  return { adapter, browser, launch, listeners };
};

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("playwright");
});

describe("browser PDF adapter", () => {
  it("reports an unavailable executable without retaining a failed singleton", async () => {
    const launch = vi.fn().mockRejectedValue(new Error("Executable doesn't exist"));
    const { adapter } = await loadAdapter({ launch });

    await expect(adapter.renderBrowserPdf({ html: "<p>test</p>" })).rejects.toThrow(
      "Executable doesn't exist",
    );
    await expect(adapter.getBrowserPdfHealth()).resolves.toMatchObject({
      status: "unavailable",
      error: "Executable doesn't exist",
    });
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it("enforces the hard end-to-end deadline and closes the active page", async () => {
    const page = makePage({ goto: vi.fn(() => new Promise(() => undefined)) });
    const { adapter } = await loadAdapter({ pages: [page] });

    await expect(adapter.renderBrowserPdf({
      url: "https://press.test/slow",
      timeoutMs: 15,
    })).rejects.toThrow("hard deadline");
    expect(page.close).toHaveBeenCalled();
  });

  it("rejects non-2xx live pages and cleans up the page", async () => {
    const page = makePage({ goto: vi.fn().mockResolvedValue(response(502)) });
    const { adapter } = await loadAdapter({ pages: [page] });

    await expect(adapter.renderBrowserPdf({ url: "https://press.test/fail" }))
      .rejects.toThrow("HTTP 502");
    expect(page.pdf).not.toHaveBeenCalled();
    expect(page.close).toHaveBeenCalledOnce();
  });

  it("rejects failed image/font readiness instead of printing missing assets", async () => {
    const page = makePage({ evaluate: vi.fn().mockResolvedValue(["https://img.test/broken.jpg"]) });
    const { adapter } = await loadAdapter({ pages: [page] });

    await expect(adapter.renderBrowserPdf({ html: "<img src='broken.jpg'>" }))
      .rejects.toThrow("assets failed to load");
    expect(page.pdf).not.toHaveBeenCalled();
    expect(page.close).toHaveBeenCalledOnce();
  });

  it("rejects a one-sheet whose DOM geometry overflows the Letter root", async () => {
    const page = makePage({
      evaluate: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["vertical content overflow"]),
    });
    const { adapter } = await loadAdapter({ pages: [page] });

    await expect(adapter.renderBrowserPdf({ html: "<article class='sheet'></article>", singlePage: true }))
      .rejects.toThrow("does not fit one page");
    expect(page.pdf).not.toHaveBeenCalled();
    expect(page.close).toHaveBeenCalledOnce();
  });

  it("cleans up pages when PDF generation throws", async () => {
    const page = makePage({ pdf: vi.fn().mockRejectedValue(new Error("print failed")) });
    const { adapter } = await loadAdapter({ pages: [page] });

    await expect(adapter.renderBrowserPdf({ html: "<p>test</p>" })).rejects.toThrow("print failed");
    expect(page.close).toHaveBeenCalledOnce();
  });

  it("allows at most two Chromium pages concurrently", async () => {
    const pdfResolvers: Array<(value: Buffer) => void> = [];
    const pages = Array.from({ length: 3 }, () => makePage({
      pdf: vi.fn(() => new Promise<Buffer>((resolve) => pdfResolvers.push(resolve))),
    }));
    const { adapter, browser } = await loadAdapter({ pages: [...pages] });

    const renders = [1, 2, 3].map((id) => adapter.renderBrowserPdf({ html: `<p>${id}</p>` }));
    await vi.waitFor(() => expect(browser.newPage).toHaveBeenCalledTimes(2));
    expect(pdfResolvers).toHaveLength(2);

    pdfResolvers[0]!(Buffer.from("%PDF first"));
    await vi.waitFor(() => expect(browser.newPage).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(pdfResolvers).toHaveLength(3));
    pdfResolvers[1]!(Buffer.from("%PDF second"));
    pdfResolvers[2]!(Buffer.from("%PDF third"));

    await expect(Promise.all(renders)).resolves.toHaveLength(3);
    expect(Math.max(...pages.map((page) => page.close.mock.invocationCallOrder[0] ?? 0))).toBeGreaterThan(0);
  });
});
