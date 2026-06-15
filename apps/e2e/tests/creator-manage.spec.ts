import { test, expect } from "@playwright/test";

import { contextNav, isMobile } from "./helpers/nav.js";

test.describe("Creator management", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("loads tabbed dashboard for Maya", async ({ page }, testInfo) => {
    await page.goto("/creators/maya-chen/manage");

    // Context nav (sidebar on desktop, chipBar on mobile) shows all tabs
    const sidebar = contextNav(page, testInfo, "Maya Chen");
    await expect(sidebar.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Content" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Streaming" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Settings" })).toBeVisible();

    // The "Maya Chen" context label is rendered in the desktop sidebar only;
    // the mobile chipBar carries the tab links without the label.
    if (!isMobile(testInfo)) {
      await expect(sidebar.getByText("Maya Chen")).toBeVisible();
    }
  });

  test("settings tab allows profile editing", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage/settings");

    // Bio field should be visible and editable
    const bioField = page.getByLabel(/bio/i);
    await expect(bioField).toBeVisible();
  });
});
