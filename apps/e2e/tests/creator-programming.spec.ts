import { test, expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";

import { contextNav, isMobile } from "./helpers/nav.js";

/**
 * Drive the Programming surface's own UI to remove `MAYA_CONTENT` from Maya's
 * queue and content pool, leaving a clean precondition for the test that follows.
 *
 * Why this exists: assigning content to the pool is a *persistent* write against
 * the shared demo DB (`channel_content`), and the content search deliberately
 * hides already-pooled items (`NOT IN (pool)`), so the first case that assigns
 * Studio Tour would make every later case's `search → click MAYA_CONTENT` find
 * nothing. The mutation also survives across runs and across the two Playwright
 * projects (no per-project reseed). Resetting via the UI before each case — rather
 * than a DB/API reach-around — keeps the suite's black-box boundary intact and
 * makes each case start from the same known state regardless of run order.
 *
 * Tolerant by design: removes only what's present (queue first — a queue entry
 * pins its pool item — then pool), and is a no-op on an already-clean surface.
 */
async function resetMayaProgramming(page: Page): Promise<void> {
  await page.goto("/creators/maya-chen/manage/programming");

  // The pool/queue rows hydrate *after* the headings paint, fed by a client-side
  // fetch. Checking a remove button's count too early reads 0 (row not yet
  // rendered) and skips the drain, leaving stale state. The pool heading gains its
  // ` (N items)` count only once the queue-status fetch resolves, so gate on that
  // parenthetical — it's the deterministic "pool data loaded" signal.
  await expect(
    page.getByRole("heading", { name: /Content Pool \(\d+ items\)/ }),
  ).toBeVisible();

  // The pool/queue dual-render a table and a card list (both in the DOM, one
  // hidden by a CSS container query), so target only the *visible* copy —
  // counting both would never reach 0. Queue entries reference a pool item, so
  // clear the queue before the pool.
  const queueRemove = page
    .getByRole("button", { name: `Remove ${MAYA_CONTENT} from queue` })
    .filter({ visible: true });
  while ((await queueRemove.count()) > 0) {
    await queueRemove.first().click();
    await expect(queueRemove).toHaveCount(0);
  }

  const poolRemove = page
    .getByRole("button", { name: `Remove ${MAYA_CONTENT} from pool` })
    .filter({ visible: true });
  while ((await poolRemove.count()) > 0) {
    await poolRemove.first().click();
    await expect(poolRemove).toHaveCount(0);
  }
}

/**
 * Creator Programming surface — golden path (AC#5 regression guard).
 *
 * Maya (auth/stakeholder.json) owns creator `maya-chen` and has `manageStreaming`.
 * Her creator channel is provisioned in the demo seed, so the Programming tab hits
 * the real editorial surface (Now Playing / Queue / Content Pool), not the "set up
 * streaming" affordance.
 *
 * All assertions are UI-only — the suite's committed black-box boundary. No
 * `page.request` / API probes from a test body (DB persistence is covered by the
 * integration suite). Selectors are roles / labels / text, resilient to CSS churn.
 */

// Maya's own video content (seed-demo.ts) and a cross-tenant creator's content.
const MAYA_CONTENT = "Studio Tour 2026";
const JORDAN_CONTENT = "Open Mic Night Highlights";

/**
 * The Content Pool view present at the current viewport.
 *
 * `ContentPoolTable` dual-renders a `<table>` and a card `<ul>`, both carrying
 * `aria-label="Content pool"` and both always in the DOM (SSR-safe; a CSS container
 * query toggles visibility). The desktop project shows the table; the mobile (Pixel 7)
 * project shows the cards. Scoping to the visible view keeps row assertions
 * unambiguous (the title would otherwise match in both views).
 */
function contentPool(page: Page, testInfo: TestInfo): Locator {
  return page.getByRole(isMobile(testInfo) ? "list" : "table", {
    name: "Content pool",
  });
}

/** Navigate to Maya's provisioned Programming surface and wait for it to render. */
async function gotoProgramming(page: Page): Promise<void> {
  await page.goto("/creators/maya-chen/manage/programming");
  // The editorial surface is provisioned-only; gate the rest of the test on it.
  await expect(page.getByRole("heading", { name: "Content Pool" })).toBeVisible();
}

/**
 * Open a dropdown picker (the "+ Add Content" search or "+ Add to Queue" pool picker)
 * and return its labelled input. The surface is server-rendered then hydrated; an early
 * first click after the page paints is swallowed before React attaches the toggle
 * handler, so retry the open until the picker's input is visible (a hydration race, not
 * a product bug). `toPass` retries the whole click→assert step.
 */
async function openPicker(
  page: Page,
  buttonName: string,
  fieldLabel: string,
): Promise<Locator> {
  const field = page.getByLabel(fieldLabel);
  await expect(async () => {
    await page.getByRole("button", { name: buttonName }).click();
    await expect(field).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  return field;
}

test.describe("Creator Programming surface (golden path)", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("Programming nav link reaches the provisioned surface", async ({
    page,
  }, testInfo) => {
    await page.goto("/creators/maya-chen/manage");

    await contextNav(page, testInfo, "Maya Chen")
      .getByRole("link", { name: "Programming" })
      .click();

    await expect(page).toHaveURL(/\/creators\/maya-chen\/manage\/programming/);
    await expect(page.getByRole("heading", { name: "Content Pool" })).toBeVisible();
  });

  test("renders the real editorial surface, not the setup affordance", async ({
    page,
  }) => {
    await gotoProgramming(page);

    // The three editorial section headings are present (channel provisioned).
    await expect(page.getByRole("heading", { name: "Now Playing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Content Pool" })).toBeVisible();

    // The unprovisioned affordance must be absent.
    await expect(
      page.getByText("Set up streaming to start programming"),
    ).toBeHidden();
  });

  test("does not offer another creator's content in search", async ({ page }) => {
    await gotoProgramming(page);

    const search = await openPicker(page, "+ Add Content", "Search content");
    await search.fill("Open Mic");

    // Jordan's "Open Mic Night Highlights" must not surface in Maya's search — the
    // creator channel scopes the search to her own content + platform library.
    const results = page.getByRole("listbox", { name: "Content search results" });
    await expect(results.getByText("No matching content")).toBeVisible();
    await expect(results.getByText(JORDAN_CONTENT)).toHaveCount(0);
  });
});

/**
 * Pool-mutating golden cases — assigning Studio Tour to Maya's pool is a
 * *persistent* write against the shared demo DB. These run **serially** (each
 * case's reset→assign→assert sequence must not interleave with a sibling's
 * mutation) and on **chromium only** (the two Playwright projects run
 * concurrently against one shared DB with one seed-provisioned creator, so a
 * cross-project run would race regardless of within-project serialization).
 *
 * Scoping to one project loses nothing: the assign/queue path is backend-scoped
 * and viewport-independent. The viewport-sensitive pool render (table vs. card
 * dual-render) is exercised by the read-only "renders the real editorial
 * surface" case above, which still runs on both projects.
 */
test.describe("Creator Programming surface (pool mutations)", () => {
  test.use({ storageState: "auth/stakeholder.json" });
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }, testInfo) => {
    // The shared-DB collision is between concurrent projects; pin these cases to
    // chromium so only one project ever mutates Maya's pool.
    test.skip(
      testInfo.project.name !== "chromium",
      "Pool-mutating cases run on chromium only (shared-DB isolation).",
    );
    // Reset to an empty pool/queue so run order and prior runs start clean.
    await resetMayaProgramming(page);
  });

  test("assigns own content to the pool", async ({ page }, testInfo) => {
    await gotoProgramming(page);

    const search = await openPicker(page, "+ Add Content", "Search content");
    await search.fill("Studio");

    // Own content is offered under a "Creator" badge in the search results.
    const results = page.getByRole("listbox", { name: "Content search results" });
    const option = results.getByRole("option", { name: new RegExp(MAYA_CONTENT) });
    await expect(option).toBeVisible();
    await option.click();

    // It lands in the Content Pool table/card view.
    await expect(contentPool(page, testInfo).getByText(MAYA_CONTENT)).toBeVisible();
  });

  test('pooled content is queueable with a "Content" badge', async ({ page }) => {
    await gotoProgramming(page);

    const search = await openPicker(page, "+ Add Content", "Search content");
    await search.fill("Studio");
    const results = page.getByRole("listbox", { name: "Content search results" });
    await results.getByRole("option", { name: new RegExp(MAYA_CONTENT) }).click();

    const picker = await openPicker(page, "+ Add to Queue", "Filter pool items");
    await expect(picker).toBeVisible();

    // The pool picker lists the item with a "Content" badge — the B1 UI fix
    // (creator content was previously filtered out of the queue picker).
    const option = page.getByRole("option").filter({ hasText: MAYA_CONTENT });
    await expect(option).toBeVisible();
    await expect(option.getByText("Content", { exact: true })).toBeVisible();
  });

  test("play-next queues the item with no error", async ({ page }) => {
    await gotoProgramming(page);

    const search = await openPicker(page, "+ Add Content", "Search content");
    await search.fill("Studio");
    const results = page.getByRole("listbox", { name: "Content search results" });
    await results.getByRole("option", { name: new RegExp(MAYA_CONTENT) }).click();

    await openPicker(page, "+ Add to Queue", "Filter pool items");
    await page.getByRole("option").filter({ hasText: MAYA_CONTENT }).click();

    // UI assertion of the queue write: no error banner, and the item appears in the
    // Upcoming queue list. (DB persistence is covered by the integration suite.)
    await expect(page.getByRole("alert")).toHaveCount(0);
    const queue = page.getByRole("list", { name: "Upcoming queue" });
    await expect(queue).toBeVisible();
    await expect(queue.getByText(MAYA_CONTENT)).toBeVisible();
  });
});
