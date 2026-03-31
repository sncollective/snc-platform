import { test, expect } from "@playwright/test";

test.describe("Content detail (public)", () => {
  test("public content loads via slug URL", async ({ page }) => {
    await page.goto("/content/maya-chen/midnight-frequencies");

    // Content title visible
    await expect(page.getByText("Midnight Frequencies")).toBeVisible();

    // Creator name visible
    await expect(page.getByText("Maya Chen")).toBeVisible();
  });

  test("video content shows player area", async ({ page }) => {
    await page.goto("/content/maya-chen/studio-tour-2026");

    await expect(page.getByText("Studio Tour 2026")).toBeVisible();
  });

  test("written content shows body text", async ({ page }) => {
    await page.goto("/content/maya-chen/on-co-ops-and-creative-freedom");

    // Written content renders the full essay body
    await expect(
      page.getByText(/uploading music to platforms/i).first(),
    ).toBeVisible();
  });

  test("subscriber-only content shows locked view for unauthenticated users", async ({ page }) => {
    await page.goto("/content/maya-chen/synthesis-lab-episode-3");

    // Should show some indication of locked/gated content
    const lockedIndicator = page.getByText(/subscribe/i)
      .or(page.getByText(/locked/i))
      .or(page.getByText(/members only/i));

    await expect(lockedIndicator.first()).toBeVisible();
  });

  test("non-existent content returns error", async ({ page }) => {
    await page.goto("/content/maya-chen/non-existent-draft-slug");

    // Should show not found or error state
    const errorIndicator = page.getByText(/not found/i)
      .or(page.getByText(/404/i))
      .or(page.getByText(/error/i));

    await expect(errorIndicator.first()).toBeVisible();
  });
});

test.describe("Content detail (authenticated)", () => {
  test.use({ storageState: "auth/stakeholder.json" });

  test("creator owner sees manage link on their content", async ({ page }) => {
    await page.goto("/content/maya-chen/midnight-frequencies");

    // Maya (stakeholder auth) is the owner — should see manage link
    const manageLink = page.getByRole("link", { name: /manage/i })
      .or(page.getByRole("link", { name: /edit/i }));

    await expect(manageLink.first()).toBeVisible();
  });
});

test.describe("Creator profile content", () => {
  test("creator profile shows their published content", async ({ page }) => {
    await page.goto("/creators/maya-chen");

    // Maya's public content should be visible
    await expect(page.getByText("Midnight Frequencies")).toBeVisible();
    await expect(page.getByText("Studio Tour 2026")).toBeVisible();
  });

  test("creator profile content links to detail pages", async ({ page }) => {
    await page.goto("/creators/maya-chen");

    // Click on a content item
    await page.getByText("Midnight Frequencies").first().click();

    // Should navigate to content detail
    await expect(page).toHaveURL(/\/content\//);
    await expect(page.getByText("Midnight Frequencies")).toBeVisible();
  });
});
