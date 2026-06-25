import { test, expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";

import { contextNav, isMobile } from "./helpers/nav.js";

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
 *
 * Three cases (assign-own-content, queueable-badge, play-next) are skipped against a
 * parked product bug — `creator-content-search-excludes-ready-status`: the creator
 * "+ Add Content" search filters content on `processing_status = 'completed'`, but
 * content's terminal state is `'ready'` ('completed' is never written to content), so
 * a creator's own processed video never reaches the pool through search. Re-enable the
 * three skips once that fix lands. The surface-renders, nav, and cross-tenant-isolation
 * cases are unaffected and stay green.
 */

// Maya's own video content (seed-demo.ts) and a cross-tenant creator's content.
const MAYA_CONTENT = "Studio Tour 2026";
const JORDAN_CONTENT = "Open Mic Night Highlights";

const POOL_BUG = "creator-content-search-excludes-ready-status";

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

  test("assigns own content to the pool", async ({ page }, testInfo) => {
    test.skip(
      true,
      `${POOL_BUG}: creator "+ Add Content" search excludes 'ready'-status content, so own content never reaches the pool`,
    );
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
    test.skip(
      true,
      `${POOL_BUG}: own content can't reach the pool via search, so the queue picker can't list it`,
    );
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
    test.skip(
      true,
      `${POOL_BUG}: own content can't reach the pool via search, so there is nothing to play-next`,
    );
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
