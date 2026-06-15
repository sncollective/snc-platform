import { test, expect } from "@playwright/test";

import { isMobile } from "./helpers/nav.js";

test.describe("Live streaming page", () => {
  test("live page loads and shows channel selector", async ({ page }) => {
    await page.goto("/live");
    await expect(page).toHaveURL(/\/live/);
    // Channel selector always present — playout channels are pre-seeded
    await expect(page.getByRole("combobox", { name: "Select channel" })).toBeVisible();
    // S/NC TV playout channel should be listed
    await expect(page.getByRole("option", { name: /S\/NC TV/ })).toBeAttached();
  });

  test("live page is accessible without authentication", async ({ page }) => {
    await page.goto("/live");
    await expect(page).toHaveURL(/\/live/);
    await expect(page.getByRole("combobox", { name: "Select channel" })).toBeVisible();
  });

  test("live page has correct page title", async ({ page }) => {
    await page.goto("/live");
    await expect(page).toHaveTitle(/Live/);
  });
});

test.describe("Live streaming page (authenticated)", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("theater mode toggle is present", async ({ page }, testInfo) => {
    // Theater mode is a desktop-only control (CSS-hidden below 768px by
    // design — the mobile layout uses an Info/Chat tab switcher instead).
    test.skip(isMobile(testInfo), "Theater mode is desktop-only by design");
    await page.goto("/live");
    await expect(
      page.getByRole("button", { name: "Theater mode" }),
    ).toBeVisible();
  });

  test("chat panel input mounts", async ({ page }, testInfo) => {
    await page.goto("/live");
    // Chat input has aria-label="Chat message" — render-level check only.
    // WebSocket connectivity is out of scope for this test; the input
    // should be present even in a disconnected state.
    //
    // On mobile the chat panel lives behind a "Chat" tab that the live page
    // only renders while a channel is actively streaming. With no publisher on
    // the test stack the tab is absent and chat is intentionally collapsed, so
    // the input is only assertable at desktop. Open the tab when it is present.
    if (isMobile(testInfo)) {
      const chatTab = page.getByRole("tab", { name: "Chat" });
      test.skip(
        !(await chatTab.isVisible().catch(() => false)),
        "Mobile chat tab only renders while a channel is streaming (no publisher on the test stack)",
      );
      await chatTab.click();
    }
    await expect(
      page.getByRole("textbox", { name: "Chat message" }),
    ).toBeVisible();
  });
});
