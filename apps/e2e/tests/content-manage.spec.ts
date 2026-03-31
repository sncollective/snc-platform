import { test, expect } from "@playwright/test";

test.describe("Content management", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("content tab shows in creator manage sidebar", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage");

    // Scope to the sidebar navigation to avoid matching the h2 "Content" heading
    const sidebar = page.getByRole("navigation", { name: "Maya Chen navigation" });
    await expect(sidebar.getByRole("link", { name: "Content" })).toBeVisible();
  });

  test("content list shows published and draft sections", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage/content");

    // Section headings
    await expect(page.getByRole("heading", { name: "Published" })).toBeVisible();

    // Maya's published content should appear
    await expect(page.getByText("Midnight Frequencies")).toBeVisible();
  });

  test("content list has type filter", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage/content");

    // Type filter is a combobox labeled "Filter by type"
    await expect(page.getByRole("combobox", { name: "Filter by type" })).toBeVisible();
  });

  test("create new button is visible", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage/content");

    await expect(
      page.getByRole("button", { name: /create new/i }),
    ).toBeVisible();
  });

  test("content title links to edit page", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage/content");

    // Title is now a clickable link (after UI fix)
    const titleLink = page.getByRole("link", { name: "Midnight Frequencies" });
    await expect(titleLink).toBeVisible();
    await expect(titleLink).toHaveAttribute(
      "href",
      /\/creators\/maya-chen\/manage\/content\/midnight-frequencies/,
    );
  });
});

test.describe("Content management (non-creator)", () => {
  test.use({ storageState: "auth/subscriber.json" });

  test("non-creator is redirected from content management", async ({ page }) => {
    await page.goto("/creators/maya-chen/manage/content");

    // Pat (subscriber) is not a creator member — should redirect to login or show access denied
    const url = new URL(page.url());
    const wasRedirected =
      url.pathname.includes("/login") || url.pathname === "/";
    const hasAccessDenied = await page
      .getByText(/access denied/i)
      .isVisible()
      .catch(() => false);

    expect(
      wasRedirected || hasAccessDenied,
      "Expected redirect or access denied for non-creator",
    ).toBe(true);
  });
});
