import { test, expect } from "@playwright/test";

import { mainNav } from "./helpers/nav.js";

test.describe("Navigation flow", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("navigates between pages via nav links", async ({ page }, testInfo) => {
    // Start at landing page
    await page.goto("/");

    // Navigate to Creators via the primary nav surface (viewport-aware)
    const nav = mainNav(page, testInfo);
    await nav.getByRole("link", { name: "Creators" }).click();
    await expect(page).toHaveURL(/\/creators/);
    await expect(
      page.getByRole("heading", { name: "Creators" }),
    ).toBeVisible();

    // Click on Maya's profile
    await page.getByText("Maya Chen").first().click();
    await expect(page).toHaveURL(/\/creators\/maya-chen/);
    // "Maya Chen" appears in both the profile heading and the user menu, so
    // scope to the profile heading to stay strict-mode-safe.
    await expect(
      page.getByRole("heading", { name: "Maya Chen" }),
    ).toBeVisible();
  });

  test("authenticated user sees user menu button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "User menu" }),
    ).toBeVisible();
  });

  test("governance calendar is accessible for stakeholders", async ({ page }) => {
    await page.goto("/governance/calendar");
    await expect(
      page.getByRole("heading", { name: "Calendar", exact: true }),
    ).toBeVisible();
  });

  test("/calendar redirects to /governance/calendar", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/governance\/calendar/);
  });

  test("settings page is accessible for authenticated users", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible();
  });

  test("navigates to live page via nav link", async ({ page }, testInfo) => {
    await page.goto("/");
    const nav = mainNav(page, testInfo);
    await nav.getByRole("link", { name: "Live" }).click();
    await expect(page).toHaveURL(/\/live/);
    // Channel selector is always present (playout channels are pre-seeded)
    await expect(
      page.getByRole("combobox", { name: "Select channel" }),
    ).toBeVisible();
  });
});
